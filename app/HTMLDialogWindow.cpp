// HTMLDialogWindow.cpp
#include "HTMLDialogWindow.h"

#if defined(_WIN32)

#include <wrl.h>
#include <wil/com.h>
#include "WebView2.h" // Assuming this is in the include path via moz.build
#include <shlwapi.h> // For PathCombine
#pragma comment(lib, "Shlwapi.lib") // Link against Shlwapi.lib

// For PoC, assuming HTML resources are in a subdirectory "resources/html_ui" relative to the executable.
// A real implementation would be more robust.
std::wstring GetAppResourcesPath(const std::wstring& relativePath) {
    wchar_t exePath[MAX_PATH];
    GetModuleFileName(NULL, exePath, MAX_PATH);
    PathRemoveFileSpec(exePath); // Removes the exe name, leaving the directory

    wchar_t fullPath[MAX_PATH];
    PathCombine(fullPath, exePath, L"resources/html_ui"); // Base path for HTML UI resources
    PathAppend(fullPath, relativePath.c_str());
    return std::wstring(fullPath);
}


// Globals for this specific dialog instance - simplified for PoC
// A more robust system would encapsulate this in a class or pass context.
static HWND g_hDialogWnd = nullptr;
static wil::com_ptr<ICoreWebView2Controller> g_dialogWebviewController;
static wil::com_ptr<ICoreWebView2> g_dialogWebview;
static std::wstring g_windowTitle;


LRESULT CALLBACK HTMLDialogWndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam);

