#!/usr/bin/env python3
"""Validate an installed Architect base and its explicit local derivation."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit


def folder_hash(folder: Path, version: int = 1) -> str:
    """Match the selected Skills CLI lock format without rewriting its metadata."""
    if version == 2:
        files = []

        def fail_walk(error):
            raise error

        for directory, folders, names in os.walk(folder, onerror=fail_walk):
            folders[:] = [name for name in folders if name not in {'.git', '__pycache__', '__pypackages__', 'metadata.json'}]
            for name in names:
                if name == 'metadata.json':
                    continue
                path = Path(directory) / name
                if not path.is_file():
                    continue
                content = path.read_bytes()
                if b'\0' not in content:
                    content = content.replace(b'\r\n', b'\n')
                files.append((path.relative_to(folder).as_posix().replace('\\', '/').encode('utf-8'), content))
        digest = hashlib.sha256()
        for path, content in sorted(files, key=lambda item: item[0]):
            digest.update(path)
            digest.update(b'\0')
            digest.update(str(len(content)).encode('ascii'))
            digest.update(b'\0')
            digest.update(content)
        return digest.hexdigest()
    if version != 1:
        raise ValueError('Unsupported Skills CLI lock version.')
    # Preserve the legacy CLI's localeCompare ordering and unframed hash exactly.
    script = """const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[1];
const files = [];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && !['.git', 'node_modules'].includes(entry.name)) collect(file);
    else if (entry.isFile()) files.push(path.relative(root, file).split(path.sep).join('/'));
  }
}
collect(root);
const hash = crypto.createHash('sha256');
for (const name of files.sort((a, b) => a.localeCompare(b))) {
  hash.update(name);
  hash.update(fs.readFileSync(path.join(root, name)));
}
process.stdout.write(hash.digest('hex'));
"""
    result = subprocess.run(
        ['node', '-e', script, str(folder)], capture_output=True, text=True, check=True
    )
    return result.stdout


def frontmatter(path: Path) -> str:
    text = path.read_text(encoding='utf-8')
    match = re.match(r'\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)', text, re.S)
    if not match:
        raise ValueError(f'Missing YAML frontmatter: {path}')
    return match.group(1)


def declares_inheritance(path: Path) -> bool:
    lines = frontmatter(path).splitlines()
    in_metadata = False
    for line in lines:
        if re.fullmatch(r'metadata:\s*', line):
            in_metadata = True
        elif line and not line[0].isspace():
            in_metadata = False
        elif in_metadata and re.fullmatch(r'  inherits:\s*[\'"]?architect[\'"]?\s*', line):
            return True
    return False


def relative_links(path: Path):
    """Ignore fenced examples and external or anchor-only Markdown links."""
    fenced = False
    for line in path.read_text(encoding='utf-8').splitlines():
        if re.match(r'^\s*(```|~~~)', line):
            fenced = not fenced
            continue
        if fenced:
            continue
        for target in re.findall(r'\[[^\]\n]+\]\(([^)\s]+)\)', line):
            parts = urlsplit(target.strip('<>'))
            if parts.scheme or parts.netloc or not parts.path:
                continue
            yield (path.parent / unquote(parts.path)).resolve()


def validate_links(folder: Path, *, inherited_only: bool = False) -> list[str]:
    errors = []
    for path in sorted(folder.rglob('*.md')):
        for target in relative_links(path):
            if inherited_only and path.name != 'SKILL.md' and 'architect' not in target.parts:
                continue
            if not target.exists():
                errors.append(f'Broken relative reference in {path}: {target}')
    return errors


def validate(root: Path, derived: str) -> list[str]:
    errors = []
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', derived) or derived == 'architect':
        return ['Expected the name of a distinct local derived skill.']
    base = root / '.agents/skills/architect'
    local = root / '.agents/skills' / derived
    lock_path = root / 'skills-lock.json'
    try:
        lock = json.loads(lock_path.read_text(encoding='utf-8'))
        if not isinstance(lock, dict) or type(lock.get('version')) is not int or lock.get('version') not in (1, 2) or not isinstance(lock.get('skills'), dict):
            return ['skills-lock.json must use a standard Skills CLI version-1 or version-2 skills map.']
        entry = lock['skills'].get('architect')
        if not isinstance(entry, dict):
            return ['Architect is missing from skills-lock.json; install it with the Skills CLI.']
        if entry.get('source') != 'pixel-brewery/skills' or entry.get('sourceType') != 'github':
            errors.append('Architect must come from the GitHub source pixel-brewery/skills.')
        if entry.get('skillPath') != 'skills/architect/SKILL.md':
            errors.append('Unexpected Architect skillPath in skills-lock.json.')
        if not re.fullmatch(r'[0-9a-f]{40}', str(entry.get('ref', ''))):
            errors.append('Architect must be pinned to a full 40-character Git commit in ref.')
        if lock['version'] == 2 and 'commit' in entry and entry['commit'] != entry.get('ref'):
            errors.append('Architect commit must match its immutable ref pin.')
        expected_hash = entry.get('computedHash', '')
        if not re.fullmatch(r'[0-9a-f]{64}', str(expected_hash)):
            errors.append('Architect requires a Skills CLI computedHash.')
        if not (base / 'SKILL.md').is_file():
            return errors + ['Installed Architect base is missing.']
        if any(p.is_symlink() for folder in (base, local) for p in [folder, *folder.rglob('*')]):
            return errors + ['Base and derived skills must be self-contained copies, not symlinks.']
        if folder_hash(base, lock['version']) != expected_hash:
            errors.append('Installed Architect content differs from skills-lock.json; reinstall the pinned source.')
        local_entry = local / 'SKILL.md'
        if not local_entry.is_file():
            return errors + [f'Derived skill is missing: {local_entry}']
        if not declares_inheritance(local_entry):
            errors.append('The local skill must declare metadata.inherits: architect.')
        if (base / 'SKILL.md').resolve() not in list(relative_links(local_entry)):
            errors.append('The local skill must explicitly link to ../architect/SKILL.md.')
        if (local / 'references/common').exists():
            errors.append('The derived skill still contains a duplicate common foundation; use the installed base.')
        errors.extend(validate_links(base))
        errors.extend(validate_links(local, inherited_only=True))
    except (OSError, ValueError, AttributeError, subprocess.SubprocessError) as error:
        errors.append(f'Cannot validate Architect inheritance: {error}')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd(), help='Consuming repository root.')
    parser.add_argument('--derived', required=True, help='Repository-local architecture skill name.')
    args = parser.parse_args()
    errors = validate(args.root.resolve(), args.derived)
    if errors:
        print('\n'.join(f'Architect inheritance: {error}' for error in errors), file=sys.stderr)
        return 1
    print(f'{args.derived} derives from the pinned Architect base; lock, content and references match.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
