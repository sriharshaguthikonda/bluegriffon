# BlueGriffon Modernization Plan: WebView2 Integration

This document outlines the phased plan to modernize the BlueGriffon application by replacing the Gecko rendering engine with Microsoft Edge WebView2 and migrating the XUL-based UI to web technologies (HTML, CSS, JavaScript).

## Phase 1: Initial Proofs of Concept & Setup (Completed Conceptually)

This phase focuses on validating the core technical feasibility of using WebView2 within the BlueGriffon environment and establishing basic inter-process communication.

*   [x] **Step 1: Project Setup and Build System Analysis for WebView2 Integration**
    *   [x] 1.1. Research and document requirements for WebView2 in C++ Win32 (Windows).
    *   [ ] ~~1.2. Research and document requirements for WebView2 on macOS.~~ (Skipped - Windows Only Focus)
    *   [ ] ~~1.3. Research and document requirements/alternatives for WebView2 on Linux.~~ (Skipped - Windows Only Focus)
    *   [x] 1.4. Initial analysis of BlueGriffon's build system (`Makefile.in`, `moz.build`) for incorporating new C++ files and libraries.
    *   [ ] 1.5. (User Action) Set up a minimal standalone C++ project with WebView2 on Windows **locally** to get familiar with the API (based on Microsoft's `Win32_GettingStarted` sample).
        *   [x] 1.5.a. (Alternative - Automated Build) Create standalone C++ sample (`standalone_webview2_sample/MinimalWebView2.cpp` and `CMakeLists.txt`). *(Code complete)*
        *   [x] 1.5.b. (Alternative - Automated Build) Create GitHub Actions workflow (`.github/workflows/build-standalone-sample.yml`) to build the standalone sample. *(Workflow file complete)*
        *   [ ] 1.5.c. (User/CI Action) Test the GitHub Actions workflow for the standalone sample. Expected: Workflow runs, builds the `.exe`, and uploads it as an artifact.

*   [x] **Step 2: Core Rendering Engine Replacement - Proof of Concept (Companion Window)**
    *   [x] 2.1. Identify `nsEditorApp.cpp` as an entry point.
    *   [x] 2.2. Create `WebView2TestWindow.h` and `WebView2TestWindow.cpp` to launch a separate Win32 window hosting WebView2 navigating to an external site (e.g., Bing).
    *   [x] 2.3. Modify `app/moz.build` to include the new C++ files, WebView2 SDK headers (via placeholder path `$(topsrcdir)/third_party/webview2_sdk/include`), and link necessary libraries (`User32.lib`, `Gdi32.lib`, `$(topsrcdir)/third_party/webview2_sdk/lib/x64/WebView2Loader.dll.lib`).
    *   [x] 2.4. Modify `app/nsEditorApp.cpp` to call `LaunchWebView2TestWindow`.
    *   [ ] 2.5. (User Action) Manually acquire WebView2 SDK (e.g., from NuGet package `Microsoft.Web.WebView2`) and place headers/libs in `bluegriffon-source/third_party/webview2_sdk/`.
    *   [ ] 2.6. (User Action) Attempt to build and run this PoC on Windows. Debug build and runtime issues. Expected outcome: BlueGriffon launches, and a separate "WebView2 Test Window" also appears, loading Bing.com.

*   [x] **Step 3: UI (XUL) Modernization Strategy and Initial Implementation (HTML Dialog PoC)**
    *   [x] 3.1. Decision: Pursue a full UI rewrite (XUL to HTML/CSS/JS in WebView2) as the long-term strategy.
    *   [x] 3.2. Create `app/resources/html_ui/about_dialog.html`, `about_dialog.css`, and `about_dialog.js` for a simple HTML-based "About" dialog. JS includes logic to post a `closeAboutDialog` message.
    *   [x] 3.3. Create `app/HTMLDialogWindow.h` and `app/HTMLDialogWindow.cpp` to launch a separate Win32 window, host WebView2, navigate to the local `about_dialog.html` (using `GetAppResourcesPath`), and handle the close message.
    *   [x] 3.4. Modify `app/moz.build` to include `HTMLDialogWindow.cpp` and link `Shlwapi.lib` (for `PathCombine`).
    *   [x] 3.5. Modify `app/nsEditorApp.cpp` to call `LaunchHTMLDialogWindow` for the about dialog.
    *   [ ] 3.6. (User Action) Ensure `app/resources/html_ui/` contents are copied to the output directory (e.g., via `Makefile.in` changes or manual copy for PoC). (Conceptual `Makefile.in` change made in Step 6 PoC).
    *   [ ] 3.7. (User Action) Build and run. Expected: The HTML About Dialog appears, can be closed by its button.

*   [x] **Step 4: JavaScript Interoperability Layer (PoC Enhancement)**
    *   [x] 4.1. Define basic JSON message structure for JS-C++ communication (request ID, action, payload, response with success/data/error).
    *   [x] 4.2. Enhance `app/resources/html_ui/about_dialog.js` with an `appBridge` object:
        *   Manages message IDs and Promise-based request/response.
        *   Provides `invokeHost('action', payload)` and a specific `getAppVersion()` method.
        *   Requests app version on load and displays it.
    *   [x] 4.3. Enhance `app/HTMLDialogWindow.cpp` (`WebMessageReceived` handler):
        *   Rudimentary parsing of incoming JSON from JS.
        *   Handles `getAppVersion` action: manually constructs a JSON response with a hardcoded version and sends it back to JS.
    *   [ ] 4.4. (User Action) Build and run. Expected: About Dialog displays the version string sent from C++.

*   [x] **Step 5: Incremental Feature Migration (PoC - Dynamic Data Display)**
    *   [x] 5.1. Create `app/resources/html_ui/feature_test.html` (button to fetch data, div to display) and `feature_test.js`.
    *   [x] 5.2. `feature_test.js` reuses/extends `appBridge` to add `getDynamicDataFromHost` which calls `invokeHost('getDynamicData')`. On button click, it calls this and displays the response.
    *   [x] 5.3. Enhance `app/HTMLDialogWindow.cpp` (`WebMessageReceived` handler):
        *   Handles `getDynamicData` action: gets current system time, formats a message string, and sends it back in a JSON response via `appBridge`.
    *   [x] 5.4. Modify `app/nsEditorApp.cpp` to launch this `feature_test.html` window.
    *   [ ] 5.5. (User Action) Build and run. Expected: "Feature Test" window appears; clicking button fetches and displays time-stamped message from C++.

*   [x] **Step 6: Build System Overhaul and Packaging (PoC - Resource Copying & CI Outline)**
    *   [x] 6.1. Modify `app/Makefile.in` with rules to copy the `app/resources/html_ui/` directory and its contents to `$(DIST)/bin/resources/html_ui/` during the build.
    *   [x] 6.2. Create a conceptual GitHub Actions workflow file (`.github/workflows/build.yml`) for Windows, outlining steps for:
        *   Checkout.
        *   Basic Mozilla environment setup (placeholders).
        *   Automated WebView2 SDK download/extraction (from NuGet).
        *   BlueGriffon build command execution.
        *   Packaging artifacts (executable, HTML resources, WebView2Loader.dll).
    *   [ ] 6.3. (User Action) Test `Makefile.in` changes: Build and verify resources are copied.
    *   [ ] 6.4. (User Action - Major Task) Implement and iteratively refine the GitHub Actions workflow.

*   [x] **Step 7: Testing and Refinement (Conceptual for PoCs)**
    *   [x] 7.1. Outline testing strategies for each PoC (build success, resource packaging, window appearance, WebView2 loading, JS-C++ interop).
    *   [x] 7.2. Identify key refinement areas based on PoC limitations:
        *   Robust C++ JSON library integration.
        *   Improved error handling and logging.
        *   Better C++ code structure for interop and window management.
        *   More modular JavaScript `appBridge`.
        *   Full automation of WebView2 SDK acquisition in build system.
        *   Cross-platform considerations for build and WebView2.

*   [x] **Step 8: Future Enhancements (Post-MVP) - Outline**
    *   [x] 8.1. Complete UI migration from XUL to HTML/JS/CSS (potentially with a modern JS framework).
    *   [x] 8.2. Achieve full feature parity by migrating all BlueGriffon features.
    *   [x] 8.3. Develop new "full JS capabilities" (e.g., modern script editor, client-side JS extensions).
    *   [x] 8.4. Mature the C++ backend and `appBridge` interop layer (versioning, security, async handling).
    *   [x] 8.5. Fully automate cross-platform builds and packaging (CI/CD).
    *   [x] 8.6. Design and implement a new extension system if needed.
    *   [x] 8.7. Focus on performance optimization and theming.

## Phase 2: Core Editor Migration (MVP Development)

This phase focuses on replacing the main Gecko editor view with WebView2 and migrating a minimal set of core features to achieve an MVP.

*   [ ] **Step 9: Integrate a C++ JSON Library**
    *   [ ] 9.1. Research and select a C++ JSON library (e.g., nlohmann/json, RapidJSON).
    *   [ ] 9.2. Integrate this library into the BlueGriffon build system (`app/moz.build`, potentially global build config).
    *   [ ] 9.3. Refactor `HTMLDialogWindow.cpp` (and any future C++ interop handlers) to use this library for parsing and serializing JSON messages.
    *   [ ] 9.4. Test with existing PoCs (About Dialog, Feature Test) to ensure interop still works.

*   [ ] **Step 10: Architecting the Main WebView2 Host**
    *   [ ] 10.1. Design C++ classes for managing the primary WebView2 instance that will host the main editor UI and potentially the entire application shell.
    *   [ ] 10.2. This class should handle WebView2 initialization, navigation to the main HTML shell page, and serve as the primary message broker for the `appBridge`.

*   [ ] **Step 11: Replace Main Editor View with WebView2 (The "Big One")**
    *   [ ] 11.1. Deep dive into BlueGriffon's C++ and XUL to identify how and where the main editor `<browser>` or equivalent Gecko view is instantiated and managed.
    *   [ ] 11.2. Determine how to obtain the `HWND` of the parent UI element that should host the main editor's WebView2 instance.
    *   [ ] 11.3. Modify BlueGriffon's C++ code to instantiate your main WebView2 host class (from Step 10) and embed its WebView2 control into this identified editor area.
        *   This will likely require significant changes to BlueGriffon's windowing and UI composition logic.
        *   Initially, the rest of the XUL UI (menus, toolbars) might still be present but non-functional with the new view.
    *   [ ] 11.4. Create a very basic `editor_shell.html` page that the main WebView2 instance loads. This page will eventually host the entire new UI. For now, it can be a placeholder.
    *   [ ] 11.5. (User Action) Build and test. Goal: BlueGriffon launches, and the main editor area is now a WebView2 instance loading `editor_shell.html`, even if nothing else works.

*   [ ] **Step 12: Basic File Operations with New UI**
    *   [ ] 12.1. Design a very simple HTML UI for "Open File" and "Save File" (e.g., buttons in `editor_shell.html`).
    *   [ ] 12.2. Implement C++ backend functions for basic file read/write operations, exposed via the `appBridge`.
        *   These should be asynchronous.
        *   Handle security considerations for file access.
    *   [ ] 12.3. Implement JS in `editor_shell.html` to call these `appBridge` functions.
    *   [ ] 12.4. The content loaded from a file should be displayed within a content area (e.g., a `<div>` or a simple text editor component like CodeMirror) inside `editor_shell.html`.
    *   [ ] 12.5. (User Action) Test opening and saving simple text files.

*   [ ] **Step 13: Minimal WYSIWYG Editing Capability**
    *   [ ] 13.1. Integrate a basic JavaScript-based rich text editor component (e.g., TinyMCE, Quill, or even a simple `contentEditable` div with manual controls) into `editor_shell.html`.
    *   [ ] 13.2. Implement basic formatting commands (e.g., Bold, Italic) via HTML buttons that use JavaScript to interact with the chosen editor component.
    *   [ ] 13.3. Ensure content from opened files (Step 12) loads into this editor, and content can be saved from it.

*   [ ] **Step 14: MVP Definition and Testing**
    *   [ ] 14.1. Define the precise, minimal feature set for the MVP.
    *   [ ] 14.2. Conduct thorough testing of the MVP features on the primary target platform (Windows).
    *   [ ] 14.3. Refine and debug until MVP criteria are met.

## Phase 3: Expanding Features and UI (Post-MVP)

This phase involves systematically migrating more BlueGriffon features and UI elements to the new architecture. This will be a highly iterative process.

*   [ ] **Step 15: UI Shell Implementation (Toolbars, Menus, Sidebars)**
    *   [ ] 15.1. Choose a JavaScript UI framework (React, Vue, Svelte, Lit, etc.) if not already done, to manage the complexity of the main application shell.
    *   [ ] 15.2. Begin rebuilding the main application shell (toolbars, menus, status bar, sidebar containers) in HTML/JS/CSS using the chosen framework, hosted within the main WebView2 instance (`editor_shell.html`).
    *   [ ] 15.3. Each UI action (menu click, toolbar button click) will trigger JavaScript that calls the C++ backend via `appBridge` for its logic.

*   [ ] **Step 16: Migrate Key BlueGriffon Panels/Dialogs**
    *   (Iterate for each panel/dialog, e.g., DOM Explorer, CSS Inspector, Preferences, etc.)
    *   [ ] 16.x.1. Analyze the existing XUL/JS implementation of the panel/dialog.
    *   [ ] 16.x.2. Design and implement its HTML/JS/CSS replacement.
    *   [ ] 16.x.3. Implement necessary C++ backend logic and `appBridge` methods.
    *   [ ] 16.x.4. Integrate into the new UI shell.

*   [ ] **Step 17: Migrate Core Editing Functionalities**
    *   (Iterate for each editing feature, e.g., table editing, image insertion, source view, etc.)
    *   [ ] 17.x.1. Analyze existing Gecko-dependent implementation.
    *   [ ] 17.x.2. Design how it will work with the new JS editor component and C++ backend.
    *   [ ] 17.x.3. Implement and test.

*   [ ] **Step 18: Cross-Platform Implementation (macOS, Linux)**
    *   [ ] ~~18.1. Implement WebView2 hosting and C++ shell modifications for macOS.~~ (Skipped - Windows Only Focus)
    *   [ ] ~~18.2. Implement WebView2 (or alternative like WebKitGTK if chosen) hosting and C++ shell modifications for Linux.~~ (Skipped - Windows Only Focus)
    *   [ ] 18.3. Adapt build system (CMake or existing `moz.build` with platform logic) for Windows.
    *   [ ] 18.4. Test and ensure feature parity on Windows.

## Phase 4: Refinement, Optimization, and Release

*   [ ] **Step 19: Performance Optimization**
    *   [ ] 19.1. Profile C++ backend, JS frontend, and interop communication.
    *   [ ] 19.2. Optimize startup time, UI responsiveness, and memory usage.

*   [ ] **Step 20: Theming and Final UI Polish**
    *   [ ] 20.1. Implement robust theming (light/dark modes).
    *   [ ] 20.2. Finalize UI design and ensure consistency.

*   [ ] **Step 21: New Extension API (If Required)**
    *   [ ] 21.1. Design and document a new JavaScript-based extension API.
    *   [ ] 21.2. Implement the core extension loading and management system.

*   [ ] **Step 22: Comprehensive Testing**
    *   [ ] 22.1. Unit tests for C++ and JavaScript modules.
    *   [ ] 22.2. Integration tests for C++/JS interop.
    *   [ ] 22.3. End-to-end tests for user workflows.
    *   [ ] 22.4. Cross-browser/platform testing (Windows Only Focus).

*   [ ] **Step 23: Documentation**
    *   [ ] 23.1. User documentation.
    *   [ ] 23.2. Developer documentation (for build setup, `appBridge` API, extension API).

*   [ ] **Step 24: Packaging and Release**
    *   [ ] 24.1. Finalize installers for all target platforms (Windows Only Focus).
    *   [ ] 24.2. Implement auto-update mechanism if desired.
    *   [ ] 24.3. Release!