bool LaunchHTMLDialogWindow(HINSTANCE hInstance, const std::wstring& htmlFileName, const std::wstring& windowTitle) {
    g_windowTitle = windowTitle;
    const wchar_t DIALOG_CLASS_NAME[] = L"HTMLDialogWindowClass";

    WNDCLASS wc = { };
    wc.lpfnWndProc = HTMLDialogWndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = DIALOG_CLASS_NAME;
    wc.hIcon = LoadIcon(NULL, IDI_INFORMATION); // A different icon
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);

    if (!RegisterClass(&wc)) {
        OutputDebugString(L"Failed to register HTML dialog window class\n");
        return false;
    }

    // Fixed size for a dialog-like window
    int dialogWidth = 400;
    int dialogHeight = 300;

    // Center it roughly (simplified)
    int screenWidth = GetSystemMetrics(SM_CXSCREEN);
    int screenHeight = GetSystemMetrics(SM_CYSCREEN);
    int x = (screenWidth - dialogWidth) / 2;
    int y = (screenHeight - dialogHeight) / 2;


    g_hDialogWnd = CreateWindowEx(
        WS_EX_DLGMODALFRAME, // More dialog-like appearance
        DIALOG_CLASS_NAME,
        g_windowTitle.c_str(),
        WS_CAPTION | WS_SYSMENU | WS_VISIBLE, // Dialog styles (not resizable)
        x, y, dialogWidth, dialogHeight,
        NULL, NULL, hInstance, NULL
    );

    if (g_hDialogWnd == NULL) {
        OutputDebugString(L"Failed to create HTML dialog window\n");
        return false;
    }

    ShowWindow(g_hDialogWnd, SW_SHOW); // Use SW_SHOW instead of SW_SHOWDEFAULT
    UpdateWindow(g_hDialogWnd);

    std::wstring fullHtmlPath = GetAppResourcesPath(htmlFileName);
    std::wstring fileUrl = L"file:///" + fullHtmlPath;

    CreateCoreWebView2EnvironmentWithOptions(nullptr, nullptr, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [fileUrl](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(result)) {
                    OutputDebugString(L"HTML Dialog: Failed to create WebView2 environment\n");
                    return result;
                }

                env->CreateCoreWebView2Controller(g_hDialogWnd, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [fileUrl](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                        if (FAILED(result) || controller == nullptr) {
                             OutputDebugString(L"HTML Dialog: Failed to create WebView2 controller\n");
                            return result;
                        }

                        g_dialogWebviewController = controller;
                        g_dialogWebviewController->get_CoreWebView2(&g_dialogWebview);

                        if (g_dialogWebview) {
                            // Register to receive web messages from the HTML content
                            EventRegistrationToken webMessageToken;
                            g_dialogWebview->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                                [](ICoreWebView2* webview, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                                    wil::unique_cotaskmem_string messageRaw;
                                    args->TryGetWebMessageAsString(&messageRaw);
                                    std::wstring messageStr = messageRaw.get();

                                    // Rudimentary JSON parsing for PoC
                                    std::wstring requestId = L"";
                                    std::wstring action = L"";

                                    // Try to extract id: "id":"some_id"
                                    size_t idPos = messageStr.find(L"\"id\":\"");
                                    if (idPos != std::wstring::npos) {
                                        idPos += 6; // Length of "\"id\":\""
                                        size_t idEndPos = messageStr.find(L"\"", idPos);
                                        if (idEndPos != std::wstring::npos) {
                                            requestId = messageStr.substr(idPos, idEndPos - idPos);
                                        }
                                    }

                                    // Try to extract action: "action":"some_action"
                                    size_t actionPos = messageStr.find(L"\"action\":\"");
                                    if (actionPos != std::wstring::npos) {
                                        actionPos += 10; // Length of "\"action\":\""
                                        size_t actionEndPos = messageStr.find(L"\"", actionPos);
                                        if (actionEndPos != std::wstring::npos) {
                                            action = messageStr.substr(actionPos, actionEndPos - actionPos);
                                        }
                                    }

                                    if (action == L"getAppVersion" && !requestId.empty()) {
                                        std::wstring appVersion = L"1.0.0-poc_from_cpp"; // Hardcoded PoC version
                                        // Manually construct JSON response
                                        std::wstring responseJson = L"{";
                                        responseJson += L"\"id\":\"" + requestId + L"\",";
                                        responseJson += L"\"success\":true,";
                                        responseJson += L"\"data\":{\"version\":\"" + appVersion + L"\"}";
                                        responseJson += L"}";
                                        webview->PostWebMessageAsString(responseJson.c_str());

                                    } else if (action == L"getDynamicData" && !requestId.empty()) {
                                        // Get current time to make data dynamic
                                        SYSTEMTIME st;
                                        GetLocalTime(&st);
                                        wchar_t timeString[100];
                                        swprintf_s(timeString, L"%02d:%02d:%02d", st.wHour, st.wMinute, st.wSecond);

                                        std::wstring dynamicMessage = L"Hello from C++! The time is: " + std::wstring(timeString);

                                        std::wstring responseJson = L"{";
                                        responseJson += L"\"id\":\"" + requestId + L"\",";
                                        responseJson += L"\"success\":true,";
                                        responseJson += L"\"data\":{\"message\":\"" + dynamicMessage + L"\"}";
                                        responseJson += L"}";
                                        webview->PostWebMessageAsString(responseJson.c_str());

                                    } else if (messageStr.find(L"\"type\":\"closeAboutDialog\"") != std::wstring::npos) {
                                        // Handle the simple close message (not using the full request/response pattern)
                                        if (g_hDialogWnd) {
                                            PostMessage(g_hDialogWnd, WM_CLOSE, 0, 0);
                                        }
                                    } else {
                                        // Unknown message or format
                                        OutputDebugString((L"HTML Dialog: Received unhandled/unknown message: " + messageStr).c_str());
                                    }
                                    return S_OK;
                                }).Get(), &webMessageToken);

                            RECT bounds;
                            GetClientRect(g_hDialogWnd, &bounds);
                            g_dialogWebviewController->put_Bounds(bounds);
                            g_dialogWebview->Navigate(fileUrl.c_str());
                        }
                        return S_OK;
                    }).Get());
                return S_OK;
            }).Get());

    return true;
}

LRESULT CALLBACK HTMLDialogWndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
    case WM_SIZE: // Should not happen with fixed size dialog, but good practice
        if (g_dialogWebviewController != nullptr) {
            RECT bounds;
            GetClientRect(hWnd, &bounds);
            g_dialogWebviewController->put_Bounds(bounds);
        }
        break;
    case WM_CLOSE: // Handle WM_CLOSE to destroy the window
        DestroyWindow(hWnd);
        break;
    case WM_DESTROY:
        if (g_dialogWebviewController) {
            g_dialogWebviewController->Close(); // Important to close the controller
            g_dialogWebviewController = nullptr;
            g_dialogWebview = nullptr;
        }
        g_hDialogWnd = nullptr; // Clear global handle
        // If this dialog had its own message loop, PostQuitMessage here.
        // Since it's likely modal or part of main loop, this is enough.
        break;
    default:
        return DefWindowProc(hWnd, message, wParam, lParam);
    }
    return 0;
}

#endif // _WIN32
