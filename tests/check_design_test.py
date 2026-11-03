"""Exercise accepted and rejected design files through the public checker entry points."""

import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'skills/mosaik-design/scripts/check_design.py'
HELPER = runpy.run_path(str(SCRIPT))

PROVIDER = 'component-from-global-scope="Mosaik.MosaikThemeProvider"'
BUTTON = '<x-import component-from-global-scope="Mosaik.Button" label="Save"></x-import>'


def board(body: str, helmet: str = '') -> str:
    return (
        f'<x-dc><helmet><style>body{{margin:0}}{helmet}</style></helmet>'
        f'<x-import {PROVIDER} theme="soho"><div style="color:var(--mosaik-scheme-foreground)">\n{body}\n</div></x-import></x-dc>'
        '<script type="text/x-dc">const color = "#ffffff";</script>'
    )


class CheckDesignTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, content: str, name: str = 'Screen.dc.html') -> Path:
        path = self.root / name
        path.write_text(content, encoding='utf-8')
        return path

    def rules(self, body: str, helmet: str = '') -> dict:
        result = HELPER['check']([self.write(board(body, helmet))])
        return {finding.rule: finding.severity for finding in result.findings}

    def test_a_board_of_components_is_clean(self):
        result = HELPER['check']([self.write(board(BUTTON))])
        self.assertEqual(result.findings, [])
        self.assertEqual(result.components, 1)

    def test_values_in_scripts_are_ignored(self):
        self.assertEqual(self.rules(BUTTON), {})

    def test_native_controls_are_rejected(self):
        for tag in ('button', 'input', 'select', 'textarea', 'table', 'dialog', 'progress'):
            with self.subTest(tag=tag):
                self.assertEqual(self.rules(f'<{tag}></{tag}>').get('native-control'), 'error')

    def test_hand_built_controls_are_rejected(self):
        self.assertEqual(self.rules('<div role="switch"></div>').get('control-role'), 'error')
        self.assertEqual(self.rules('<div onClick="{{pick}}">Row</div>').get('plain-handler'), 'error')

    def test_layout_containers_stay_allowed(self):
        self.assertEqual(self.rules('<main><section><nav><h1>Title</h1><p>Text</p><code>x</code></nav></section></main>'), {})

    def test_literal_values_are_reported(self):
        self.assertEqual(self.rules('<div style="color:#ff0000"></div>').get('literal-color'), 'error')
        self.assertEqual(self.rules('<div style="background:rgb(0,0,0)"></div>').get('literal-color'), 'error')
        self.assertEqual(self.rules('<i></i>', helmet='a{color:#123456}').get('literal-color'), 'error')
        self.assertEqual(self.rules('<div style="font-family:Georgia"></div>').get('literal-font'), 'warning')
        self.assertEqual(self.rules('<div style="font:var(--mosaik-typography-body2)"></div>'), {})

    def test_missing_provider_is_rejected(self):
        result = HELPER['check']([self.write(f'<x-dc>{BUTTON}</x-dc>')])
        self.assertEqual([finding.rule for finding in result.findings], ['missing-provider'])

    def test_canvas_traps_are_rejected(self):
        cases = {
            'imported-item': '<x-import component-from-global-scope="Mosaik.SelectItem"></x-import>',
            'card-children': '<x-import component-from-global-scope="Mosaik.Card"><div>Child</div></x-import>',
            'card-part': '<x-import component-from-global-scope="Mosaik.CardTitle"></x-import>',
            'deprecated-stack': '<x-import component-from-global-scope="Mosaik.Stack"></x-import>',
            'table-no-columns': '<x-import component-from-global-scope="Mosaik.Table"></x-import>',
            'raw-table': '<mosaik-table></mosaik-table>',
            'raw-card': '<mosaik-card></mosaik-card>',
            'raw-false': '<mosaik-tab-strip-item is-selected="false"></mosaik-tab-strip-item>',
            'button-in-link': f'<a href="X.dc.html">{BUTTON}</a>',
            'import-custom-property': '<x-import component-from-global-scope="Mosaik.Button" style="--x:1"></x-import>',
        }
        for rule, body in cases.items():
            with self.subTest(rule=rule):
                self.assertEqual(self.rules(body).get(rule), 'error')

    def test_documented_patterns_pass(self):
        linked = f'<a href="X.dc.html" style="display:inline-flex"><div style="display:flex;pointer-events:none">{BUTTON}</div></a>'
        self.assertEqual(self.rules(linked), {})
        self.assertEqual(self.rules('<x-import component-from-global-scope="Mosaik.Card" header="Title"></x-import>'), {})
        self.assertEqual(self.rules('<x-import component-from-global-scope="Mosaik.Card"><mosaik-card-content slot="content"><div>Rich</div></mosaik-card-content></x-import>'), {})
        self.assertEqual(self.rules('<mosaik-tab-strip-item is-selected="{{t.on}}"></mosaik-tab-strip-item>'), {})

    def test_selectable_rows_need_the_shared_rule(self):
        row = '<x-import component-from-global-scope="Mosaik.TableBodyRow" on-click="{{pick}}"></x-import>'
        self.assertEqual(self.rules(row).get('row-state-rule'), 'warning')
        self.assertEqual(self.rules(row, helmet='mosaik-table-body-row:hover mosaik-table-body-cell{}'), {})

    def test_plain_text_links_get_a_warning(self):
        self.assertEqual(self.rules('<a href="X.dc.html">All runs</a>').get('plain-link'), 'warning')
        self.assertEqual(self.rules('<a href="X.dc.html"><mosaik-menu-item label="Runs"></mosaik-menu-item></a>'), {})

    def test_exceptions_need_a_reason_and_are_listed(self):
        result = HELPER['check']([self.write(board('<canvas></canvas><button data-mosaik-exception="native drag handle"></button>'))])
        self.assertEqual(result.findings, [])
        self.assertEqual(len(result.exceptions), 1)
        self.assertIn('native drag handle', result.exceptions[0])
        self.assertEqual(self.rules('<button data-mosaik-exception=""></button>').get('exception-reason'), 'error')

    def test_folders_are_searched_for_canvases_only_by_default(self):
        self.write(board(BUTTON))
        self.write('<button></button>', 'component.html')
        self.assertEqual(HELPER['check']([self.root]).files, 1)

    def test_app_mode_checks_framework_templates(self):
        self.write('<button></button>\n<mosaik-button></mosaik-button>\n<Input />\n', 'view.tsx')
        self.write('<button mosaik-exception: drag handle></button>', 'allowed.html')
        self.write('declare const x: 1;', 'types.d.ts')
        result = HELPER['check']([self.root], app=True)
        self.assertEqual([(item.path.name, item.line) for item in result.findings], [('view.tsx', 1)])

    def test_command_line_exit_codes(self):
        clean = self.write(board(BUTTON), 'Clean.dc.html')
        broken = self.write(board('<button></button>'), 'Broken.dc.html')
        self.assertEqual(self.run_script(str(clean)).returncode, 0)
        rejected = self.run_script(str(broken))
        self.assertEqual(rejected.returncode, 1)
        self.assertIn('native-control', rejected.stdout)
        self.assertEqual(self.run_script(str(self.root / 'missing.dc.html')).returncode, 2)
        report = json.loads(self.run_script('--json', str(broken)).stdout)
        self.assertEqual(report['errors'], 1)

    def test_hook_blocks_only_broken_canvases(self):
        broken = self.write(board('<button></button>'), 'Broken.dc.html')
        clean = self.write(board(BUTTON), 'Clean.dc.html')
        other = self.write('<button></button>', 'other.html')
        result = self.run_hook(json.dumps({'tool_input': {'file_path': str(broken)}}))
        self.assertEqual(result.returncode, 2)
        self.assertIn('native-control', result.stderr)
        for payload in (
            json.dumps({'tool_input': {'file_path': str(clean)}}),
            json.dumps({'tool_input': {'file_path': str(other)}}),
            json.dumps({'tool_input': {}}),
            'not json',
        ):
            self.assertEqual(self.run_hook(payload).returncode, 0, payload)

    def run_script(self, *arguments: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(SCRIPT), *arguments], capture_output=True, text=True)

    def run_hook(self, payload: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(SCRIPT), '--hook'], input=payload, capture_output=True, text=True)


if __name__ == '__main__':
    unittest.main()
