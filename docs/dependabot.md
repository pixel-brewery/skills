# Automatic dependency updates

Dependabot proposes GitHub Actions updates every Monday. Once every required check of a Dependabot pull request is green, `.github/workflows/dependabot-merge.yml` squash-merges it; GitHub still enforces the `main` ruleset on that merge. Because a merge made with the workflow token starts no push workflows, the same workflow then dispatches `validate.yml`, and `publish-pages.yml` when the merge touched its paths, on `main` with the merge commit as `expected_head_sha`.
