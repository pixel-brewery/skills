#!/usr/bin/env python3
"""Check discoverable skills, metadata and all maintained relative references."""

from pathlib import Path
import re
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
helper = runpy.run_path(str(ROOT / 'skills/architecture/scripts/check_inheritance.py'))
errors = []
for skill in sorted((ROOT / 'skills').iterdir()):
    if not skill.is_dir():
        continue
    entry = skill / 'SKILL.md'
    try:
        metadata = helper['frontmatter'](entry)
        if not re.search(rf'^name:\s*{re.escape(skill.name)}\s*$', metadata, re.M):
            errors.append(f'{entry}: name must match its directory.')
        if not re.search(r'^description:\s*\S.+$', metadata, re.M):
            errors.append(f'{entry}: description is required.')
        errors.extend(helper['validate_links'](skill))
        for file in skill.rglob('*'):
            if file.is_symlink():
                errors.append(f'Skill resources must be regular files: {file}')
            if file.suffix == '.py':
                compile(file.read_text(encoding='utf-8'), str(file), 'exec')
            if file.is_file() and '[TODO:' in file.read_text(encoding='utf-8'):
                errors.append(f'Unfinished skill scaffold: {file}')
    except (OSError, ValueError, SyntaxError) as error:
        errors.append(str(error))
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print('Skill metadata, scripts and relative references are valid.')
