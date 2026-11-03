"""Exercise design discovery through its read-only command-line interface."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'skills/mosaik-design/scripts/discover_design.py'


class DiscoverDesignTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content) if isinstance(content, dict) else content, encoding='utf-8')
        return path

    def run_discovery(self, target='.', *options):
        return subprocess.run([sys.executable, str(SCRIPT), target, '--root', str(self.root), '--json', *options],
                              text=True, capture_output=True, cwd=self.root)

    def discover(self, target='.'):
        completed = self.run_discovery(target)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertNotIn(str(self.root), completed.stdout)
        return json.loads(completed.stdout)

    def test_framework_wrappers_use_their_owning_package(self):
        for framework in ('angular', 'react', 'vue', 'svelte'):
            with self.subTest(framework=framework):
                self.write(f'apps/{framework}/package.json', {'dependencies': {f'@pixel-brewery/mosaik-elements-{framework}': '1.0'}})
                result = self.discover(f'apps/{framework}')
                self.assertEqual(result['frameworks'], [framework])
                self.assertEqual(result['status'], 'existing-mosaik')
                self.assertEqual(result['scope'], f'apps/{framework}')

    def test_lit_foundation_import_is_recognized(self):
        self.write('package.json', {'dependencies': {'lit': '3', '@pixel-brewery/mosaik-elements-foundation': '1.0'}})
        self.write('src/screen.ts', "import { html, LitElement } from 'lit'; import '@pixel-brewery/mosaik-elements-foundation';")
        result = self.discover('src/screen.ts')
        self.assertEqual(result['frameworks'], ['lit'])
        self.assertTrue(result['mosaik']['detected'])

    def test_canvas_does_not_select_react_from_ancestor_tooling(self):
        self.write('package.json', {'devDependencies': {'react': '19'}})
        self.write('boards/Screen.dc.html', '<x-dc><x-import component-from-global-scope="Mosaik.MosaikThemeProvider"></x-import></x-dc>')
        result = self.discover('boards/Screen.dc.html')
        self.assertEqual(result['surfaces'], ['canvas'])
        self.assertEqual(result['frameworks'], [])
        self.assertTrue(result['mosaik']['detected'])

    def test_mixed_workspace_uses_target_imports_and_project_config(self):
        self.write('package.json', {'dependencies': {'@angular/core': '22', 'react': '19', 'vue': '3'}})
        self.write('apps/portal/project.json', {'targets': {'build': {'executor': '@nx/angular:application'}}})
        self.write('apps/portal/src/screen.tsx', 'export const title = "Overview";')
        self.write('apps/other/package.json', {'dependencies': {'@pixel-brewery/mosaik-elements-react': '1.0'}})
        result = self.discover('apps/portal/src/screen.tsx')
        self.assertEqual(result['frameworks'], ['angular'])
        self.assertFalse(result['mosaik']['detected'])
        self.assertEqual(result['scope'], 'apps/portal')

    def test_root_only_dependencies_support_a_nested_nx_app(self):
        self.write('package.json', {'dependencies': {'@pixel-brewery/mosaik-elements-angular': '1.0', '@angular/core': '22'}})
        self.write('apps/portal/project.json', {'name': 'portal'})
        self.write('apps/portal/src/view.html', '<mosaik-button label="Save"></mosaik-button>')
        result = self.discover('apps/portal')
        self.assertEqual(result['frameworks'], ['angular'])
        self.assertTrue(result['mosaik']['detected'])

    def test_html_templates_use_the_owner_angular_configuration(self):
        self.write('package.json', {'dependencies': {'@angular/core': '22', 'react': '19', 'svelte': '5'}})
        self.write('apps/nx-portal/project.json', {'targets': {'build': {'executor': '@nx/angular:application'}}})
        self.write('apps/cli-portal/angular.json', {'projects': {'portal': {'architect': {'build': {'builder': '@angular/build:application'}}}}})
        for owner in ('nx-portal', 'cli-portal'):
            with self.subTest(owner=owner):
                self.write(f'apps/{owner}/src/view.html', '<p>Overview</p>')
                result = self.discover(f'apps/{owner}/src/view.html')
                self.assertEqual(result['frameworks'], ['angular'])
                self.assertEqual(result['scope'], f'apps/{owner}')

    def test_root_reports_candidate_owners_without_picking_a_sibling(self):
        self.write('package.json', {'private': True})
        for name, framework in (('portal', 'angular'), ('site', 'react')):
            self.write(f'apps/{name}/package.json', {'dependencies': {framework if framework == 'react' else '@angular/core': '1'}})
        result = self.discover()
        self.assertEqual(result['scope'], '.')
        self.assertEqual(result['frameworks'], [])
        self.assertEqual(result['status'], 'multiple-ui-owners')
        self.assertEqual([item['scope'] for item in result['candidates']], ['apps/portal', 'apps/site'])

    def test_theme_sources_and_instructions_are_repository_relative(self):
        self.write('package.json', {})
        self.write('tools/design-md.config.json', {'base': 'joy'})
        self.write('DESIGN.md', '<!-- design-md:generated:start -->')
        self.write('AGENTS.md', 'Local policy')
        self.write('.agents/skills/project-architect/SKILL.md', 'Project architecture')
        self.write('src/view.vue', '<template><mosaik-button /></template>')
        result = self.discover('src/view.vue')
        self.assertIn({'path': 'DESIGN.md', 'kind': 'design-document', 'generated': True}, result['foundations'])
        self.assertIn({'path': 'tools/design-md.config.json', 'kind': 'theme-config', 'theme': 'joy'}, result['foundations'])
        self.assertEqual(result['instructions'], ['AGENTS.md', '.agents/skills/project-architect/SKILL.md'])

    def test_studio_requires_ielement_and_mosaik_evidence(self):
        self.write('package.json', {})
        self.write('src/plain.ts', 'interface IElement { text: string }')
        self.assertNotIn('studio', self.discover('src/plain.ts')['surfaces'])
        self.write('src/tree.ts', "const tree: IElement = { tag: 'mosaik-button', props: { label: 'Save' } };")
        result = self.discover('src/tree.ts')
        self.assertIn('studio', result['surfaces'])
        self.assertTrue(result['mosaik']['detected'])

    def test_generation_provenance_after_a_long_frontmatter_is_recognized(self):
        self.write('package.json', {})
        self.write('tools/design-md.config.json', {'base': 'joy'})
        self.write('DESIGN.md', "---\nname: 'Mosaik Joy'\ncolors:\n" + "  mosaik-token: '#ffffff'\n" * 100
                   + '---\nThe YAML frontmatter above is generated by libs/mosaik-themes/bin/design-md.mjs.\nThe prose is hand-authored.')
        result = self.discover()
        self.assertIn({'path': 'DESIGN.md', 'kind': 'design-document', 'generated': True}, result['foundations'])
        self.write('apps/portal/package.json', {})
        self.write('apps/portal/DESIGN.md', '# Generated charts\nA hand-authored guide to displaying generated charts.')
        result = self.discover('apps/portal')
        self.assertIn({'path': 'apps/portal/DESIGN.md', 'kind': 'design-document', 'generated': False}, result['foundations'])

    def test_empty_and_unrelated_ui_do_not_request_a_migration(self):
        self.assertEqual(self.discover()['status'], 'no-ui-evidence')
        self.write('package.json', {'dependencies': {'react': '19', '@radix-ui/react-dialog': '1'}})
        result = self.discover()
        self.assertEqual(result['status'], 'unrelated-ui')
        self.assertFalse(result['mosaik']['detected'])

    def test_explicit_json_design_tree_is_supported_without_scanning_other_json(self):
        self.write('package.json', {})
        self.write('board.json', {'tag': 'mosaik-button', 'props': {'label': 'Save'}})
        result = self.discover('board.json')
        self.assertEqual(result['surfaces'], ['studio'])
        self.assertTrue(result['mosaik']['detected'])
        self.assertEqual(self.discover()['surfaces'], [])
        self.write('.env.json', {'token': 'private'})
        self.assertEqual(self.run_discovery('.env.json').returncode, 2)

    def test_skipped_folders_and_symlinks_are_not_scanned(self):
        self.write('package.json', {})
        self.write('node_modules/dep/package.json', {'dependencies': {'@pixel-brewery/mosaik-elements-react': '1'}})
        self.write('dist/Screen.dc.html', '<x-dc></x-dc>')
        self.write('.yarn/unrelated.vue', '<mosaik-button/>')
        outside = Path(self.temp.name).parent / (self.root.name + '-linked')
        with tempfile.TemporaryDirectory(prefix=outside.name) as directory:
            external = Path(directory)
            (external / 'view.vue').write_text('<mosaik-button/>', encoding='utf-8')
            (self.root / 'linked').symlink_to(external, target_is_directory=True)
            result = self.discover()
            self.assertFalse(result['mosaik']['detected'])
            self.assertEqual(result['candidates'], [])
        self.assertEqual(self.run_discovery('node_modules').returncode, 2)

    def test_symlinked_input_and_foundation_directories_are_not_followed(self):
        self.write('package.json', {})
        self.write('real/view.vue', '<mosaik-button/>')
        self.write('real/design-md.config.json', {'base': 'memphis'})
        (self.root / 'linked').symlink_to(self.root / 'real', target_is_directory=True)
        (self.root / 'tools').symlink_to(self.root / 'real', target_is_directory=True)
        self.assertEqual(self.run_discovery('linked/view.vue').returncode, 2)
        self.assertFalse(any(item['kind'] == 'theme-config' for item in self.discover()['foundations']))

    def test_backend_candidates_do_not_inherit_an_unrelated_root_framework(self):
        self.write('package.json', {'dependencies': {'@angular/core': '22'}})
        self.write('apps/api/package.json', {'dependencies': {'@nestjs/core': '12'}})
        self.write('apps/api/src/service.ts', 'export class Service {}')
        self.write('apps/portal/project.json', {'targets': {'build': {'executor': '@nx/angular:application'}}})
        result = self.discover()
        self.assertEqual([item['scope'] for item in result['candidates']], ['apps/portal'])

    def test_generated_browser_reports_do_not_override_the_real_app_framework(self):
        self.write('package.json', {'private': True})
        self.write('apps/portal/project.json', {'targets': {'build': {'executor': '@nx/angular:application'}}})
        self.write('apps/portal/src/view.html', '<p>Overview</p>')
        for folder in ('playwright-report', 'test-results', 'storybook-static'):
            self.write(f'apps/portal/{folder}/index.html', '<script type="module">import React from "react";</script>')
        self.write('apps/portal/src/catalog.g.ts', 'import React from "react";')
        result = self.discover('apps/portal')
        self.assertEqual(result['frameworks'], ['angular'])
        self.assertEqual(result['warnings'], [])

    def test_malformed_metadata_is_explicit_and_missing_target_fails(self):
        self.write('package.json', '{ broken')
        result = self.discover()
        self.assertIn('Invalid JSON metadata: package.json', result['warnings'])
        self.assertEqual(self.run_discovery('missing').returncode, 2)

    def test_autodetection_finds_the_git_workspace_from_a_nested_target(self):
        (self.root / '.git').mkdir()
        self.write('package.json', {'private': True})
        self.write('apps/portal/package.json', {'dependencies': {'vue': '3'}})
        self.write('apps/portal/src/View.vue', '<template><p>Overview</p></template>')
        result = subprocess.run([sys.executable, str(SCRIPT), 'src/View.vue', '--json'],
                                cwd=self.root / 'apps/portal', capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['scope'], 'apps/portal')


if __name__ == '__main__':
    unittest.main()
