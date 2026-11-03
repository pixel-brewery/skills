# Interaction, states and adaptation

Read for forms, responsive layout, accessibility, state coverage or motion. Work through the actual components in the selected surface; a static screenshot does not prove interaction.

## Main task and state coverage

Trace the user's path from entry to completion. Every visible action must have meaningful behavior or an explained disabled state. Keep selection visible without hovering, retain input after validation failures and give the user an understandable recovery path.

For each asynchronous or editable region, identify states that can actually occur:

| State | Expected experience |
| --- | --- |
| Loading | Explain what is pending with the documented busy/loading component or state; prevent unintended duplicate submission |
| Empty | Distinguish no data from no search matches or missing access; offer the appropriate next action |
| Error | Explain the failed task, preserve recoverable work and expose retry or another real way forward |
| Success | Make the completed change visible; retain context rather than relying only on a disappearing notification |
| Unsaved or invalid | Show what needs attention, associate errors with fields and provide the actual save/revert behavior |
| Partial, stale, conflict or offline | Include only if supported by the real flow; explain what remains valid and the available recovery |

Use documented Mosaik components and props, including `BusyState`, `EmptyState`, `ErrorState` and `SuccessState` when suitable. Do not implement offline queues, optimistic writes or conflict resolution solely to complete this checklist. In a prototype, distinguish demonstrated states from real backend behavior.

## Keyboard and accessibility

Use meaningful headings and landmarks, persistent field labels, accessible names for icon actions and explicit selected/expanded/error feedback. Check the actual rendered control rather than assuming a wrapper or theme makes the complete flow accessible. Keep error messages understandable without color alone.

Exercise the main task with Tab, Shift+Tab and the component's documented activation/navigation keys. Check visible focus, focus order, overlay opening and dismissal, focus return and absence of keyboard traps. Test custom content, slotted actions and portals as part of the flow. Follow the project's accessibility target and report observed contrast or component defects rather than asserting compliance from a checker pass.

## Responsive behavior

Start from the content priorities and existing breakpoints. Keep the primary task usable at the narrowest supported width, a useful intermediate width and desktop. Check wrapping, long translations and values, zoom, overlay placement and touch operation. Do not simply shrink the desktop canvas.

Allow flex/grid children to shrink where appropriate, move supporting panels when space runs out and preserve action discoverability when navigation collapses. If a dense table needs horizontal scrolling, contain it in the table region rather than making the whole page scroll. Preserve meaningful columns or use a documented compact pattern. Hover-only information and tiny icon targets need a keyboard/touch equivalent.

On a fixed-size canvas, demonstrate the claimed layouts with separate boards or supported frames; do not claim a responsive implementation from one scaled image. In Studio, preserve a page's design and use its supported breakpoint frames according to the current authoring rules.

## Motion

Use motion to explain feedback, state changes or spatial relationships, within the current Mosaik components and project stack. Honor reduced-motion preferences and keep content and actions available without animation. Avoid perpetual movement around the main task and layout shifts that move an action while the user operates it. A request for a more expressive interface does not require another animation library.

## Evidence

Record the surface, widths/modes and meaningful states actually exercised, keyboard actions and remaining limits. Run static checks as supporting evidence; they cannot verify screen-reader output, contrast, touch behavior or a successful end-to-end task by themselves.
