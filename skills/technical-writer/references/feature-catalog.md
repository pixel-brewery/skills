# Consolidated feature catalog

Use for checking, building, synchronizing or auditing the customer-facing capability inventory. Resolve the catalog path, language, exact metadata labels, public plan names, commercial evidence and deliberate ordering endpoints from the local contract.

## Evidence and inclusion

Maintain one consolidated Markdown catalog suitable for an expandable comparison table. Keep it distinct from a product manual, architecture inventory and pricing matrix. Do not create feature subpages in its catalog directory.

Include an outcome when a customer, administrator, operator or integration partner can use it or observe its automatic result; it solves a recognizable product problem; and the complete usable path exists with its required access and ownership rules. Describe outcomes in customer language, without packages, classes, database models or source mechanics.

Exclude plans, proofs of concept, commented or seeded placeholders, infrastructure without a usable product path and inferred commercial promises. Broad qualities such as access control, accessibility or multilingual behavior qualify only when supported by a concrete meaningful customer capability. Do not market every shared UI convention as a feature.

For a full build or audit, inspect all relevant evidence surfaces rather than treating a workspace project list or menu as the product taxonomy:

- Navigation, routes, commands, dialogs, public pages, settings and visible copy.
- Contracts, controllers, services, policies, listeners, jobs, persistence and focused tests.
- Permissions, ownership, roles, feature gates, billing policy, entitlements, quotas, credits and configurable limits.
- Events, webhook emission and delivery, automatic mail and template selection, scheduled work, retries, idempotency and integrations.
- Deletion, cancellation, downgrade, restoration, empty/error states and partial success when they materially affect the capability a customer can evaluate.

Use handbook prose to locate relationships and vocabulary, then verify material claims against implementation. For checks or synchronization, trace the same surfaces for the task's changed behavior, including removals and availability changes.

## Classification

Use exactly three semantic levels:

1. A level-two **category** groups buyer concerns; it is not a feature-table row.
2. A level-three **main feature** is an independently recognizable capability and becomes an expandable row.
3. A **subfeature bullet** describes material functionality within that row.

Place a capability with the feature that owns the initiating trigger and business result. When an automation produces a task, message, document or log elsewhere, keep it with the originating workflow unless the resulting artifact offers an independently initiated workflow. If trigger and result remain equally split, use the feature whose business object changes state. Shared configuration can have its own feature when independently useful; feature-specific use belongs where customers experience it. Avoid duplicate capabilities across technical domains.

Default to a subfeature when behavior extends an existing trigger, workflow or outcome. Create a main feature when it is a distinct workflow or comparison criterion with multiple material capabilities supported by verified behavior. Being understandable alone is necessary, but does not automatically justify another row.

Use factual, benefit-oriented names, one concise summary paragraph and one bullet per material subfeature. Combine implementation variants with the same outcome; split abilities customers can meaningfully compare separately. Main-feature names are unique across the catalog; category names and subfeature names are unique within their respective scopes.

| Changed behavior | Catalog action |
| --- | --- |
| New independent customer outcome | Add a main feature under its product category. |
| New material action, automation, variant or consequence within an existing outcome | Add or extend a subfeature. |
| Changed access, configuration prerequisite or availability | Update the access/availability metadata. |
| Changed plan, entitlement, quota, credit, rate, count or package restriction | Update commercial availability/limit metadata. |
| Renamed or removed behavior | Rename or remove the affected entry in the same task. |
| Fix restoring an accurate claim, internal refactor, tests or invisible optimization | Make no artificial catalog edit; explain the completed check. |
| Technical foundation with no complete customer path | Do not advertise it yet. |

## Order by customer value

Order categories, main features and subfeatures by descending perceived customer value:

1. **Direct business outcome:** Creates or protects revenue, converts demand, closes business, secures payment or delivers the purchased result.
2. **Operational core:** Enables recurring customer, product, order, finance, task or fulfillment work.
3. **Time, quality and decision gain:** Automates work, prevents errors, improves decisions, makes information findable or enables meaningful analysis.
4. **Control and scale:** Governs users, security, integrations, platform operation, billing or administrative configuration.
5. **Comfort and cosmetics:** Appearance, sounds, device convenience or personal preferences without a changed business result.

Choose the highest applicable band from the entry's primary outcome. Judge the incremental capability rather than its parent's importance: sales-protecting automation may have direct business value while an administrative report remains control and scale.

Break ties by clearer user outcome before its administration, frequent and broad value before occasional or narrow value, prerequisites before dependents of comparable value, then the customer journey. Repository order, menu order, implementation effort, visual prominence, technical sophistication and delivery recency do not determine priority.

Compare every new or materially changed entry with its neighbors and re-sort the affected category. Compare a new or materially changed category with the whole list. Insert at the value position instead of appending. Keep low-value comfort functions last. A project's exact final category or feature is local policy; when that policy legitimately changes, update its rule and validator together.

## Markdown contract

Use the established language for all labels, including optional metadata:

```markdown
# <Product> feature catalog

<Short scope statement.>

## <Category>

### <Main feature>

<One concise customer-facing summary.>

- **<Subfeature>:** <Implemented capability and outcome.>
- **<Subfeature>:** <Implemented capability and outcome.>

**Availability:** <Optional material permissions, configuration or prerequisites.>

**Plan/Limits:** <Optional verified commercial availability or limits.>
```

Use headings and bullets rather than manual numbering or Markdown tables in the published catalog. Give every main feature at least one subfeature. Keep names unique and summaries factual. Omit metadata that adds no verified information; use public plan names rather than internal enum spelling.

Do not publish prices unless current executable billing policy and the customer-facing purchase path agree. Avoid placeholders, speculative promises and planned-capability wording. Access metadata covers non-commercial conditions; commercial availability and meaningful limits belong in plan/limit metadata rather than being duplicated.

## Synchronize and verify

1. List every changed customer outcome from the task diff. Search the catalog by product terms, visible wording, permissions, feature keys, states, configuration and related outcomes.
2. Decide category, main-feature, subfeature, availability, commercial-limit, rename and removal impact separately. Update every affected entry and directly related stale claim.
3. Assign the affected entries to their value bands, compare neighbors and re-sort at all affected levels.
4. Reverify complete usable paths and commercial statements. Check that no implemented capability in the audited scope was omitted because it spans several projects.
5. Check the single-file contract, heading hierarchy, summaries, bullet syntax, uniqueness and optional metadata; run the local catalog and documentation link validators and required consequence checks.
6. Report affected entries or the concrete reason the current catalog remains accurate. Structural validation cannot prove that capabilities are complete, commercial claims are true or customer-value ordering is correct; review those against evidence.
