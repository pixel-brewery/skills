# Maintaining Pixel Brewery Skills

- This repository owns reusable skill foundations. Keep consuming projects' business rules, environments, credentials and private repository details in their own derived skills.
- Preserve the architecture skill's foundations and conditional framework guidance when editing. Project adapters own deliberate translations; shared guidance does not add dependencies or runtime capabilities.
- `designer` records what was tested against a Mosaik version. When a statement in it changes, test it on a live canvas first and keep `scripts/check_design.py` in step with its rules.
- Follow `skill-creator` when creating or substantially revising a skill. Keep required `name` and `description` metadata, useful routing and relevant references; avoid unrelated workflow mandates.
- Run `python3 scripts/validate.py` and `python3 -m unittest discover -s tests -p '*_test.py'` after changing skill tooling. Check links and exercise both valid and rejected inheritance states.
- Consumers install through the Skills CLI and pin a full commit in standard `skills-lock.json`. Do not hand-edit a consumer's imported base or replace its local rules.
- Do not create pull requests without first running an available local Ship-it review and resolving its blocking findings.
- Keep private consumer project identities out of this public foundation. Run `node scripts/verify-public-content.mjs` and its adjacent Node test suite after changing public source or archives; CI includes both checks.

## Git delivery and completion

- Implementation and fix requests include task-scoped commits, pushes and any PR required
  by branch protection, through the requested merge, unless the owner requests analysis,
  a draft or local-only work. Use the designated checkout and `codex/` work branches;
  do not create extra clones or worktrees without a specific request.
- Assign one owner for staging, commits and refs. Parallel agents may edit disjoint files
  under that owner's coordination. Inspect and preserve existing unrelated work before
  staging; never silently include another task's changes.
- Inspect current protection and workflow effects. Run an available local Ship-it review
  before creating a PR, resolve blockers and verify checks at its current head. Never
  bypass checks or weaken protection. A requested merge requires GitHub's `MERGED` state
  and the result on the destination branch; enabling auto-merge is not completion.
- Finish with no staged, unstaged or non-ignored untracked changes, and safely synchronize
  retained local branches with their own upstreams. Remove temporary branches or worktrees
  only after proving integration and preserving unique commits and necessary local data.
  Keep permanent integration branches and the designated checkout; never discard work.
- Report unfinished delivery and its concrete blocker. This policy does not authorize
  releases, publication, deployment, visibility changes or protected-history rewrites.
