# Technical handbook

Use for creating, synchronizing, auditing or migrating technical feature documentation. Resolve paths, indexes, exact document-status labels, generated owners and validation commands through the local contract.

## Status and placement

Distinguish three meanings explicitly, using the project's status marker:

| Meaning | Required distinction |
| --- | --- |
| Implemented current state | Described paths and guarantees have implementation evidence. |
| Accepted target architecture | The design is accepted, but may not yet be implemented. Identify the implementation gap. |
| Migration contract | Define starting state, target, transition, compatibility window, rollback and provable completion. |

A proposal or proof of concept does not become canonical by receiving a status label. Keep unaccepted options and transient analysis outside the current technical handbook.

Organize by capability and outcome, with a stable feature entry. Reuse the product feature's slug when it owns the capability. Give a cross-feature platform responsibility its own narrowly named capability when no single product feature owns it. Participating frontend, backend, database, framework, package and deployment boundaries belong inside the explanation rather than becoming generic feature buckets.

Keep the technical index complete. Add sibling pages for independently implementable contracts, substantial variants or migrations that would make the entry difficult to scan. Preserve established project destinations; do not introduce scattered root-level technical pages or migrate existing layouts incidentally. Product workflows stay canonical in the product handbook and are linked where needed.

## The portability standard

A page must be useful without access to the original repository:

- Define responsibilities, inputs, outputs and guarantees semantically before naming current files, classes, tables, keys, routes or providers. Put local paths and symbols in a replaceable implementation map.
- Specify public and persisted contracts precisely: meaning, version, required fields, validation, defaults, bounds, ordering, errors and compatibility where material. Use schemas or compact complete examples when prose is ambiguous.
- State runtime, framework, library and provider assumptions. Describe the consumed dependency contract and what a replacement must guarantee; a package or provider name is insufficient.
- Explain the complete success, denial, failure and recovery paths. Repository links may locate evidence but cannot substitute for the behavior a new implementation needs.
- Make material unknowns visible with their consequences. Do not invent defaults, limits, business reasons or rollback guarantees to make a page look complete.
- Define observable acceptance criteria and meaningful negative cases. Avoid pinning private classes, incidental filenames or presentation snapshots as the specification.

## Coverage questions

Apply the relevant rows end to end. Mark non-applicable topics in working notes; avoid boilerplate sections.

| Area | Implementation contract to establish |
| --- | --- |
| Goal and scope | Capability, consumers, inputs, outputs, owned guarantees and excluded responsibilities; stable contract versus replaceable choice. |
| Ownership | Canonical owners, public seams, dependency direction, composition roots, exports, callers, legacy paths and bypasses; shared framework responsibility versus project policy. |
| Contracts | APIs, events, persistence, files, queues, caches and provider ports; validation, versions, required fields, bounds, errors and generated/runtime projections. |
| Trust and availability | Authentication, authoritative context, permissions, tenant/resource ownership, feature and commercial gates; order before side effects. Client identifiers are not automatically trusted. |
| Data and lifecycle | States, transitions, retention, expiration, archiving, deletion, restoration, privacy and logging constraints. |
| Consistency | Transactions and post-commit effects, revisions, locks, concurrency, idempotency, duplicates, replay, ordering, partial failure and reconciliation. Describe read-path side effects or their guaranteed absence accurately. |
| Integrations | Real event, invalidation, webhook, mail/template, job and provider paths; scope, payload, version, delivery, retries, deduplication and operations that produce no effects. |
| Runtime and configuration | Supported runtimes and provider capabilities; configuration owner, scope, defaults and validation; activation, reconnect, cleanup and shutdown. Document secret references, never values. |
| Resource and operational limits | Timeouts, payload, memory, queue, concurrency, retry and retention bounds; logs, metrics, traces, correlation, health, alarms and safe diagnostics. |
| Failure and recovery | Public errors, side effects already committed, retry eligibility, restoration and operator responsibility; no invented atomicity across providers. |
| Compatibility and migration | Backward/forward, runtime and contract compatibility; unknown versions; migration order, coexistence, replay safety, rollback, abort and legacy removal. |
| Verification | Positive, denied, negative, conflict, partial-failure, recovery and migration cases; historical fixtures where needed; enforceable architectural boundaries and generator ownership. |

Document existing behavior faithfully. A missing desired guarantee is an implementation gap or target decision, not permission to repair production code during documentation work.

## Page composition

Use only sections that carry concrete information, while answering the goal, ownership, contract, failure and verification questions:

```markdown
# <Technical capability>

<Project document-status marker and value.>

## Goal, scope and guarantees

<Outcome, consumers, invariants and excluded responsibilities.>

## Responsibility boundaries

| Responsibility | Canonical owner | Public contract | Consumers |
| --- | --- | --- | --- |

## Architecture and execution

<Components, dependency direction, trust boundaries and data flow.>

1. <Trigger and inputs.>
2. <Validation, access and decisions.>
3. <Synchronous or transactional work.>
4. <Post-commit consequences and consumer result.>

## Contracts

<Meaning, version, schemas, bounds, defaults, errors and compatibility.>

## State, consistency and lifecycle

<Transitions, concurrency, idempotency, ownership and retention.>

## Security and availability

<Context, permission, isolation, entitlement and other policy boundaries.>

## Failures and recovery

| Failure | Detection and public error | Committed effects | Recovery |
| --- | --- | --- | --- |

## Integrations and operation

<Events, webhooks, email, jobs, providers, configuration, resource bounds
and observability; describe consequential branches explicitly.>

## Compatibility, migration and rollback

<Source/target states, order, coexistence, recovery and legacy removal.>

## Local implementation map

| Responsibility | Current path or symbol | Evidence |
| --- | --- | --- |

## Verification and open decisions

<Observable acceptance and negative cases; material unresolved decisions
with their ownership and effect on a safe implementation.>
```

Use diagrams, sequence/state tables or schemas when they remove ambiguity. Important branches still need an explanation. Do not duplicate the functional handbook, include secret values or present unsafe operational commands as routine recovery.

## Synchronize and verify

Update changed responsibilities, contracts, security boundaries, state, configuration, providers, consequences and acceptance evidence. Search by feature language and exact identifiers, including routes, models, events, errors and owning paths. Repair every affected page, index and inbound link; remove stale guarantees and document active legacy paths until they are actually retired.

Perform a portability test: with only the page and named public dependencies, can an implementer determine owners and trust boundaries, recreate contracts, implement success/denial/failure/recovery, account for operations and migration, and verify the same guarantees without guessing material behavior? Resolve or report every material gap.

Run the project's technical structure, index, document-status and link/anchor validators, and check consistency with product documentation. A no-change decision must explain why the technical contract and implementation map remain accurate.
