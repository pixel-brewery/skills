# Product handbook

Use for building, synchronizing or auditing feature-oriented explanations for users, product owners, support and implementation partners. Resolve the actual product root, principles, index and language through the local documentation contract.

## Feature ownership and placement

Name the feature after the reader's goal and mental model. Keep a stable feature entry page, adding capability pages only for independently understandable workflows, rules or substantial variants. A backend service, frontend package, database table or job can provide evidence for one feature; none is automatically its documentation destination.

Place the canonical explanation with the feature that owns the initiating action and business result. Link another feature when the reader needs its independent behavior. For a cross-feature automation, follow the original business trigger rather than duplicating its description under every resulting task, message or document.

Keep source mechanics and engineering operations in technical or operational documentation. Exact routes, permission keys, statuses and payload formats belong in product prose only when they are a real user, support or integration contract. Do not expose classes, dependency injection, source paths or package boundaries as product explanations.

## Reconstruct behavior

For a build, inventory capabilities and user questions before choosing pages. For synchronization, apply the same trace to all behavior touched by the task. For an audit, use these questions against the requested scope:

| Topic | Questions the reader must be able to answer |
| --- | --- |
| Purpose and scope | What problem does this solve? What can and cannot be done? |
| Actors and access | Which roles, permissions, tenant settings or subscriptions apply? What happens when access is denied? |
| Entry points | Which action, API call, import, event, webhook or schedule starts the behavior? What must already exist? |
| Workflow | What happens now, what happens later, and what visible result follows? |
| Automatic consequences | Which tasks, records, documents, notifications, messages or related workflows are created, changed or removed? |
| Configuration | Who can change a setting, at which scope, with which default, effect and effective time? |
| Rules and states | Which input or state selects a branch? Which transitions are allowed, terminal, reversible or forbidden? |
| Exceptional cases | What happens with missing data, invalid input, stale state, conflicts, deletion, cancellation, downgrade or an external failure? |
| Recovery | What can be retried, resumed, restored or reconciled? What remains after partial success, and when is support needed? |

Read visible UI wording, contracts and access guards, domain services and policies, listeners, jobs, persistence and integrations as applicable. Use focused tests as executable examples and verified runtime behavior for uncertainty that static evidence does not resolve. Do not invent a rationale merely because a branch condition is known.

## Write for the reader

Lead with purpose and observable behavior. Explain prerequisites before the step that depends on them and put exceptional behavior beside the workflow it changes. Use decision or transition tables when prose would obscure conditional behavior.

Write current behavior directly. Plans, proofs of concept, implementation reports and changelog narration are separate artifacts. Preserve exact public labels in the established documentation language. Do not fill optional sections with general advice or mark a capability complete from infrastructure alone.

This is a composition aid, not a required set of empty sections:

```markdown
# <Product feature>

<Purpose and outcome in one paragraph.>

## Capabilities

- <What the reader can accomplish.>

## Actors and prerequisites

<Roles, permissions, configuration, data and availability conditions.>

## <Workflow>

1. <Trigger or user action.>
2. <Observable behavior and automatic consequences.>
3. <Resulting state and available next action.>

## Configuration and decision rules

| Condition or setting | Scope and effective time | Behavior or exception |
| --- | --- | --- |

## States and exceptional cases

| Starting state or failure | System behavior | Result and recovery action |
| --- | --- | --- |

## Related capabilities

<Links to independent behavior the reader needs.>
```

## Synchronize and verify

- Search by product language, UI labels, statuses, permissions, routes and configuration. Update every affected capability page and directly related stale claim, including removals.
- On a rebuild or migration, finish and verify replacement coverage before removing superseded canonical pages. Repair inbound links and add the feature to its index only when the entry is usable. Follow the local contract for explicitly retained historical material; do not leave competing current handbooks.
- Check that a product owner can validate each rule, support can explain the observed result and recovery, and a customer can understand the page without repository knowledge.
- Reverify retained claims, conditional branches, limits and side effects. Run the local product-structure and link/anchor validators. If the product contract remains accurate, report the concrete reason for no edit.
