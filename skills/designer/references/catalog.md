# Catalog and MCP server

The `mosaik` MCP server holds the component documentation, the Studio templates and recipes, the framework guides and the theme tools. Its public tools read documentation or return local artifacts. They do not save, publish or run models.

## Connecting

The endpoint is `https://beta.mosaik-api.breadstone.de/api/mcp`.

```bash
claude mcp add --transport http mosaik https://beta.mosaik-api.breadstone.de/api/mcp
```

```bash
codex mcp add mosaik --url https://beta.mosaik-api.breadstone.de/api/mcp
```

A newly configured server is available only after the client reconnects. The Beta catalog is a deployed snapshot, so compare it with the source when working on unreleased components in the Mosaik repository.

## Before composing, on any surface

1. `get_studio_authoring_rules` for the design contract.
2. `list_studio_templates` and `list_studio_recipes` for the task. For a specific UI detail, also follow [pattern search](#search-for-the-ui-pattern). Reuse what fits, and inspect it with `get_studio_template`, `get_studio_recipe` and `get_studio_recipe_options`.
3. `search_components`, `find_similar_components`, `get_component_docs`, `lookup_component_api` and `get_component_anatomy` for the components involved.
4. `get_framework_guide`, `get_starter_template` or `get_inline_boilerplate` when writing code.
5. `get_token_schema`, `create_theme`, `get_theme_examples` and `validate_theme` when a theme is involved.

Keep the IDs you used and name them in your report. A template you looked at and rejected is worth naming too. Compare the returned API with the installed package version before using a component or property. The deployed snapshot does not choose a new product theme or authorize a package upgrade.

For new ideas or composition decisions, use those contracts to compose real components instead of inventing an API or reproducing a visual reference with CSS. If the catalog fails, retry once and report the exact failure. Only maintenance already established by documented installed sources can continue offline when local rules permit it; new design decisions remain pending. [Project integration](project-integration.md) defines the stricter mandatory consumer contract, which pauses every dependent design decision on failure.

## Search for the UI pattern

When a request concerns a detail within a screen, search for that detail separately from its host. Query `list_studio_recipes` without a category filter so a pattern can turn up in a card, illustration or other surface. Use terms for the visible relationship and its domain, including common synonyms and short queries in the catalog's terminology. A result list for the host or a single wording cannot establish that the detail has no precedent. If a promising query fills the result limit, refine it or check the next page.

For example, for a colored direction icon beside a signed percentage in a table, search for market quotes or a market ticker as well as trend indicators. `recipe-bento-card--market-ticker` embeds `recipe-illustration-stats-ticker--market-quotes`, where the icon and percentage share the same semantic color. Open promising variants and any embedded recipes needed to verify the detail. Reuse the matching composition at the requested scale, keeping the host's layout and workflow. If none fits after this search, report the terms and closest matches before composing from documented components.

## Conflicting catalog evidence

The catalog is evidence, not permission to violate [the component boundary](compliance.md) or the installed API. Check option schemas and component/API documentation before copying an example; do not copy deprecated Stack, handmade surfaces/badges or undocumented prop/event meanings. Report a conflicting or stale example and resolve it from verified catalog evidence and the installed contract. If a material conflict remains unresolved, pause that design decision and continue independent work. The mandatory live consultation still applies; remembered APIs or an invented replacement do not resolve the conflict.

## Studio and IElement trees

For Mosaik Studio, the output is an `IElement` tree, not markup. The authoring rules are binding there:

- Only documented `mosaik-*` tags, properties and slots
- Text in `props.text` of `mosaik-text`, labels in the documented label properties
- Theme tokens for colors, spacing and radii, never hexadecimal colors
- Existing recipes with their typed options, keeping `recipeId` when composing instances
- Only catalog icon names

Validate the composed tree with `validate_design_tree`, then export with `render_design_tree` or `create_studio_project`. Design changes are proposals: only the Studio client executes them, after validation and approval.

## Using the catalog on other surfaces

A Claude Design canvas or framework code is not an `IElement` tree, so `validate_design_tree` does not apply there. Use the templates and recipes as the composition to follow, and say in your report that the tree validation was not run and why. Run the surface's source checker plus [the compliance evidence pass](compliance.md) and browser checks; these do not become equivalent to a complete tree-schema validation.
