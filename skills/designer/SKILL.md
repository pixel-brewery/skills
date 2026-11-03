---
name: designer
description: Design, build, redesign and review Mosaik interfaces, including screens, dashboards, forms, prototypes, themes, accessibility, responsive layout and visual polish. Apply automatically to UI work when the project uses @pixel-brewery/mosaik-* packages, Mosaik canvases or Studio trees, even when the user does not name the skill. Detect the target app, framework, surface and existing foundations before selecting guidance. Also use for new interfaces when Mosaik is selected; do not migrate unrelated design systems or activate for backend-only work.
---

# Mosaik design

An interface stands on two decisions made before its first screen: the foundations it is built on, and the fact that it is built from real Mosaik components. Both are expensive to get wrong, because the mistake repeats on every screen. A rebuilt control looks right in a screenshot and has no states, no accessibility, no theme anatomy and no path into the product.

Read this before Mosaik interface work, including a new project with an interface. Keep the user's requested mode: a design question or review stays read-only unless implementation was requested. Apply the repository's local rules and architecture skill alongside this designer; it owns visual composition and interaction, while the architect owns engineering boundaries.

## Detect and route automatically

The user does not need a slash command, framework name or theme questionnaire. Infer the task from their request in its own language, inspect the actual target and load only the relevant guides. For example, “mach das mobil nutzbar” selects responsive work; “prüfe die Bedienbarkeit” selects a read-only review.

Run the bundled read-only discovery helper from the consuming repository, replacing the skill path with its actual installation location:

```sh
python3 .agents/skills/designer/scripts/discover_design.py path/to/view --json
```

Omit the target to inspect the current directory. Use [discovery](references/discovery.md) to interpret its evidence and resolve ambiguity. Read the nearest owning application and its imports before relying on workspace-wide dependencies; a monorepo may contain every framework. Inspect the reported foundation sources; the helper locates them, it does not evaluate theme modules or decide values. Preserve generated design documents and resolve their generator/configuration owner.

| Requested outcome | Load after discovery |
| --- | --- |
| New screen, prototype, dashboard, landing page or form | [Craft](references/craft.md), [interaction](references/interaction.md), and the surface guide below |
| Redesign, simplify, stronger or quieter presentation | [Craft](references/craft.md), preserving the existing content, navigation and workflows |
| Usability, accessibility or design review | [Review](references/review.md); read-only unless fixes were requested |
| Mobile/tablet adaptation, states, forms or motion | [Interaction](references/interaction.md) and the relevant surface guide |
| Typography, colors, theme or visual polish | [Foundations](references/foundations.md), [craft](references/craft.md), then the affected review checks |

Combine rows when the request spans them. Do not add a new framework, animation library or a second design system to satisfy a style reference. Design engineering techniques adapted from UI Craft are documented with [provenance and translation decisions](references/ui-craft.md).

## The three rules

1. **Foundations come first.** Settle theme, mode, color, type and shape before composing anything.
2. **Every control is a Mosaik component.** This holds on a design canvas as much as in product code, because a canvas is the blueprint the product gets built from. Native `button`, `input`, `select`, `textarea`, `table` and `dialog` elements and look-alikes made of `div`s are out.
3. **Values come from tokens.** Use `--mosaik-*` custom properties and component props. Literal colors, font names and copied sizes break the moment the theme or the mode changes.

Plain markup is right for layout containers (`div` with flex or grid, `main`, `section`, `nav`), headings and body text, code samples and diagrams. `mosaik-stack` is deprecated, so layout is native CSS.

When a need seems to have no component, search first (`find_similar_components`, [components](references/components.md)). If there is truly none, mark the element with `data-mosaik-exception="the reason"` and report it as a finding.

## Step 1: Settle the foundations

Take each value from the first source that has one:

1. **What the user said.** This is binding, even if you would choose differently. If you see a real problem with it, name the problem once in your report and still follow it.
2. **What the project already has:** `DESIGN.md`, `tools/design-md.config.json`, `provideTheme` or `Theme2` configuration, the provider of an existing canvas. A new screen does not re-decide an existing project.
3. **Your own decision.** Do not ask. Decide from the product and its audience, because a first choice is cheap to correct in one sentence and a question stops the work. Ask only when the user's own instructions contradict each other.

| Foundation | Start from | Change it when |
| --- | --- | --- |
| Base theme | The table below | Never left open |
| Color mode | Light and dark | The brief names one mode |
| Primary color | The theme's ramp | There is a brand color |
| Font | The theme's font | There is a brand font |
| Radius, stroke, spacing unit | The theme's values | The brand or the density calls for it |
| Interface language | The user's language or the product's | The brief says otherwise |

