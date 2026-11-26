# Automatic dependency updates

Dependabot proposes all supported dependency updates, including major versions. Related framework packages are grouped. Updates merge only after the exact current head passes every configured verification job and GitHub enforces an up-to-date protected base. No review or protection bypass is used.

The trusted controller reads repository and PR metadata from the default branch. It never checks out PR code, installs its dependencies, or executes artifacts with write credentials. For the Nx workspace the controller lives in its existing executor owner; the privileged workflow uses the same dependency-free implementation directly as a deliberate security adaptation, avoiding a privileged package installation.

A stale branch is refreshed with its expected head and receives a fresh, read-only verification dispatch. That dispatch is bound to its requested SHA, uniquely associated with the same-repository Dependabot PR and verified again before a SHA-guarded squash merge. Failed or skipped checks block merging. A scheduled reconciliation resumes interrupted work.

Mosaik starter lockfiles retain their manifest's `latest` root specifications. The only automatic lockfile repair changes erroneous `*` Mosaik root entries back to `latest`; resolved package versions and integrity data remain unchanged. The repaired head must pass full verification before merging.

Merges made with the native workflow token do not trigger normal push workflows. The controller explicitly requests source-bound main verification and, when affected, the existing Pages workflow, deduplicating prior dispatches. No package release is introduced.
