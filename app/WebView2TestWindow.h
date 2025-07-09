// WebView2TestWindow.h
#pragma once

#if defined(_WIN32) // Ensure this is Windows-specific
#include <windows.h>

// Function to launch our test WebView2 window
// Returns true on success, false on failure.
bool LaunchWebView2TestWindow(HINSTANCE hInstance);

#endif // _WIN32
