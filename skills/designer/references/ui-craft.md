# UI Craft adaptation and provenance

This skill combines the extracted Mosaik design guidance with selected design engineering workflows adapted from [educlopez/ui-craft](https://github.com/educlopez/ui-craft), reviewed at commit [`49b751742b013ebb3e0495eb7992423185f04be0`](https://github.com/educlopez/ui-craft/tree/49b751742b013ebb3e0495eb7992423185f04be0).

Adapted sources in that revision:

- `skills/ui-craft/SKILL.md`: context discovery and intent routing
- `commands/craft.md` and `commands/redesign.md`: task-led composition and preserving existing flows during redesign
- `skills/ui-craft/references/review.md` and `finish-bar.md`: evidence-based critique and visual finishing
- `skills/ui-craft/references/state-design.md`, `responsive.md` and `accessibility.md`: applicable states, input methods and adaptation

The Mosaik adaptation lives in [discovery](discovery.md), [craft](craft.md), [interaction](interaction.md), [review](review.md) and the skill entrypoint. The extracted application/canvas API guidance retains its recorded version and test scope; this adaptation does not retest or silently generalize those historical runtime claims.

## Deliberate translations

| UI Craft concept | Mosaik application |
| --- | --- |
| Discover the design system and route by intent | Resolve the target application, framework, surface, foundation sources and requested work automatically |
| Style questions, preset themes and numeric knobs | User instructions, existing product choices, then a reasoned choice among the four Mosaik themes |
| Native/headless controls and suggested libraries | Real documented Mosaik components, wrappers and registered icons |
| Composition recipes and finishing passes | Mosaik catalog templates/recipes first, then token-based composition and focused finishing |
| Review agents, gates and heuristic scores | Existing checker plus observed browser evidence; a scored rubric only when requested |
| Installer, hooks and persistent design memory | Existing client-supported invocation, project rules and maintained design sources; no UI Craft installation or new infrastructure |

No UI Craft command, MCP gate, agent or runtime dependency is required. Only the workflows relevant to the user's task are loaded. The upstream MIT notice is distributed in [LICENSE.ui-craft](../LICENSE.ui-craft).
