"""Exercise integrity and dependency failures using isolated consumer fixtures."""

import json
from pathlib import Path
import runpy
import shutil
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'skills/architecture'
HELPER = runpy.run_path(str(SOURCE / 'scripts/check_inheritance.py'))


class InheritanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = self.root / '.agents/skills/architecture'
        shutil.copytree(SOURCE, self.base)
        self.local = self.root / '.agents/skills/project-architect'
        self.local.mkdir()
        (self.local / 'SKILL.md').write_text(
            '---\nname: project-architect\ndescription: Project-specific architecture.\n'
            'metadata:\n  inherits: architecture\n---\n\n'
            'Read [Architecture](../architecture/SKILL.md), then apply local rules.\n'
        )
        self.lock = {'version': 1, 'skills': {'architecture': {
            'source': 'pixel-brewery/skills', 'sourceType': 'github',
            'skillPath': 'skills/architecture/SKILL.md', 'ref': 'a' * 40,
            'computedHash': HELPER['folder_hash'](self.base), 'installMode': 'copy'
        }}}
        self.write_lock()

    def write_lock(self):
        (self.root / 'skills-lock.json').write_text(json.dumps(self.lock))

    def check(self):
        return HELPER['validate'](self.root, 'project-architect')

    def test_valid_explicit_derived_skill(self):
        self.assertEqual([], self.check())

    def test_rejects_changed_foundation(self):
        (self.base / 'references/common/architecture.md').write_text('Changed rules.\n')
        self.assertTrue(any('content differs' in message for message in self.check()))

    def test_rejects_mutable_git_ref(self):
        self.lock['skills']['architecture']['ref'] = 'main'
        self.write_lock()
        self.assertTrue(any('40-character' in message for message in self.check()))

    def test_rejects_implicit_or_missing_derivation(self):
        path = self.local / 'SKILL.md'
        path.write_text(path.read_text().replace('  inherits: architecture\n', ''))
        self.assertTrue(any('metadata.inherits' in message for message in self.check()))

    def test_rejects_missing_base_link(self):
        path = self.local / 'SKILL.md'
        path.write_text(path.read_text().replace('[Architecture](../architecture/SKILL.md)', 'Architecture'))
        self.assertTrue(any('explicitly link' in message for message in self.check()))

    def test_rejects_broken_inherited_reference(self):
        (self.local / 'references').mkdir()
        (self.local / 'references/project.md').write_text('[Missing](../../architecture/references/common/missing.md)\n')
        self.assertTrue(any('Broken relative reference' in message for message in self.check()))

    def test_rejects_legacy_list_lock_without_overwriting_it(self):
        self.lock['skills'] = []
        self.write_lock()
        before = (self.root / 'skills-lock.json').read_bytes()
        self.assertTrue(any('skills map' in message for message in self.check()))
        self.assertEqual(before, (self.root / 'skills-lock.json').read_bytes())

    def test_rejects_symlinked_guidance(self):
        (self.local / 'elsewhere.md').symlink_to(self.base / 'SKILL.md')
        self.assertTrue(any('symlinks' in message for message in self.check()))


if __name__ == '__main__':
    unittest.main()
