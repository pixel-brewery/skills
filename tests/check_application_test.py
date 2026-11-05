"""Check accepted composition and the UI bypasses that a native-tag regex missed."""

from pathlib import Path
import runpy
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'skills/designer/scripts/check_application.py'
CHECKER = runpy.run_path(str(SCRIPT))


class ApplicationChecks(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def inspect(self, source, name='View.html'):
        return CHECKER['inspect_source'](source, self.root / name)

    def rules(self, source, name='View.html'):
        return {item.rule for item in self.inspect(source, name).findings}

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        return path

    def test_native_and_handmade_controls_fail_in_framework_syntaxes(self):
        cases = [
            ('View.html', '<button\n (click)="save()">Save</button>', 'native-control'),
            ('View.tsx', 'export const View=()=> <div role="button" onClick={save}>Save</div>;', 'control-role'),
            ('View.vue', '<template><div @click="save">Save</div></template>', 'plain-handler'),
            ('View.svelte', '<div on:click={save}>Save</div>', 'plain-handler'),
            ('View.ts', 'const view = html`<div @click=${save}>Save</div>`;', 'plain-handler'),
            ('View.html', '<p role="status">Loading</p>', 'control-role'),
            ('View.html', '<div contenteditable="true">Edit</div>', 'plain-handler'),
        ]
        for name, source, expected in cases:
            with self.subTest(name=name, source=source):
                self.assertIn(expected, self.rules(source, name))

    def test_real_components_keep_framework_events_forms_and_props(self):
        result = self.inspect('''
            <section class="grid gap-2 p-3 lg:grid-cols-2">
              <h1 style="font:var(--mosaik-typography-headline3)">Orders</h1>
              <mosaik-card class="min-w-0">
                <mosaik-card-content>
                  <mosaik-textbox [formField]="form.name" [label]="copy.name" />
                  <mosaik-button [label]="copy.save" (click)="save.execute()" />
                </mosaik-card-content>
              </mosaik-card>
            </section>''')
        self.assertEqual(result.findings, [])
        self.assertEqual(result.components, 4)

    def test_import_origin_and_aliases_are_checked(self):
        good = '''import { Button as Save } from '@pixel-brewery/mosaik-elements-react';
                  export const View=()=> <Save label="Save" onClick={save} />;'''
        self.assertEqual(self.inspect(good, 'View.tsx').findings, [])
        self.assertEqual(self.inspect(good, 'View.tsx').components, 1)
        for module in ['@mui/material', '@pixel-brewery/mosaik-elements-react-lookalike']:
            source = good.replace('@pixel-brewery/mosaik-elements-react', module)
            self.assertIn('unverified-component', self.rules(source, 'View.tsx'))
        namespace = "import * as M from '@pixel-brewery/mosaik-elements-react'; const V=()=> <M.Button label='Save'/>;"
        self.assertEqual(self.inspect(namespace, 'View.tsx').components, 1)
        direct = "import {Button} from '@pixel-brewery/mosaik-elements-react'; const V=()=> <Button label='Save'/>;"
        self.assertEqual(self.inspect(direct, 'View.tsx').findings, [])
        self.assertIn('unverified-component', self.rules(direct.replace('@pixel-brewery/mosaik-elements-react', '@mui/material'), 'View.tsx'))
        self.assertIn('unverified-component', self.rules('const V=()=> <Input/>;', 'View.tsx'))

    def test_a_mosaik_prefix_or_namespace_does_not_establish_existence(self):
        self.assertIn('unknown-mosaik-component', self.rules('<mosaik-does-not-exist />'))
        result = self.inspect("import { Fantasy } from '@pixel-brewery/mosaik-elements-react'; const V=()=> <Fantasy />;", 'View.tsx')
        self.assertEqual(result.components, 0)
        self.assertIn('unverified-component', {item.rule for item in result.findings})
        self.assertTrue(CHECKER['verified_mosaik_tag']('mosaik-button'))
        self.assertFalse(CHECKER['verified_mosaik_export']('Fantasy'))
        self.assertFalse(CHECKER['verified_mosaik_export']('MosaikThemeProvider', '@pixel-brewery/mosaik-elements-react'))
        source = "import { MosaikThemeProvider } from '@pixel-brewery/mosaik-elements-react'; const V=()=> <MosaikThemeProvider/>;"
        self.assertIn('unverified-component', self.rules(source, 'View.tsx'))

    def test_framework_specific_export_names_follow_their_actual_public_entrypoints(self):
        examples = [
            ('View.vue', "<script setup>import { ButtonComponent } from '@pixel-brewery/mosaik-elements-vue';</script><template><ButtonComponent label='Save'/></template>"),
            ('View.svelte', "<script>import { MosaikButton } from '@pixel-brewery/mosaik-elements-svelte';</script><MosaikButton label='Save'/>"),
        ]
        for name, source in examples:
            with self.subTest(name=name):
                result = self.inspect(source, name)
                self.assertEqual(result.findings, [])
                self.assertEqual(result.components, 1)
        self.assertFalse(CHECKER['verified_mosaik_export']('TextBox', '@pixel-brewery/mosaik-elements-react'))
        self.assertTrue(CHECKER['verified_mosaik_export']('Textbox', '@pixel-brewery/mosaik-elements-react'))
        self.assertTrue(CHECKER['verified_mosaik_export']('TextBoxComponent', '@pixel-brewery/mosaik-elements-angular'))
        self.assertFalse(CHECKER['verified_mosaik_export']('TextboxComponent', '@pixel-brewery/mosaik-elements-angular'))

    def test_layout_and_native_semantic_text_need_no_component_minimum(self):
        result = self.inspect('<main class="flex min-h-screen flex-col gap-2"><h1>Heading</h1><p>Text</p></main>')
        self.assertEqual(result.findings, [])
        self.assertEqual(result.components, 0)

    def test_nonrendered_code_strings_comments_and_type_parameters_are_ignored(self):
        source = '''// <button>example</button>
          const explanation = '<input type="text">';
          const marker = 'mosaik-exception:';
          const example = 'node.innerHTML = markup';
          function identity<T>(value:T):T { return value; }
          export const View=()=> <p>Text</p>;'''
        self.assertEqual(self.inspect(source, 'View.tsx').findings, [])
        self.assertEqual(self.inspect(source, 'View.ts').findings, [])

    def test_inline_angular_and_lit_templates_are_inspected(self):
        angular = '''@Component({
          template: `<section><button>Save</button></section>`,
          styles: [`.row { display:flex; gap:var(--mosaik-layout-space); }`]
        }) export class View {}'''
        self.assertIn('native-control', self.rules(angular, 'View.ts'))
        inline = "@Component({template:`<section class='row'><mosaik-button label='Save'/></section>`, styles:[`.row {display:flex;gap:var(--mosaik-layout-space);}`]}) class View {}"
        self.assertEqual(self.inspect(inline, 'View.ts').findings, [])
        constant = "import {Component} from '@angular/core'; const TEMPLATE='<button>Save</button>'; @Component({selector:'app-view',template:TEMPLATE}) export class View {}"
        self.assertIn('unverified-template', self.rules(constant, 'View.ts'))
        documentation = "export const documentation = 'template: `<button>Save</button>`';"
        self.assertEqual(self.inspect(documentation, 'View.ts').findings, [])

    def test_literal_visual_values_and_token_painted_fake_surfaces_fail(self):
        jsx = "const View=()=> <div style={{color:'#ef4444',borderRadius:'13px'}}>Text</div>;"
        self.assertIn('literal-color', self.rules(jsx, 'View.tsx'))
        self.assertIn('hand-built-surface', self.rules(jsx, 'View.tsx'))
        css = '.panel { padding:calc(var(--mosaik-layout-space)*2);background:var(--mosaik-scheme-surface);border-radius:var(--mosaik-layout-radius); }'
        self.assertIn('hand-built-surface', self.rules(css, 'View.scss'))
        self.assertIn('literal-typography', self.rules('<h1 style="font-weight:600;line-height:1.2">Heading</h1>'))
        self.assertIn('literal-color', self.rules('<p style="color:red">Text</p>'))

    def test_authored_layout_styles_are_checked_and_can_pass(self):
        source = '.layout {display:grid;grid-template-columns:1fr 12rem;gap:calc(var(--mosaik-layout-space)*2);padding:0;} h1 {font:var(--mosaik-typography-headline3)}'
        result = self.inspect(source, 'View.scss')
        self.assertEqual(result.findings, [])
        self.assertEqual(len(result.files), 1)
        self.assertIn('literal-spacing', self.rules('.layout {gap:19px}', 'View.css'))
        self.assertIn('literal-spacing', self.rules('.layout {gap:var(--mosaik-layout-radius)}', 'View.css'))

    def test_pseudo_selectors_media_queries_and_font_resources_are_not_declarations(self):
        css = '''mosaik-table-body-row:hover mosaik-table-body-cell {}
            @media (max-width:720px) { .layout:hover {display:grid;gap:var(--mosaik-layout-space)} }
            @font-face {font-family:'Example';src:url('./example.woff2') format('woff2');font-weight:400}'''
        self.assertEqual(self.inspect(css, 'View.css').findings, [])
        self.assertIn('hand-built-surface', self.rules('@media (max-width:720px) {.panel:hover {background:var(--mosaik-scheme-surface)}}', 'View.css'))

    def test_page_theme_defaults_are_distinct_from_custom_panels(self):
        css = 'html, body {color:var(--mosaik-scheme-foreground);background:var(--mosaik-scheme-background);font:var(--mosaik-typography-body2);margin:0;}'
        self.assertEqual(self.inspect(css, 'root.css').findings, [])
        self.assertIn('hand-built-surface', self.rules(css.replace('html, body', '.panel'), 'root.css'))
        host = "@Component({selector:'workspace-card',template:'<p>Workspace</p>',styles:[`:host {display:block;padding:var(--mosaik-layout-space);background:var(--mosaik-scheme-surface)}`]}) export class WorkspaceCard {}"
        self.assertIn('hand-built-surface', self.rules(host, 'View.ts'))

    def test_typography_uses_complete_roles_without_local_reconstruction(self):
        valid = '<body style="font-family:var(--mosaik-font-family)"><h1 style="font:var(--mosaik-typography-headline3)">Title</h1><p style="font:inherit">Text</p></body>'
        self.assertEqual(self.inspect(valid).findings, [])
        for declaration in ['font-size:calc(var(--mosaik-layout-space)*3)', 'font-weight:var(--mosaik-layout-thickness)', 'line-height:var(--mosaik-typography-body2)', 'letter-spacing:calc(var(--mosaik-layout-space)/4)', 'font:var(--mosaik-layout-space)']:
            with self.subTest(declaration=declaration):
                self.assertIn('literal-typography', self.rules(f'<h1 style="{declaration}">Title</h1>'))

    def test_tailwind_is_limited_to_layout_even_with_variants_or_arbitrary_tokens(self):
        for classes in ['bg-red-500 rounded-lg shadow-lg', 'hover:bg-[var(--mosaik-scheme-surface)]', 'dark:md:rounded-lg', '[background:var(--mosaik-scheme-surface)]', '[--card-content-padding-top:0px]', "before:content-['fake-icon']"]:
            with self.subTest(classes=classes):
                self.assertTrue(self.inspect(f'<div class="{classes}"></div>').findings)
        good = '<section class="grid gap-2 p-3 lg:grid-cols-[minmax(0,2fr)_1fr]"><h1 class="[font:var(--mosaik-typography-headline3)]">Title</h1></section>'
        self.assertEqual(self.inspect(good).findings, [])
        self.assertIn('literal-spacing', self.rules('<div class="p-[19px]"></div>'))
        self.assertIn('literal-spacing', self.rules('<div class="scroll-m-[19px]"></div>'))
        self.assertEqual(self.inspect('<p class="text-right text-balance">Text</p>').findings, [])

    def test_dynamic_classes_styles_and_spread_props_are_explicitly_unverified(self):
        cases = [
            ('<div className={classes}>Text</div>', 'dynamic-class'),
            ('<div style={styles}>Text</div>', 'dynamic-style'),
            ('<div {...props}>Text</div>', 'unverified-props'),
        ]
        for source, expected in cases:
            with self.subTest(source=source):
                self.assertIn(expected, self.rules('const View=()=> ' + source, 'View.tsx'))
        self.assertIn('unverified-style', self.rules('<p style="color:{{color}}">Text</p>'))
        self.assertIn('dynamic-style', self.rules('<div [style.background]="color"></div>'))
        self.assertIn('literal-spacing', self.rules('<div [style.padding.px]="19"></div>'))
        self.assertIn('literal-spacing', self.rules('<div [style.gap.px]="spacing"></div>'))
        self.assertIn('plain-handler', self.rules('<template><div v-on:click="save">Save</div></template>', 'View.vue'))
        self.assertIn('hand-built-surface', self.rules('<div style:background="var(--mosaik-scheme-surface)" style:border-radius="var(--mosaik-layout-radius)">Workspace</div>', 'View.svelte'))

    def test_legacy_waivers_do_not_hide_or_approve_a_control(self):
        for source, name in [
            ('const View=()=> <button>Save</button>; // mosaik-exception:', 'View.tsx'),
            ('<button data-mosaik-exception="native fallback">Save</button>', 'View.html'),
        ]:
            result = self.inspect(source, name)
            self.assertIn('native-control', {item.rule for item in result.findings})
            self.assertIn('legacy-exception', {item.rule for item in result.findings})
            self.assertEqual(result.exceptions, [])

    def test_static_illustration_exception_is_scoped_and_reported(self):
        source = '<svg data-mosaik-illustration="static price plot"><svg><path stroke="red"/></svg><path stroke="blue"/></svg>'
        result = self.inspect(source)
        self.assertEqual(result.findings, [])
        self.assertEqual(len(result.exceptions), 1)
        self.assertIn('undeclared-illustration', self.rules('<svg><path/></svg>'))
        self.assertIn('illustration-exception', self.rules('<div data-mosaik-illustration="mock button"></div>'))
        unsafe = '<svg data-mosaik-illustration="static price plot" onclick="trade()"><foreignObject><button>Trade</button></foreignObject></svg>'
        self.assertIn('plain-handler', self.rules(unsafe))
        self.assertIn('native-control', self.rules(unsafe))

    def test_local_composed_views_are_inspected_not_banned_by_their_names(self):
        child = self.write('Toolbar.tsx', "import {Button} from '@pixel-brewery/mosaik-elements-react'; export const Toolbar=()=> <Button label='Save'/>;")
        main = self.write('View.tsx', "import {Toolbar} from './Toolbar'; export const View=()=> <main className='flex'><Toolbar/></main>;")
        result = CHECKER['inspect_files']([main, child])
        self.assertEqual(result.findings, [])
        self.assertEqual(result.components, 1)
        self.assertEqual(len(result.files), 2)
        child.write_text("export const Toolbar=()=> <button>Save</button>;", encoding='utf-8')
        result = CHECKER['inspect_file'](main)
        self.assertIn('native-control', {item.rule for item in result.findings})
        self.assertTrue(any(item.path == child.resolve() for item in result.findings))

    def test_sibling_and_referenced_styles_are_included_before_class_verification(self):
        template = self.write('Template.html', '<section class="layout"><mosaik-button label="Save"/></section>')
        stylesheet = self.write('styles/layout.scss', '.layout {display:flex;gap:var(--mosaik-layout-space)}')
        owner = self.write('View.ts', "@Component({templateUrl:'./Template.html',styleUrl:'./styles/layout.scss'}) export class View {}")
        result = CHECKER['inspect_file'](owner)
        self.assertEqual(result.findings, [])
        self.assertEqual(set(result.files), {owner.resolve(), template.resolve(), stylesheet.resolve()})
        stylesheet.write_text('.layout {background:var(--mosaik-scheme-surface)}', encoding='utf-8')
        self.assertIn('hand-built-surface', {item.rule for item in CHECKER['inspect_file'](owner).findings})
        stylesheet.write_text('@use "./layout.scss";', encoding='utf-8')
        transitive = self.write('styles/_layout.scss', '.layout {display:grid;gap:var(--mosaik-layout-space)}')
        stylesheet.write_text('@use "./_layout.scss";', encoding='utf-8')
        result = CHECKER['inspect_files']([template, owner])
        self.assertEqual(result.findings, [])
        self.assertIn(transitive.resolve(), result.files)

    def test_stylesheet_imports_and_html_links_are_followed(self):
        self.write('shared.css', '.panel {border-radius:var(--mosaik-layout-radius)}')
        stylesheet = self.write('View.css', '@import "./shared.css"; .layout {display:flex}')
        source = self.write('View.tsx', "import './View.css'; export const View=()=> <main className='layout'/>;")
        result = CHECKER['inspect_file'](source)
        self.assertIn('hand-built-surface', {item.rule for item in result.findings})
        self.assertEqual(len(result.files), 3)
        page = self.write('index.html', '<link rel="stylesheet" href="./View.css"><main></main>')
        self.assertIn('hand-built-surface', {item.rule for item in CHECKER['inspect_file'](page).findings})
        owner = self.write('owner/View.css', '@import url("../shared.css");')
        self.assertIn('hand-built-surface', {item.rule for item in CHECKER['inspect_file'](owner).findings})

    def test_dynamic_html_and_element_factories_are_not_silent_passes(self):
        for source in ['element.innerHTML = render();', 'const node = document.createElement(tag);', "const View=()=> <div dangerouslySetInnerHTML={{__html:content}}/>;"]:
            with self.subTest(source=source):
                self.assertIn('dynamic-template', self.rules(source, 'View.tsx'))
        self.assertIn('dynamic-style', self.rules("element.style.background = color;", 'View.ts'))
        self.assertIn('dynamic-class', self.rules("element.classList.add(className);", 'View.ts'))

    def test_all_inline_style_blocks_and_lit_css_are_inspected(self):
        source = "@Component({template:`<p>Text</p>`,styles:[`p{display:block}`,`p{background:var(--mosaik-scheme-surface)}`]}) class View {}"
        self.assertIn('hand-built-surface', self.rules(source, 'View.ts'))
        lit = "class View extends LitElement { static styles=css`p {border-radius:var(--mosaik-layout-radius)}`; render(){return html`<p>Text</p>`} }"
        self.assertIn('hand-built-surface', self.rules(lit, 'View.ts'))

    def test_imperative_control_event_writes_need_an_established_mosaik_owner(self):
        for source in [
            "document.querySelector('.fake').onclick=()=>save();",
            "const fake=document.querySelector('.fake'); fake.onkeydown=save;",
            "document.querySelector('.fake')['onclick']=save;",
            "document.querySelector('mosaik-card button').onclick=save;",
        ]:
            with self.subTest(source=source):
                self.assertIn('dynamic-interaction', self.rules(source, 'View.js'))
        valid = '''const save=document.querySelector('mosaik-button#save');
            save.onclick=execute;
            document.querySelector('mosaik-button').onkeydown=onKey;
            save.addEventListener('click', execute);
            window.addEventListener('resize', resize);
            window.onload=initialize;
            document.onreadystatechange=initialize;
            const example="node.onclick=save";'''
        self.assertEqual(self.inspect(valid, 'View.js').findings, [])

    def test_local_aliases_and_barrels_cannot_hide_foreign_ui(self):
        alias = "import * as Foreign from '@mui/material'; const Card=Foreign.Card; const V=()=> <Card/>;"
        self.assertIn('unverified-component', self.rules(alias, 'View.tsx'))
        self.write('Card.ts', "export {Card} from '@mui/material';")
        owner = self.write('View.tsx', "import {Card} from './Card'; const V=()=> <Card/>;")
        self.assertIn('unverified-component', {item.rule for item in CHECKER['inspect_file'](owner).findings})
        self.write('Card.tsx', "export {Card} from '@mui/material'; export const Other=()=> <p>Text</p>;")
        self.assertIn('unverified-component', {item.rule for item in CHECKER['inspect_file'](owner).findings})


if __name__ == '__main__':
    unittest.main()
