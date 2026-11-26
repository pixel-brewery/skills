# Automatic dependency updates

Dependabot proposes all supported dependency updates, including major versions. Related framework packages are grouped. Updates merge only after the exact current head passes every configured verification job and GitHub enforces an up-to-date protected base. No review or protection bypass is used.

The trusted controller reads repository and PR metadata from the default branch. It never checks out PR code, installs its dependencies, or executes artifacts with write credentials. For the Nx workspace the controller lives in its existing executor owner; the privileged workflow uses the same dependency-free implementation directly as a deliberate security adaptation, avoiding a privileged package installation.

A stale branch is refreshed with its expected head and receives a fresh, read-only verification dispatch. That dispatch is bound to its requested SHA, uniquely associated with the same-repository Dependabot PR and verified again before a SHA-guarded squash merge. Failed or skipped checks block merging. A scheduled reconciliation resumes interrupted work.

Mosaik starter lockfiles retain their manifest's `latest` root specifications. The only automatic lockfile repair changes erroneous `*` Mosaik root entries back to `latest`; resolved package versions and integrity data remain unchanged. The repaired head must pass full verification before merging.

Merges made with the native workflow token do not trigger normal push workflows. The controller explicitly requests source-bound main verification and, when affected, the existing Pages workflow, deduplicating prior dispatches. No package release is introduced.

If GitHub requires approval for a token-authored bot head, the controller dispatches the same read-only validation at the unchanged exact head. Ordinary queued or running PR verification is allowed to finish without duplicate dispatch. Every required job must still succeed.

A later approval-blocked PR attempt is excluded from proof selection when an exact-head dispatch has completed successfully. A later ordinary failed or running verification still prevents merging.

Reconciliation isolates failures by pull request: a conflicting or concurrently changed bot branch cannot prevent other eligible updates from being processed. The controller reports the failed PR numbers and remains failed after the batch, preserving visibility and scheduled retries. API diagnostics include only the operation, endpoint and HTTP status; response bodies and credentials are omitted.
