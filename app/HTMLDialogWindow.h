// HTMLDialogWindow.h
#pragma once

#if defined(_WIN32) // Ensure this is Windows-specific
#include <windows.h>
#include <string>

// Function to launch our HTML dialog window
// Takes hInstance and the HTML file name (relative to a known base path or absolute)
// Returns true on success, false on failure.
bool LaunchHTMLDialogWindow(HINSTANCE hInstance, const std::wstring& htmlFilePath, const std::wstring& windowTitle);

#endif // _WIN32
