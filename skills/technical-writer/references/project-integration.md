# Project documentation contract

Read this when applying the foundation to a new repository, creating a derived skill, or migrating existing documentation skills. Existing local documentation rules remain authoritative for their project-specific choices. Infer ordinary choices from maintained documentation and executable configuration; ask only when an unresolved decision materially affects the result.

## Separate the foundation from project policy

The shared skill owns evidence gathering, audience boundaries, feature ownership, documentation modes, technical portability and catalog classification. A local contract owns the following concrete decisions:

| Project concern | Record locally |
| --- | --- |
| Canonical destinations | Product and technical roots, feature entry names, indexes, principles and the single catalog file, where these exist. |
| Language and audience | Narrative language, product terminology, public labels, intended recipients and sharing constraints. |
| Document status | Exact labels for implemented current state, accepted target architecture and migration contracts. |
| Repository evidence | Stack, canonical production owners, generated contracts, configuration and relevant test/runtime entry points. |
| Commercial claims | Authoritative availability and billing policy, public plan names, quota/limit sources and any price-verification requirements. |
| Catalog conventions | Exact heading and metadata labels, deliberate final comfort category/feature and validation of that endpoint. |
| Consequences | Event, webhook, email/template, job and integration owners, plus required impact checks. |
| Generated content | Source owners, regeneration commands and client projections; translation and executable-tour ownership. |
| Verification | Existing structural, link, anchor, status, catalog and other applicable validator commands and their scope. |

These are contract topics, not a demand to create configuration, a documentation site or every documentation view in every repository. Preserve deliberate existing paths. For a new repository without conventions, a useful starting vocabulary is `docs/product/<capability>/README.md`, `docs/architecture/<capability>/README.md` and `docs/features/index.md`, with maintained indexes. Use only destinations the task needs.

Keep validator code in the owning local skill or repository tooling. Product-specific labels, terminal feature names, commercial rules and runtime commands do not belong in the public foundation. Preserve structural and semantic requirements during consolidation; moving instructions must not silently remove their executable gates.

## Compose one local role

Install `technical-writer` through the Skills CLI at a reviewed full source commit and commit the CLI-generated root `skills-lock.json` alongside the canonical imported skill. Follow the repository's client-mirror tooling. Never hand-edit the imported base or manufacture a lock entry.

A local role can retain its own name and declare the relationship:

```yaml
---
name: project-technical-writer
description: Apply the shared Technical Writer to this project's documentation and implementation-impact checks.
metadata:
  inherits: technical-writer
---

Read [Technical Writer](../technical-writer/SKILL.md) and
[the local documentation contract](references/project.md) first.
Select the shared audience guides needed for the requested task and combine
them with the local paths, language, consequences and validation commands.
```

`metadata.inherits` records composition; it is not an agent-client inheritance engine. The explicit read performs composition. The Architect inheritance checker is specific to Architect and must not be presented as validation for this role.

The shared description supports automatic discovery. When a repository requires documentation-impact checks for every implementation task, its `AGENTS.md` or engineering workflow should route to the installed role explicitly. Metadata alone does not guarantee that an agent will invoke it.

## Replace existing local documentation skills

Perform this only as an authorized consumer migration, after the shared change has been reviewed:

1. Inventory the existing product, technical and catalog entrypoints, references, scripts and callers. Separate reusable guidance from local policy before deleting anything.
2. Install the reviewed immutable base through the Skills CLI and verify the imported files and generated lock. Do not remove working local entrypoints before their replacement exists.
3. Compose one local documentation role around the base. Retain the project's documentation destinations, language, status labels, commercial vocabulary, consequence checks and validator behavior in its local contract and tooling.
4. If scripts move, update every caller in repository instructions, skills, package scripts, CI, tests and generated client projections. Keep aliases only when a real compatibility requirement needs them.
5. Replace routes to the superseded skills with the new role, regenerate client mirrors, run local validators and check that every former workflow still has an entrypoint and its required gates.
6. Remove superseded local guidance only after the new role covers it. Retain translation and executable-tour workflows under their own owners; consolidate their documentation obligations through explicit routing.

A shared-foundation change does not itself authorize a consumer migration. Pin updates deliberately; installed consumers remain on their reviewed commit until updated.
