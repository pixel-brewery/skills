# Pixel Brewery Skills

Reusable [Agent Skills](https://agentskills.io) maintained by Pixel Brewery. Each skill is a discoverable directory under `skills/` with a `SKILL.md` entrypoint and the references or scripts it needs.

## Architecture

[`skills/architecture`](skills/architecture/SKILL.md) contains the shared engineering foundations. Repository-specific architect skills derive from it through explicit composition and retain their local rules, domain routing and framework adaptations.

Install with the standard [Skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add pixel-brewery/skills --skill architecture --agent codex --copy --yes
```

For reproducible repository use, install an immutable commit (replace `COMMIT` with a full 40-character Git SHA):

```sh
npx skills add https://github.com/pixel-brewery/skills/tree/COMMIT/skills/architecture --skill architecture --agent codex --copy --yes
```

Commit `.agents/skills/architecture` and the CLI-generated root `skills-lock.json`. The lock records source, skill path, Git ref and content hash. Existing repository tools own client mirrors; run them after installation instead of editing generated copies.

Add this supported frontmatter metadata to the existing local architect skill:

```yaml
metadata:
  inherits: architecture
```

In its body, explicitly read `[Architecture](../architecture/SKILL.md)` first, then select shared modules and combine them with local references. Metadata alone does not load or merge skills. A local `references/project.md` remains the owner of project policy and deliberate adaptations.

```sh
python3 .agents/skills/architecture/scripts/check_inheritance.py --root . --derived project-architect
```

The validator uses Python 3 and Node.js (the same locale-aware content-hash ordering as the Skills CLI), without third-party Python dependencies or network access. It checks source, full commit pin, installed content, dependency declaration and relative Markdown links. It does not prove that an agent followed every instruction.

To update, choose a reviewed central commit, repeat the pinned `skills add`, regenerate client projections and rerun the check. A pinned install remains on that commit until deliberately updated. Keep changes to project policy in the derived skill; changes to shared foundations belong here.

## Validation

```sh
python3 scripts/validate.py
python3 -m unittest discover -s tests -p '*_test.py'
node scripts/verify-public-content.mjs
node --test scripts/verify-public-content.spec.mjs
```

The `Validate skills` GitHub Actions workflow runs both checks on pushes, pull
requests, merge queues and manual dispatches with read-only repository permissions. Validation
checks skill metadata, Python syntax and maintained relative references; the tests
exercise accepted and rejected inheritance states. The aggregate `Quality Gate`
check succeeds only when the validation job succeeds, and fails if that job fails,
is cancelled or is skipped. Required branch checks are configured separately in
GitHub; add `Quality Gate` after the workflow revision is published and the check
has been observed.

The public-content guard rejects excluded private project references in current
tracked and new nonignored file names, source, symbolic links and decoded gzip
archives. It handles case variations and UTF-8/UTF-16LE content, fails closed on
malformed archives and leaves ignored local artifacts outside the source scan.
Its behavior tests include content split across stream boundaries and large
compressed archives. Node.js 24 runs the dependency-free guard and tests.
