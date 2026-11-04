---
name: technical-writer
description: Build, synchronize, audit and migrate product handbooks, portable technical documentation and consolidated feature catalogs from verified implementation. Use for documentation work and implementation documentation-impact checks, including changed workflows, contracts, configuration, permissions, automation, availability and limits. Follow the project's documentation contract; UI translation catalogs and executable guided tours retain their own owners.
---

# Technical Writer

Maintain three views of the same capability: what users can do, how the capability can be implemented, and which implemented outcomes a customer can compare. Investigate the behavior once, then write each view for its audience without duplicating its canonical explanation.

Use this foundation directly with the repository's documentation conventions, or through a local derived skill. Read applicable `AGENTS.md`, documentation principles, indexes and the local documentation contract first. [Project integration](references/project-integration.md) defines what belongs in that contract and how to adopt this foundation without losing existing rules or validators.

## Select the outcome and mode

| Documentation view | Reader's question | Read when applicable |
| --- | --- | --- |
| Product handbook | What triggers this behavior, what happens, and which conditions or exceptions apply? | [Product handbook](references/product-handbook.md) |
| Technical handbook | Can an implementer reproduce the contracts, guarantees and failure handling without the original repository? | [Technical handbook](references/technical-handbook.md) |
| Consolidated feature catalog | Which complete customer capabilities exist, with which availability and limits? | [Feature catalog](references/feature-catalog.md) |

Load only the guides needed for the requested work. An implementation-impact check considers all three views, but reads a guide in depth only when that view is affected or uncertain. A request for one page does not imply a complete handbook rebuild or a new catalog.

| Mode | Work |
| --- | --- |
| Check | Inspect the task diff and decide each view's impact; a concrete no-change reason is a valid result. |
| Build | Reconstruct the requested feature or inventory from evidence when no trustworthy baseline exists. |
| Synchronize | Update every materially affected claim, including removals, renamed behavior and changed guarantees. |
| Audit | Compare the requested scope with implementation and report confirmed gaps. Apply corrections when requested or already authorized by the implementation task. |
| Migrate | Reverify and move the requested documentation, repair inbound links and indexes, then remove superseded canonical pages when replacement coverage is complete. |

Preserve the user's requested mode. Reviews and questions stay read-only unless changes are authorized. Missing documentation discovered during a check does not authorize an unrelated audit, product change, release or publication. Preserve unrelated work and deliberate layouts; directory migration is a separate scoped action.

## Establish evidence and ownership

1. Use source code, executable configuration, schemas, generated contracts, migrations, focused tests and verified runtime behavior as evidence. Existing prose is a search lead until reverified. Resolve contradictions before repeating a claim; distinguish a tested guarantee from an inferred or unverified one.
2. Start at the user's trigger and outcome. Trace the applicable UI, API, service, policy, persistence, job, event and provider boundaries. Check all participating layers rather than turning repository packages into documentation features.
3. Identify the canonical behavior owner, consumers and active execution path. Look for equivalent implementations, legacy paths and bypasses before describing one path as authoritative.
4. Keep a task-local evidence map: actor and trigger; prerequisites and configuration; inputs and decisions; state and output; automatic consequences; failures and recovery; owning implementation and verification. Use it across the affected documentation views; it need not become another committed report.
5. Distinguish current implementation, an accepted target architecture and a migration contract. Label their status using the project's vocabulary. Plans, incomplete paths and desired guarantees never become implemented product or catalog claims.
6. Explain evidenced decision rules and causality. A technical condition does not establish its business rationale; report a missing rationale or material decision rather than inventing it.

For synchronization, start with the complete task-scoped diff and follow affected contracts and consequences. Broaden to an entire feature or product inventory only for the requested build or audit. For a full inventory, inspect actual navigation and workflows, contracts, policies, persistence, background work and integrations; a project list is insufficient evidence of product coverage.

## Check the complete consequence chain

For each affected capability, investigate the relevant topics below. Record non-applicable topics in working notes instead of adding empty published sections.

- Actors, authenticated context, permissions, resource ownership and tenant isolation.
- Configuration scope, defaults, prerequisites, feature gates, entitlements, plans, quotas, credits and rate or count limits; when configuration changes take effect.
- User actions, API calls, imports, events, schedules and automatic follow-up work.
- State transitions, concurrency, transaction boundaries, idempotency, duplicates, retries, ordering and reconciliation.
- Notifications, tasks, documents, events, webhooks, automatic email, templates and external integrations. Verify real emission and delivery paths; a registry entry alone proves no consequence.
- Empty or missing data, invalid input, denied access, cancellation, deletion, archival, retention, restoration, downgrade, partial success, external failure and recovery.
- Compatibility, migration, rollback, operational ownership and observable acceptance evidence.

Use the project owners for translations, executable tours, API generation and generated documentation. Synchronize their explanations when behavior changes; editing locale resources, tour definitions or generated artifacts follows the owning workflow and task authorization. Regenerate generated pages from their source rather than maintaining a parallel manual copy.

## Synchronize the documentation views

1. List changed observable behavior and technical contracts, including renames and removals.
2. Search all affected views by product terms, visible wording, states, permissions, configuration, routes, events, models and related outcomes. Follow inbound links and cross-feature consequences, not only the first match.
3. Decide separately for each view:

   | View | Update when |
   | --- | --- |
   | Product | A workflow, rule, prerequisite, visible result, limit or recovery path changes. |
   | Technical | Ownership, a contract, guarantee, state, security boundary, configuration, integration, runtime, migration or verification obligation changes. |
   | Catalog | A complete customer capability, material subfeature, name, availability or commercial limit changes. |

4. Update all affected pages and catalog entries in the same authorized task. Correct directly related stale claims, repair links and indexes, and remove obsolete guarantees. Do not advertise a capability before its complete usable path exists.
5. Preserve one canonical home per explanation. The handbook owns product behavior, the technical handbook owns implementation contracts, and the catalog summarizes capabilities. Cross-link independent behavior instead of copying it.
6. Avoid artificial edits: a refactor may need a technical implementation-map update while leaving product behavior and the catalog accurate; a bug fix may restore an already documented contract. Report the actual impact and reason.

## Verify and report

- Re-read changed claims against their implementation evidence and the applicable audience guide. For technical pages, perform the portability test in the technical guide; structural validity alone cannot prove completeness.
- Check changed terminology, contradictory claims, indexes, local links and heading anchors. Search for references to removed paths and capabilities before declaring a migration complete.
- Run the documentation and catalog validators named by the local contract, plus the repository's applicable checks and `git diff --check`. Keep project-specific validators with their owning project; this foundation does not replace them with a weaker generic check.
- Use the established documentation language, exact public contract identifiers and verified public plan names. Keep credentials, private environment values and customer data out of publishable documentation. External sharing follows the repository's recipient and publication rules.
- Report the affected features and outputs, material behavior now covered, evidence and checks actually performed, and unresolved gaps or decisions. For unchanged views, give a concrete no-change reason. Keep this proportional to the task; do not impose an extra ledger or report format.
