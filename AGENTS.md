# Maintaining Pixel Brewery Skills

- This repository owns reusable skill foundations. Keep consuming projects' business rules, environments, credentials and private repository details in their own derived skills.
- Preserve the architecture skill's foundations and conditional framework guidance when editing. Project adapters own deliberate translations; shared guidance does not add dependencies or runtime capabilities.
- Follow `skill-creator` when creating or substantially revising a skill. Keep required `name` and `description` metadata, useful routing and relevant references; avoid unrelated workflow mandates.
- Run `python3 scripts/validate.py` and `python3 -m unittest discover -s tests -p '*_test.py'` after changing skill tooling. Check links and exercise both valid and rejected inheritance states.
- Consumers install through the Skills CLI and pin a full commit in standard `skills-lock.json`. Do not hand-edit a consumer's imported base or replace its local rules.
- Do not create pull requests without first running an available local Ship-it review and resolving its blocking findings.
