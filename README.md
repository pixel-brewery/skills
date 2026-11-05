# Pixel Brewery Skills

Reusable [Agent Skills](https://agentskills.io) maintained by Pixel Brewery. Each skill is a discoverable directory under `skills/` with a `SKILL.md` entrypoint and the references or scripts it needs.

| Role shown to the user | Stable skill ID |
| --- | --- |
| Architekt | `architect` |
| Designer | `designer` |
| Technical Writer | `technical-writer` |

These shared role names have no product prefix. Repository-specific derived roles keep their own project-prefixed names and local contracts.

## Architekt

[`skills/architect`](skills/architect/SKILL.md) contains the shared engineering foundations. Repository-specific architect skills derive from it through explicit composition and retain their local rules, domain routing and framework adaptations.

Install with the standard [Skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add pixel-brewery/skills --skill architect --agent codex --copy --yes
```

For reproducible repository use, install an immutable commit (replace `COMMIT` with a full 40-character Git SHA):

```sh
npx skills add https://github.com/pixel-brewery/skills/tree/COMMIT/skills/architect --skill architect --agent codex --copy --yes
```

Commit `.agents/skills/architect` and the CLI-generated root `skills-lock.json`. The lock records source, skill path, Git ref and content hash. Existing repository tools own client mirrors; run them after installation instead of editing generated copies.

Add this supported frontmatter metadata to the existing local architect skill:

```yaml
metadata:
  inherits: architect
```

In its body, explicitly read `[Architekt](../architect/SKILL.md)` first, then select shared modules and combine them with local references. Metadata alone does not load or merge skills. A local `references/project.md` remains the owner of project policy and deliberate adaptations.

```sh
python3 .agents/skills/architect/scripts/check_inheritance.py --root . --derived project-architect
```

The validator uses Python 3 and Node.js (the same locale-aware content-hash ordering as the Skills CLI), without third-party Python dependencies or network access. It checks source, full commit pin, installed content, dependency declaration and relative Markdown links. It does not prove that an agent followed every instruction.

To update, choose a reviewed central commit, repeat the pinned `skills add`, regenerate client projections and rerun the check. A pinned install remains on that commit until deliberately updated. Keep changes to project policy in the derived skill; changes to shared foundations belong here.

## Designer

[`skills/designer`](skills/designer/SKILL.md) composes and reviews Mosaik interfaces, including responsive behavior, states and visual polish. It detects the target application, framework, output surface and existing foundations before choosing guidance. It covers Claude Design canvases, Angular, React, Vue, Svelte, Lit/HTML and Mosaik Studio. Every available semantic UI role uses a real Mosaik component: cards, badges, feedback and states as well as interactive controls. Tailwind and plain CSS arrange layout; token-painted replacements and component skins do not qualify. Reviews remain read-only unless fixes are requested.

The Mosaik design instructions, versioned canvas guidance, component-based composition workflow and checker are maintained together here.

To make it discoverable for Mosaik UI work across projects, install it globally:

```sh
npx skills add pixel-brewery/skills --skill designer --agent claude-code codex --global --yes
```

For reproducible repository use, replace `COMMIT` with a reviewed full Git SHA and install through the CLI:

```sh
npx skills add https://github.com/pixel-brewery/skills/tree/COMMIT/skills/designer --skill designer --agent codex claude-code --copy --yes
```

Commit the installed canonical `.agents/skills/designer` with the CLI-generated `skills-lock.json` and verify the client projections.

Automatic invocation is enabled in the Codex metadata. The description selects UI work; the skill then routes by the requested outcome and repository evidence, like the architecture skill's domain routing. Agent clients decide whether to invoke a discoverable skill. A consuming repository that requires it for every applicable task routes its own `AGENTS.md` and architect through a derived Designer as described below. Client mirrors must use the installed source.

For a mandatory project Designer, use [project integration](skills/designer/references/project-integration.md): the local role explicitly loads the pinned Designer and that shared workflow, while owning its project's theme, installed version, runtime and generation commands. Route `AGENTS.md` and the local architect through the derived role. The same mandatory catalog procedure applies to new ideas and design decisions in every consumer; do not maintain independent copies of it.

Inspect context without changing the project:

```sh
python3 skills/designer/scripts/discover_design.py path/to/app --json
```

The helper locates evidence; it does not execute theme modules, change dependencies or migrate unrelated design systems. For a migration from repository-owned design skills, install the reviewed central commit first, verify the canonical skill and client projections, then remove the superseded local copy and update callers together. Never invent a lock entry or delete the working local skill before the pinned import exists.

Run the bundled checker on changed canvases, or use `--app` for the complete application UI owner, including templates and authored styles:

```sh
python3 skills/designer/scripts/check_design.py path/to/boards
python3 skills/designer/scripts/check_design.py --app path/to/ui-owner
```

The application check inspects supported markup, inline templates, CSS/SCSS and component/import evidence, and reports unsupported dynamic source or unresolved provenance. Explicitly include any remaining owning style sources. Exception comments do not skip checks; only narrowly declared noninteractive SVG/canvas illustrations can be reported as illustrations. The component snapshot is versioned, and zero errors or a component count alone does not establish exclusive Mosaik use, active theme/preset configuration or working interactions. Follow [the compliance evidence pass](skills/designer/references/compliance.md) and verify the actual view in a browser.

The preserved Claude Code `--hook` adapter can additionally report canvas findings after writes when explicitly configured in the consuming project's settings. [Client integration](skills/designer/references/clients.md) contains the mergeable configuration. Automatic discovery does not install hooks or change user settings; the shared skill metadata stays portable.

## Technical Writer

[`skills/technical-writer`](skills/technical-writer/SKILL.md) combines product
handbooks, portable technical implementation contracts and a consolidated
customer-facing feature catalog in one role. It supports impact checks, builds,
synchronization, audits and documentation migrations, selecting only the audience
guides needed for the task. Technical pages must explain behavior independently
of source paths; catalog entries cover complete implemented customer outcomes
ordered by value.

For reproducible repository use, replace `COMMIT` with a reviewed full Git SHA:

```sh
npx skills add https://github.com/pixel-brewery/skills/tree/COMMIT/skills/technical-writer --skill technical-writer --agent codex claude-code --copy --yes
```

Commit the imported `.agents/skills/technical-writer`, the CLI-generated
`skills-lock.json` and the repository's generated client projections. A local
derived role explicitly reads this base and its own documentation contract;
paths, languages, status labels, commercial vocabulary and validation commands
stay in the consuming project. Metadata alone does not load the base.

[Project integration](skills/technical-writer/references/project-integration.md)
describes composition and an authorized migration from separate documentation
skills. Retain local validators and translation/tour owners. Consumer adoption
follows review of the shared foundation and does not occur as part of adding it.

## Validation

```sh
python3 scripts/validate.py
python3 -m unittest discover -s tests -p '*_test.py'
node scripts/verify-public-content.mjs
node --test scripts/verify-public-content.spec.mjs
```

The `Validate skills` GitHub Actions workflow runs these checks on pushes, pull
requests, merge queues and manual dispatches with read-only repository permissions. Validation
checks skill metadata, Python syntax and maintained relative references; the tests
exercise accepted and rejected inheritance states and design-checker behavior,
including valid layout/component compositions and rejected UI replacements,
styling and bypass attempts. These tests validate the tooling, not every future
agent decision or rendered screen. The aggregate `Quality Gate`
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
