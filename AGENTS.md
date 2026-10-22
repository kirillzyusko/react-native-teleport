# Repository instructions for agents

These instructions apply to the entire repository. Follow direct user or maintainer instructions when they are more specific.

- Preserve the existing issue template structure and the pull request template's top-level headings and order. Within pull request bodies, remove unaffected Changelog subsections, add subsections for affected areas such as Docs or E2E, and use `###` case headings within Screenshots as described below. Do not modify template files unless explicitly requested.

## GitHub issues

- Create a GitHub issue only when the user explicitly asks for one. Diagnosing a problem, discussing a feature, or drafting an issue does not authorize publishing it.
- Never create a blank issue or use an ad-hoc issue body. Bug reports must use `.github/ISSUE_TEMPLATE/bug_report.yml`.
- Feature requests belong in [GitHub Discussions (Ideas)](https://github.com/kirillzyusko/react-native-teleport/discussions/new?category=ideas), as configured in `.github/ISSUE_TEMPLATE/config.yml`. There is no feature-request issue template. Publish a discussion only when the user explicitly asks for that action.
- Read the bug-report form and issue-template configuration immediately before drafting or creating an issue so the current versions are used.
- Preserve every form field label, checkbox option, and their order. Replace instructional text with concrete information; do not submit template prompts or empty sections. Mark submission checkboxes complete only when supported by evidence.
- If requested information is unavailable, write `Not provided` and briefly identify what is missing instead of deleting the field or guessing. Keep the report as a draft until required fields and submission checks can be completed.
- Apply the metadata declared by the form: currently the `bug` label and no default assignee. If a non-interactive body file is required, render the YAML form's labels as Markdown headings, preserve its checkbox options and field order, and supply declared labels and assignees explicitly.
- Before submission, search for an existing issue that covers the same problem or request. Do not create a duplicate; report the likely duplicate to the user instead.
- Do not create an issue if it does not fit an existing template. Ask the user or maintainer whether a new template should be added or which existing template to use.

### Bug report evidence

- For every bug report or bug-fix request, check whether a runnable reproduction is provided. If it is missing, explicitly ask the reporter for one. If it is already provided, use and verify it instead of requesting it again.
- Request a minimal runnable project, a focused example change, or a self-contained snippet with the exact target file, setup commands, and interaction steps.
- Try to prepare and verify a minimal runnable reproduction. It may be:
  - A minimal React Native project supplied by the reporter containing only the dependencies, configuration, and code needed to reproduce the bug.
  - A focused change in the current checkout's `example/` application.
  - A self-contained snippet that can be pasted into `example/` and reproduces the bug without extra dependencies.
- If you have a reproduction, remove unrelated code and private data from the report, verify the documented setup, and document the exact steps. Put symptoms and supporting evidence in **Bug summary**, the library version in **Library version**, `react-native info` output in **Environment info**, and snippets with their target files, setup commands, and interactions in **Steps to reproduce**. Put the GitHub repository link in **Reproducible example repository** and identify the relevant branch or commit in **Steps to reproduce**.
- The form requires a **Reproducible example repository** link; a snippet alone does not satisfy that field. If it is unavailable, keep the report as a draft and explain the gap in **Bug summary**, along with known symptoms, attempted steps, logs, and relevant evidence. Put any proposed patch there and label it unverified. Distinguish observed facts from hypotheses.

### Issue preflight

Immediately before creating an issue, verify all of the following:

1. The user explicitly requested issue creation.
2. The issue is not a duplicate.
3. The correct current template was selected.
4. The required reproducible-example repository link, exact steps, code, library version, and environment information are included.
5. Every form field and submission checkbox is present, and required fields and checks are completed with verified information.
6. The form's declared labels and any assignees are included; do not invent an assignee when none is configured.

If any check fails, do not create the issue.

## Repository layout

- `src/`: TypeScript public API, components, hooks, native and web implementations, Fabric specs, and unit tests.
- `ios/`: iOS implementation in Objective-C/Objective-C++.
- `android/`: Android implementation in Kotlin and native build integration.
- `common/cpp/`: shared Fabric component descriptors, shadow nodes, state, and portal registry.
- `example/`: example application for iOS, Android, and web, including Jest rendering tests.
- `jest/`: public Jest mock exported as `react-native-teleport/jest`.
- `e2e/`: Maestro flows, screenshot comparison tooling, and test evidence.
- `docs/`: Docusaurus documentation site.

## Development workflow

- Use the repository-pinned Yarn 3.6.1 and Node version from `.nvmrc`; do not switch package managers or regenerate lockfiles unnecessarily.
- Always work in the current repository checkout. Do not create clones, repository copies, temporary checkouts, or Git worktrees. If a branch switch is required while local changes exist, prefer stashing, switching in place, and then popping the stash.
- Inspect the relevant implementation and nearby tests before making a change. Keep edits focused and preserve unrelated worktree changes.
- Do not edit generated build output in `lib/`; edit sources under `src/` and rebuild when necessary.
- Add or update focused tests for behavior changes when practical.
- Follow the existing style and formatting configuration. Avoid unrelated formatting churn.

Run the checks relevant to the changed surface:

```sh
yarn typecheck
yarn lint
yarn test
```

For native or example-app changes, also run the narrowest applicable platform build or test. If a required check cannot be run, state that clearly in the handoff.

For changes to the public API or Jest mocks, also run `yarn example test` to verify example rendering and mock compatibility. For web implementation changes, verify the example's web build with `yarn example build:web`.

### Local reproduction and verification

- Before diagnosing or changing code for a bug in an application that Argent can run or inspect, reproduce it with Argent first. Capture exact steps and interactions, relevant logs and errors, screenshots or recordings, rendered UI and current state, accessibility/UI/component hierarchy, interaction targets, and relevant runtime or network state when available.
- Trace how the affected code executes and test hypotheses against that evidence. Suspicious-looking code alone is not a diagnosis. If the app, allowed target, account, data, or environment is unavailable, state exactly what could not be observed and why, and distinguish verified evidence from inference in subsequent static analysis.
- Reuse an existing Argent flow when it covers the path. When a path is likely to be repeated, especially a setup or navigation sequence of three or more interactions, start recording before the first walkthrough and save a reusable flow in `.argent/flows/`. Use stable semantic selectors and explicit screen-state checks, repair flows when the app changes, replay the completed flow end to end, and use it for subsequent reproductions and test passes. Report the saved flow path and replay result.
- Use Metro port `8085` for the teleport example: `yarn example start --port 8085`. Use the same port for the app's development-server connection, Argent debugger calls, and device port forwarding.
- For device-based verification on this computer, use only existing iPhone 17 Pro devices running iOS 26.5, iOS 26.2, or iOS 27.0. Do not create, boot, or use another device, simulator, or emulator unless the user explicitly authorizes it. If an allowed device is unavailable, report that limitation instead of substituting another target.
- For Android builds on this computer, always pass `-PreactNativeArchitectures=arm64-v8a` explicitly to Gradle, including when React Native is an included composite build. Do not compile other ABIs unless the user explicitly requests them.
- Reuse the existing shared build directory and preserve its caches. Do not delete standard project build directories, Xcode DerivedData, Gradle caches, dependency caches, or other reusable incremental build state when a task finishes.
- Remove only additional task-specific build directories, temporary DerivedData locations, and disposable generated artifacts created for the task. Keep screenshots, recordings, logs, reports, and other linked evidence in a stable user-facing location before reporting them. Do not delete, move, rename, or overwrite reported evidence unless the user explicitly asks.

## Pull requests and commits

- Follow `.github/PULL_REQUEST_TEMPLATE.md` when preparing a pull request. If its instructional comments conflict with the section responsibilities below, follow these rules while preserving the top-level headings and order.
- Keep pull requests small and focused.
- Write in the maintainer's concise, direct style: use concrete facts, explain the problem in enough detail to understand it, and omit filler, generic claims, repeated summaries, and AI boilerplate. Use these PR descriptions from the maintainer's `react-native-keyboard-controller` repository as style references; the current rules below govern section contents:
  - [#1304](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1304)
  - [#1047](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1047)
  - [#1016](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1016)
  - [#257](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/257)
- In **📜 Description**, summarize the PR's idea and resulting behavior in one or two sentences. Put reproduction steps, implementation reasoning, and alternatives in **💡 Motivation and Context**.
- In **💡 Motivation and Context**, describe the exact steps that trigger the bug, the observed and expected behavior, why the chosen solution addresses it, and which alternatives were considered and why they did not fit. Include only alternatives actually considered; do not invent a comparison to fill the section. Link the issues and PRs this change fixes, closes, or supersedes, using `Fixes` or `Closes` where appropriate and explaining related PRs' relevance.
- For a bug-fix pull request, include runnable reproduction code: a minimal React Native project, a focused example change, a regression test that fails without the fix, or a self-contained snippet that reproduces the bug when pasted into `example/` without extra dependencies.
- Verify the reproduction against the unfixed code, then run the same steps or test with the fix. In **💡 Motivation and Context**, link to the reproduction at a specific commit, identify the reproduction files included in the pull request, or include the snippet and where to paste it. Document setup commands, exact interaction steps, the affected platform and versions, the observed and expected behavior, and the before-and-after results there.
- In **📢 Changelog**, briefly describe changes by file: name the affected files and what was added, moved, or fixed. Group related files when that keeps the list concise. Keep only affected platform or language subsections (`JS`, `iOS`, `Android`); remove unaffected ones instead of writing "No changes". Add appropriate subsections such as `Docs` or `E2E` when those areas change. Remove empty placeholder bullets.
- In **🤔 How Has This Been Tested?**, include only a list of device models, their OS versions, and whether verification was performed manually or by an agent, using the format `Device model (OS version/manual or agent)`. Identify simulators or emulators as such. Do not list unit-test, lint, type-check, or other CI results; CI reports those checks. If no device verification was performed, state that and explain why.
- Always attach before-and-after screenshots from the verification listed above in **📸 Screenshots (if appropriate):** as visual confirmation of the changes. Use the same scenario and device for both, and label each attachment with before/after, the device model, and OS version. Recordings may supplement the screenshots and must also show before and after.
- Prefer side-by-side `Before` / `After` tables for screenshots and recordings. For videos, use this format with real attachment URLs:

  ```markdown
  | Before                                      | After                                      |
  | ------------------------------------------- | ------------------------------------------ |
  | <video src="BEFORE_ATTACHMENT_URL"></video> | <video src="AFTER_ATTACHMENT_URL"></video> |
  ```

- When comparing multiple cases, add a descriptive `###` heading and a separate before-and-after table for each case within Screenshots. Cover each issue fixed, distinct interactions, and relevant existing behavior that should remain unchanged; include before-and-after evidence for those unchanged cases too.
- For optimizations, also attach profiler sessions from before and after the change in **📸 Screenshots (if appropriate):**, captured using the same workload, device, and profiling configuration.
- In **📝 Checklist**, preserve the template's existing items, wording, and order. Only mark existing checkboxes as complete when supported by evidence; leave pending items unchecked. Do not rewrite, remove, or add checklist items or append explanations to them.
- Do not open a bug-fix pull request without a verified runnable reproduction. If it is unavailable, prepare a bug-report draft with the known evidence and any unverified proposed patch in **Bug summary**. Create the issue only if the user explicitly asks and the report satisfies the issue preflight above. Do not claim the fix is verified.
- Use Conventional Commit types documented in `CONTRIBUTING.md`: `fix`, `feat`, `refactor`, `docs`, `test`, or `chore`.
- Do not commit, push, open a pull request, publish a release, or create an issue or discussion unless the user explicitly asks for that action.
