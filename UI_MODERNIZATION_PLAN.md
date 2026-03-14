# BlueGriffon UI Modernization Plan

## Goal
Modernize BlueGriffon to feel closer to Visual Studio Code while keeping the current editor engine and Gecko/XUL runtime stable for this cycle.

## Non-goal (This Cycle)
- No editor-engine migration.
- No Tauri runtime migration in this delivery.
- No rewrite of core editing commands.

## Two-Track Strategy

### Track A (Now): VSCode-like Shell on Current Stack
- Keep existing editor core and command system.
- Introduce a modern workbench shell:
  - left activity rail,
  - collapsible sidebar host (reusing existing decked panels),
  - center editor/tabs,
  - retained and modernized status bar,
  - command-palette style quick action entry.
- Preserve compatibility:
  - toolbar commands stay functional,
  - toolbar customization remains supported,
  - current mode/status behavior remains intact.

### Track B (Later): Tauri-Ready Architecture
- Prepare UI boundaries so shell chrome can move into a future Tauri host.
- Keep UI state and command routing modular and preference-driven.
- Use platform webviews in future migration:
  - Windows: WebView2
  - macOS: WKWebView
  - Linux: WebKitGTK
- Defer runtime migration work until current-shell modernization is validated.

## Internal Contracts
- `bluegriffon.ui.shell.mode`: `"classic"` or `"vscode"`
- `bluegriffon.ui.activity_rail.show`: `true/false`
- `bluegriffon.ui.activity_sidebar.show`: `true/false`
- `bluegriffon.ui.activity_sidebar.panel`: panel menuitem id for active sidebar target

These are internal only and must remain consistent across target branches.

## Implementation Slices
1. Plan doc + prefs contract.
2. Structural shell layout in XUL.
3. CSS tokens/visual polish for shell regions.
4. Command palette + wiring + regression fixes.

## CI Policy for This Phase
- Remote installer-only CI on target feature branches.
- Portable workflow disabled for these branches.
- Installer flow standardized to script-driven build with:
  - full-installer-first pickup,
  - NSIS fallback,
  - explicit artifact-kind marker in logs.

## Exit Criteria
- VSCode-like shell mode works without regressions in existing editor behavior.
- Classic mode can still be enabled.
- Installer workflows are green on both target branches with no `ISCC.exe` dependency failures.
