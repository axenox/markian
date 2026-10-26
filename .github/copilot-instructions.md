# Copilot Instructions for Markian

Markian is a framework-independent Markdown editor/viewer library in development. The repository currently contains an approved interaction prototype; do not describe proposed library APIs or distribution as implemented without checking the code.

## Required Reading and Maintenance

- Before planning or changing code, read [the architecture](../Docs/Architectur.md). For any UI or styling change, also read [the style guide](../Docs/Styleguide.md).
- Update the architecture in the same change whenever module responsibilities, ownership, lifecycle, public contracts, dependency boundaries, or distribution architecture change.
- Update the style guide in the same change whenever reusable appearance, layout, controls, interaction patterns, themes, or responsive behavior change. Reuse shared classes/components rather than creating look-alike implementations.
- Keep both documents continuously aligned with the implementation. Distinguish current behavior from approved future contracts; do not rewrite plans as completion claims.
- Consult [the implementation and migration plan](../Docs/Requirements/Plan.md) for approved scope and decisions, [requirements](../Docs/Requirements/Requirements.md) for acceptance criteria, and [README](../README.md) for prototype usage. Update affected guidance when decisions or behavior change.

## Engineering Boundaries

- Preserve ordinary interoperable Markdown. Normalization must not silently drop meaningful whitespace, comments, unsupported content, or generated bodies. Rendered HTML is not the saved value.
- Keep host/framework integration outside the library. No AJAX/data transport, endpoint configuration, authentication, or storage logic in Markian; accept host callbacks instead.
- Use flat `on<Subject><Action>` general callbacks and rule-local tag handlers as documented in the plan, not a nested callbacks object.
- Keep state and DOM ownership instance-local. Dispatch commands and obtain the current value from the active view; avoid competing authoritative models or hidden mode switches.
- Reuse Milkdown/ProseMirror, CodeMirror, selected MDI icons, and established parsing/sanitization tools. Do not replace approved foundations or add a UI framework without a concrete need and an agreed architectural change.
- Treat document/provider content as untrusted. Guard asynchronous results against stale revisions, permission changes, and destroyed instances; release owned resources during teardown.
- Keep demo assets, global styles, and the prototype's sibling-Core Mermaid import out of the reusable library contract. Consumers must ultimately work with prebuilt assets without Node.js or a build step.
- Preserve independently deployable host adapters and the separate Core `MarkianTrait` migration. Do not alter legacy Toast UI integrations incidentally.

## Validation

- Reuse [existing browser tests](../Tests/prototype.spec.js) and the scripts in [package.json](../package.json). Run focused checks for affected behavior, and `npm run build` for build/distribution changes. `npm test` runs Playwright; `npm run dev` starts the demo.
- For UI changes, verify the affected interactions and light/dark desktop/mobile layouts, including focus, scrolling, overflow, and instance isolation where relevant. Follow the style guide's verification guidance.
- For documentation-only changes, validate relative links and any code examples. Do not claim browser or production conformance from documentation checks.
- Follow the plan's build-before-commit and distribution verification policy as tooling is implemented. Do not claim hooks or CI enforcement exist before they do. Never commit or create a branch unless requested.