# Development

These guides are for contributors changing Markian. Integrators should start with the [usage documentation](../index.md). Read the [architecture](../Architecture.md), [style guide](../Styleguide.md), and approved [plan](../Requirements/Plan.md) before changing behavior. Current source and public declarations determine what is implemented; requirements are not a completion claim.

## Setup

Use Node.js 24 and npm for the documented development workflow. Package metadata currently permits Node.js 22.12.0 or later.

```powershell
npm ci
npm run build
npm run dev -- --port 5195 --strictPort
```

Open <http://127.0.0.1:5195/>. The demo loads prebuilt `dist` assets, not source-module editor imports. Consumers need only those prebuilt assets and an HTTP server. See [examples](../Examples.md).

Keep one stable preview URL. Identify a process occupying the port before selecting another. Stop an owned preview before rebuilding, then restart it on the same port: cached transformed distribution files must not become false validation evidence. Test servers are separate. Do not kill unrelated processes.

## Coding Principles

- Write strict TypeScript; use `unknown` and narrow untrusted boundary data instead of `any`.
- Use camelCase variables/functions and PascalCase classes/types without type-prefixed names.
- Export public types and generate declarations rather than hand-editing `dist/types`.
- Preserve ordinary Markdown; sanitized DOM is not the saved value.
- Keep DOM, state, callbacks, history, and pending work instance-local.
- Reuse the editing/parsing/sanitization foundations and shared controls instead of building parallel implementations.
- Keep host transport, credentials, authorization, file storage, and framework bindings outside the library.
- Treat document/provider content as untrusted, reject stale async results, and dispose owned resources.

File-level comments explain purpose; short function descriptions are useful when a function is not already obvious. Explain non-obvious constraints near the code. Prefer in-code explanation over new documents for small implementation details.

## Validation

Run only checks relevant to the change. Do not run full workflows unless a full run is explicitly requested. Documentation-only changes use source/content review and whitespace checks, not tests of Markdown files, examples, snapshots, or option completeness.

| Change | Minimum useful check |
| --- | --- |
| Pure Markdown/search policy | Select affected tests from `Tests/*.test.ts`. |
| Type or public-contract changes | `npm run typecheck`; build when declarations/distribution change. |
| Browser behavior or styling | Build fresh assets, then startup smoke and the smallest affected browser selection. |
| Build/distribution changes | `npm run build` and the relevant artifact/archive check. |
| Documentation only | Review against source and the documentation guide; `git diff --check`. |

Before browser validation, run startup once against the unchanged build/server:

```powershell
npx playwright test Tests/library.spec.js -g 'classic-script startup' --max-failures=1 --global-timeout=60000
```

After startup succeeds, select affected tests rather than broadening the run:

```powershell
npx playwright test Tests/library.spec.js -g 'affected test name' --max-failures=1 --global-timeout=120000
```

Stop and inspect a failing focused check or setup hang. Do not repeat the same setup timeout across the suite or increase timeouts to hide it. For UI work, check the affected theme/viewport interactions, focus, scrolling, overflow, and isolation where relevant. Defer the full matrix to a requested full run.

`npm run verify` is the full unit/type/build/browser/archive workflow, not a routine documentation check. `npm test` runs the browser suite. `npm run artifacts:check` checks distribution parity. Use the existing scripts and tests rather than adding parallel validation infrastructure.

## Distribution and Commits

`npm run build` performs strict type checking, import-boundary checks, bundle generation, declarations, bundle-registry generation, manifests, and size reporting. Prebuilt distribution is committed; consumers must not need a compiler. Source maps are not published.

### Bundled Third-Party Licenses

Root [includes.json](../../includes.json) replaces `dist/THIRD_PARTY_NOTICES.txt` and is included in the published npm/Composer package for Power UI's `GenerateLicenseBOM`. It is generated from modules in all browser bundles, including transitive dependencies and selected icon assets. Build-only tools and the external, host-provided Mermaid renderer are excluded. Entries use Asset Packagist names, exact installed versions, SPDX declarations and license-name-keyed `license_text` or `license_link` fields. License and NOTICE files are embedded when supplied by the package; declared upstream license links cover packages without local terms. Missing license metadata or terms fail generation for review.

The root `postinstall` hook refreshes the registry after `npm install`, `npm ci` and `npm rebuild` with lifecycle scripts enabled. npm's `dependencies` hook also refreshes it when commands such as `npm update` or `npm uninstall` change `node_modules`. These hooks build the module graph in memory without changing `dist`. Published prebuilt consumers skip generation because source/build scripts are not shipped. When using `--ignore-scripts` or a package manager that does not support these npm hooks, run `npm run includes:generate` explicitly. `npm run build` also refreshes the registry from the emitted bundles. Review and commit it alongside dependency or source changes; do not edit entries manually. Generation needs the full development dependencies, not an `--omit=dev` source checkout.

Run the build before a normal developer commit, including documentation-only commits as required by the repository's build policy. The opt-in `npm run hooks:install` hook refuses unstaged/partially staged build inputs and asks for review/staging of changed distribution; it stages nothing. Do not commit or create branches without a user request.

CI rebuilds on Windows/Linux and checks distribution parity. Required branch protection, publication rights, tagged Composer/npm delivery, and Asset Packagist availability are external gates, not guarantees established by a local check. The generated `dist/sizes.json` records exact asset/compression sizes and budgets; do not describe byte sizes as rendering speed.

## Documentation Maintenance

Keep the [documentation guide](../../.github/instructions/documentation.instructions.md) and repository instructions in mind when changing docs. User-facing material belongs at the top level of `Docs`; contributor-only material belongs here. The README is a short entry point with examples and links, not a second API reference.

Update configuration and API references when public contracts change, the style guide when shared patterns change, and architecture when responsibilities change. Keep future capabilities in requirements rather than documenting them as available options. Add a component/extension design document only when in-code explanation and the code guide are insufficient; link it from its owning source file.

## Further Reading

- [Code guide](Code_guide.md): source layout, ownership, and lifecycle.
- [Writing extensions](Writing_extensions.md): public extension contract and cleanup.
- [Visual editor](Components/Visual_editor.md): layout dimensions, document spacing, and responsive thresholds.
- [Toolbars](Components/Toolbars.md): floating-control positioning.
- [Mermaid extension](Extensions/Mermaid_extension.md): runtime loading, SVG styling, and safety boundaries.
- [Plan](../Requirements/Plan.md): work packages and remaining acceptance checks.