| Theme | Character | Font | Radius, stroke, unit | Primary | Fits |
| --- | --- | --- | --- | --- | --- |
| **Soho** | White canvas, near-black primary, quiet neutrals, small soft shadows, the shadcn/ui look | Inter | 10, 1, 8 px | `#171717` | Developer tools, desktop apps, B2B products, dense data. **Take this when nothing points elsewhere.** |
| **Joy** | Warm grey canvas, soft rounded shapes, ripple, floating labels | Nunito | 12, 2, 8 px | `#e91e63` | Consumer products, portals, onboarding, anything meant to feel friendly |
| **Memphis** | Neo-brutalism: cream page, ink outlines, hard offset shadows, uppercase labels | Space Grotesk | 8, 2, 10 px | `#8b5cf6` | Creative tools, entertainment, brand experiences that want energy |
| **Cosmopolitan** | Metro: white canvas, cyan accent, light display type, uppercase buttons, hairlines, faint sheen | Segoe UI, Noto Sans | 2, 1, 8 px | `#1ba1e2` | Business applications, dashboards, content-heavy products |

Prefer a base theme as it is. Every override is a deviation all later screens inherit, so each one needs a reason the user would recognize. Read [foundations](references/foundations.md) before you override a value, create a theme or write `DESIGN.md`.

State the result before you build, with the source of each value:

```text
Foundations
- Theme: Joy (decided: consumer booking portal)
- Mode: light and dark (decided)
- Primary: #0f766e (user)
- Font: Nunito (theme)
- Shape: radius 12px, stroke 2px, unit 8px (theme)
```

For implementation or a new design, record it where it survives this conversation: an authored section of `DESIGN.md` or its maintained source in a repository, a note on the canvas when there is no repository yet. Do not rewrite generated regions. In a review, report the existing foundations without creating files.

## Step 2: Read the guide for your surface

| You are working on | Read |
| --- | --- |
| A Claude Design canvas or a `.dc.html` file | [canvas](references/canvas.md) |
| Angular, React, Vue, Svelte or Lit code, or a standalone page | [application](references/application.md) |
| Mosaik Studio or `IElement` trees | [catalog](references/catalog.md) |

## Step 3: Consult the catalog

Existing templates, recipes and component docs beat invention. If the `mosaik` MCP server is available, follow [catalog](references/catalog.md) and keep the IDs you used for your report. If it is unavailable, retry once, say so plainly and continue from the local docs. Never claim a consultation that did not happen.

## Step 4: Compose from components

Use [components](references/components.md) to map each need to a component, and take props from the component's documentation rather than from memory.

Keep one solid primary action per view. Use `variant="neutral"` or `appearance="plain"` for quiet actions: `secondary`, `tertiary` and `highlight` are accents, and `danger`, `warning`, `success` and `info` mean status.

## Step 5: Verify before you call it done

1. **Run the checker** on what you built. It reports hand-built controls, literal values and the traps below. It must end clean or with reasoned exceptions.

   ```bash
   python3 scripts/check_design.py <file-or-folder>          # canvases
   python3 scripts/check_design.py --app <file-or-folder>    # also framework templates
   ```

   The path is relative to this skill. In framework templates it only looks for native controls and does not count components, so report your own count there. Claude Code can also invoke the existing `--hook` adapter after writes; see [client integration](references/clients.md). Other clients run the checker explicitly; automatic skill discovery alone does not install a write hook.

2. **Open every screen** in a browser and use it. Click everything, in both modes. A file that parses is not a screen that works.
3. **Walk [the review](references/review.md)** for usability, including applicable widths, keyboard paths and states from [interaction](references/interaction.md). A checker pass does not establish accessibility or a working flow. In review-only work, report findings instead of editing the screen.

## What to report

- The foundations with their sources
- The detected target, framework/surface and selected workflow, when these affect the result
- The catalog IDs that informed the work, or that the catalog was unavailable
- The checker's result, with its counts and every exception
- Defects you found in Mosaik itself
- What you did not look at

Report component use from the checker's counts. Do not write "only Mosaik components" unless the checker says so.

## When Mosaik itself is the problem

Reproduce the problem in the smallest possible board or page. If a documented workaround exists, use it. Otherwise report the component, the prop and the symptom as a finding for the Mosaik repository. A misbehaving component is a defect to surface, not a reason to quietly rebuild it.
