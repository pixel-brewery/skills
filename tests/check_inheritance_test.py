"""Exercise integrity and dependency failures using isolated consumer fixtures."""

import hashlib
import json
from pathlib import Path
import runpy
import shutil
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'skills/architect'
HELPER = runpy.run_path(str(SOURCE / 'scripts/check_inheritance.py'))


class InheritanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = self.root / '.agents/skills/architect'
        shutil.copytree(SOURCE, self.base)
        self.local = self.root / '.agents/skills/project-architect'
        self.local.mkdir()
        (self.local / 'SKILL.md').write_text(
            '---\nname: project-architect\ndescription: Project-specific architecture.\n'
            'metadata:\n  inherits: architect\n---\n\n'
            'Read [Architecture](../architect/SKILL.md), then apply local rules.\n'
        )
        self.lock = {'version': 1, 'skills': {'architect': {
            'source': 'pixel-brewery/skills', 'sourceType': 'github',
            'skillPath': 'skills/architect/SKILL.md', 'ref': 'a' * 40,
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
        self.lock['skills']['architect']['ref'] = 'main'
        self.write_lock()
        self.assertTrue(any('40-character' in message for message in self.check()))

    def test_rejects_implicit_or_missing_derivation(self):
        path = self.local / 'SKILL.md'
        path.write_text(path.read_text().replace('  inherits: architect\n', ''))
        self.assertTrue(any('metadata.inherits' in message for message in self.check()))

    def test_rejects_missing_base_link(self):
        path = self.local / 'SKILL.md'
        path.write_text(path.read_text().replace('[Architecture](../architect/SKILL.md)', 'Architecture'))
        self.assertTrue(any('explicitly link' in message for message in self.check()))

    def test_rejects_broken_inherited_reference(self):
        (self.local / 'references').mkdir()
        (self.local / 'references/project.md').write_text('[Missing](../../architect/references/common/missing.md)\n')
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

    def test_rejects_unsupported_or_malformed_lock_versions(self):
        for version in (0, 3, True, '2', None):
            with self.subTest(version=version):
                self.lock['version'] = version
                self.write_lock()
                before = (self.root / 'skills-lock.json').read_bytes()
                self.assertTrue(any('skills map' in message for message in self.check()))
                self.assertEqual(before, (self.root / 'skills-lock.json').read_bytes())


class VersionTwoInheritanceTests(InheritanceTests):
    def setUp(self):
        super().setUp()
        self.lock['version'] = 2
        self.lock['skills']['architect']['computedHash'] = HELPER['folder_hash'](self.base, 2)
        self.write_lock()

    def test_accepts_matching_immutable_commit_metadata(self):
        self.lock['skills']['architect']['commit'] = 'a' * 40
        self.write_lock()
        self.assertEqual([], self.check())

    def test_rejects_a_commit_that_differs_from_the_full_ref(self):
        self.lock['skills']['architect']['commit'] = 'b' * 40
        self.write_lock()
        self.assertTrue(any('commit must match' in message for message in self.check()))

    def test_rejects_a_legacy_digest_in_a_version_two_lock(self):
        self.lock['skills']['architect']['computedHash'] = HELPER['folder_hash'](self.base, 1)
        self.write_lock()
        self.assertTrue(any('content differs' in message for message in self.check()))

    def test_accepts_equivalent_crlf_text_without_rewriting_the_lock(self):
        path = self.base / 'SKILL.md'
        path.write_bytes(path.read_bytes().replace(b'\n', b'\r\n'))
        before = (self.root / 'skills-lock.json').read_bytes()
        self.assertEqual([], self.check())
        self.assertEqual(before, (self.root / 'skills-lock.json').read_bytes())


class VersionTwoHashTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_matches_the_published_empty_folder_vector(self):
        self.assertEqual('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', HELPER['folder_hash'](self.root, 2))

    def test_matches_the_published_single_file_vector_and_crlf_normalization(self):
        for content in (b'# hi\n', b'# hi\r\n'):
            with self.subTest(content=content):
                (self.root / 'SKILL.md').write_bytes(content)
                self.assertEqual('93c36952d8843b33e68ae970ebabcc03e1687c9bb0dd1ecaf357060318952f55', HELPER['folder_hash'](self.root, 2))

    def test_matches_the_published_multiple_file_vector(self):
        (self.root / 'SKILL.md').write_bytes(b'a\n')
        (self.root / 'docs').mkdir()
        (self.root / 'docs/b.md').write_bytes(b'b\n')
        self.assertEqual('b22c4d22aa319d2924312fa18fcbfedc88fa89c74dbd8f298c683e1caf7b7f24', HELPER['folder_hash'](self.root, 2))

    def test_ignores_only_cli_metadata_and_installer_cache_exclusions(self):
        (self.root / 'SKILL.md').write_bytes(b'# hi\n')
        for directory in ('.git', '__pycache__', '__pypackages__'):
            (self.root / directory).mkdir()
            (self.root / directory / 'ignored.bin').write_bytes(b'ignored')
        (self.root / 'metadata.json').write_text('{"installer": true}')
        self.assertEqual('93c36952d8843b33e68ae970ebabcc03e1687c9bb0dd1ecaf357060318952f55', HELPER['folder_hash'](self.root, 2))
        (self.root / 'node_modules').mkdir()
        (self.root / 'node_modules/payload.js').write_text('included')
        self.assertNotEqual('93c36952d8843b33e68ae970ebabcc03e1687c9bb0dd1ecaf357060318952f55', HELPER['folder_hash'](self.root, 2))

    def test_orders_path_bytes_and_keeps_binary_line_endings(self):
        (self.root / 'Z.bin').write_bytes(b'\0\r\n')
        (self.root / 'a.md').write_bytes(b'x\r\n')
        expected = hashlib.sha256(b'Z.bin\0003\000\0\r\na.md\0002\000x\n').hexdigest()
        self.assertEqual(expected, HELPER['folder_hash'](self.root, 2))


if __name__ == '__main__':
    unittest.main()
