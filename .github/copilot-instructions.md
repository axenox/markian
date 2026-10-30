# Copilot Instructions for Markian

Markian is a framework-independent Markdown editor/viewer library in development. Check the current library source and public references before describing proposed APIs or distribution as implemented.

## Required Reading and Maintenance

- Before planning or changing code, read [the architecture](../Docs/Architecture.md). For any UI or styling change, also read [the style guide](../Docs/Styleguide.md).
- Update the architecture in the same change whenever module responsibilities, ownership, lifecycle, public contracts, dependency boundaries, or distribution architecture change.
- Update the style guide in the same change whenever reusable appearance, layout, controls, interaction patterns, themes, or responsive behavior change. Reuse shared classes/components rather than creating look-alike implementations.
- Keep [the configuration reference](../Docs/Configuration.md) complete in the same change whenever an editor option, default, or built-in extension changes. Include ALL available options and effective defaults. Explain the shared extension entry structure once, then give each built-in extension its own subchapter with its default configuration and local option names rather than repeated full paths.
- Consult [the implementation and migration plan](../Docs/Requirements/Plan.md) for approved scope and decisions, [requirements](../Docs/Requirements/Requirements.md) for acceptance criteria, and [README](../README.md) for library usage. Update affected guidance when decisions or behavior change.
- Keep all documentation up-to date according to [Documentation instructions](instructions/documentation.instructions.md)!

## Engineering Boundaries

- Preserve ordinary interoperable Markdown. Normalization must not silently drop meaningful whitespace, comments, unsupported content, or generated bodies. Rendered HTML is not the saved value.
- Keep host/framework integration outside the library. No AJAX/data transport, endpoint configuration, authentication, or storage logic in Markian; accept host callbacks instead.
- Use flat `on<Subject><Action>` general callbacks and rule-local tag handlers as documented in the plan, not a nested callbacks object.
- Keep state and DOM ownership instance-local. Dispatch commands and obtain the current value from the active view; avoid competing authoritative models or hidden mode switches.
- Reuse Milkdown/ProseMirror, CodeMirror, selected MDI icons, and established parsing/sanitization tools. Do not replace approved foundations or add a UI framework without a concrete need and an agreed architectural change.
- Treat document/provider content as untrusted. Guard asynchronous results against stale revisions, permission changes, and destroyed instances; release owned resources during teardown.
- Keep demo assets, global styles, and sibling-framework Mermaid imports out of the reusable library contract. Consumers must work with prebuilt assets without Node.js or a build step.
- Keep root `includes.json` synchronized with every bundled third-party dependency, including transitive packages, selected icons and CSS. This is the Power UI bundle registry consumed by PackageManager's `GenerateLicenseBOM`, not a list of build tools. Generate it with `npm run includes:generate` or `npm run build`; never hand-edit generated entries or restore `dist/THIRD_PARTY_NOTICES.txt`. Preserve exact versions, SPDX declarations and license-name-keyed `license_text` or `license_link` fields. Missing terms must fail generation, not be silently omitted. Review and commit registry changes together with dependency/source changes; when lifecycle scripts are disabled, regenerate explicitly. Keep the npm lifecycle hook and published archive inclusion working without requiring build tools for prebuilt consumers. Host-provided Mermaid is not bundled and must not be added as a Markian inclusion.
- Preserve independently deployable host adapters and the separate Core `MarkianTrait` migration. Do not alter legacy Toast UI integrations incidentally.

## Coding guidelines

- Write library source in TypeScript with `strict` enabled. Do not keep parallel JavaScript source copies.
- Avoid `any`. Use `unknown` and narrow it at boundaries such as host callbacks, configuration, and clipboard or provider data.
- Use standard TypeScript naming: camelCase for variables and functions, PascalCase for types and classes. Do not use type-prefixed variable names; the types carry that information.
- Public API types are exported and generate the published declarations. Consumers receive prebuilt JavaScript and never need TypeScript.

## Testing and Validation

- For now, run only the minimum relevant checks after every change. The user will request full testing separately. Do not run the full Playwright suite, `npm run verify`, or another full test workflow unless explicitly requested, including at the end of a task.
- Reuse [existing browser tests](../Tests/library.spec.js) and the scripts in [package.json](../package.json). Select individual unit tests or browser tests covering the changed behavior; use `npm run typecheck` when relevant. Run `npm run build` for build/distribution changes or to refresh the built assets consumed by browser tests. `npm run dev` starts the demo.
- Before browser validation, run one startup smoke test with fail-fast and a whole-run time limit: `npx playwright test Tests/library.spec.js -g 'classic-script startup' --max-failures=1 --global-timeout=60000`. Only after startup succeeds, run the smallest affected selection with `-g`, `--max-failures=1`, and `--global-timeout=120000`. Do not repeat startup unnecessarily against the same unchanged build and server.
- If startup hangs or a focused check fails, stop and inspect that failure before running more tests. Do not let the same shared setup timeout repeat across the suite, increase timeouts to hide a hang, or automatically broaden the run. Report checks performed and coverage deferred to the separately requested full run.
- Two development/test approaches are planned (see the plan's Chapter 12): the Vite dev server for work in VS Code, and an Apache-served test bench loading the built `dist` for DevMan agent handoffs. When working as the DevMan agent, never start a dev server; build and verify instead, and use only allowlisted commands.
- Avoid stale Vite servers: the demo loads built `dist` assets, whose rebuilds may not invalidate Vite's cached transforms. Stop the agent-owned preview server before rebuilding, then restart it on the same port and reload the preview. Keep one stable preview URL per workspace; do not allocate a new port after each change or leave superseded servers running. Keep test servers separate, and do not reuse a stale test server after a rebuild. Track owned server terminals so they can be restarted or cleaned up; never terminate an unrelated or unidentified process. If the intended port is occupied, identify its owner before deciding whether another port is necessary.
- For UI changes, check the affected interaction and the smallest relevant theme/viewport selection, including focus, scrolling, overflow, and instance isolation where relevant. Defer the full light/dark desktop/mobile matrix to an explicitly requested full run. Follow the style guide's verification guidance within this focused scope.
- Do not add or run tests of Markdown documentation files, their structure, examples, snapshots, or option completeness. Maintain documentation through source review and these instructions instead. Tests of the library's Markdown parsing, rendering, and editing behavior remain appropriate. Do not claim browser or production conformance from documentation review.
- Follow the plan's build-before-commit and distribution verification policy as tooling is implemented. Do not claim hooks or CI enforcement exist before they do. Never commit or create a branch unless requested.