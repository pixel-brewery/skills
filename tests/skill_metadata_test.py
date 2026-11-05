"""Exercise the published role-name contract through the repository validator."""

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SkillMetadataTests(unittest.TestCase):
    def test_central_roles_accept_only_their_unprefixed_occupational_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            shutil.copyfile(ROOT / 'scripts/validate.py', root / 'scripts/validate.py')
            helper = root / 'skills/architect/scripts/check_inheritance.py'
            helper.parent.mkdir(parents=True)
            shutil.copyfile(ROOT / 'skills/architect/scripts/check_inheritance.py', helper)
            names = {'architect': 'Architekt', 'designer': 'Designer', 'technical-writer': 'Technical Writer'}
            for name, title in names.items():
                skill = root / 'skills' / name
                (skill / 'agents').mkdir(parents=True)
                (skill / 'SKILL.md').write_text(f'---\nname: {name}\ndescription: A reusable role.\n---\n', encoding='utf-8')
                (skill / 'agents/openai.yaml').write_text(f'interface:\n  display_name: "{title}"\n', encoding='utf-8')

            def validate():
                return subprocess.run([sys.executable, str(root / 'scripts/validate.py')], capture_output=True, text=True)

            self.assertEqual(validate().returncode, 0)
            for name, invalid in [('architect', 'Architecture'), ('designer', 'Mosaik Designer'), ('technical-writer', 'Product Documentation')]:
                with self.subTest(name=name):
                    interface = root / 'skills' / name / 'agents/openai.yaml'
                    interface.write_text(f'interface:\n  display_name: "{invalid}"\n', encoding='utf-8')
                    rejected = validate()
                    self.assertEqual(rejected.returncode, 1)
                    self.assertIn('display_name must be exactly', rejected.stderr)
                    interface.write_text(f'interface:\n  display_name: "{names[name]}"\n', encoding='utf-8')


if __name__ == '__main__':
    unittest.main()
