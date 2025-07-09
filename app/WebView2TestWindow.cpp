// WebView2TestWindow.cpp
#include "WebView2TestWindow.h"

#if defined(_WIN32) // Ensure this is Windows-specific

#include <string>
#include <wrl.h> // For Microsoft::WRL::ComPtr
#include <wil/com.h> // For wil::com_ptr (alternative to ComPtr)

// Make sure to include the path to WebView2.h from your SDK installation
// For example, if you place the SDK in a 'third_party' folder:
// #include "third_party/webview2_sdk/include/WebView2.h"
// For now, we assume it will be in the include path set by moz.build
#include "WebView2.h"

// Global variables for this test window (simplified for PoC)
static HWND g_hWndTest = nullptr;
static wil::com_ptr<ICoreWebView2Controller> g_webviewController;
static wil::com_ptr<ICoreWebView2> g_webview;

// Forward declaration
LRESULT CALLBACK TestWndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam);

bool LaunchWebView2TestWindow(HINSTANCE hInstance) {
    const wchar_t CLASS_NAME[] = L"WebView2TestWindowClass";

    WNDCLASS wc = { };
    wc.lpfnWndProc = TestWndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = CLASS_NAME;
    // Add a simple icon and cursor
    wc.hIcon = LoadIcon(NULL, IDI_APPLICATION);
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);

    if (!RegisterClass(&wc)) {
        // For a real app, use GetLastError() and proper logging
        OutputDebugString(L"Failed to register window class\n");
        return false;
    }

    g_hWndTest = CreateWindowEx(
        0,                              // Optional window styles.
        CLASS_NAME,                     // Window class
        L"WebView2 Test Window (BlueGriffon PoC)", // Window text
        WS_OVERLAPPEDWINDOW,            // Window style

        // Size and position
        CW_USEDEFAULT, CW_USEDEFAULT, 800, 600,

        NULL,       // Parent window
        NULL,       // Menu
        hInstance,  // Instance handle
        NULL        // Additional application data
    );

    if (g_hWndTest == NULL) {
        OutputDebugString(L"Failed to create window\n");
        return false;
    }

    ShowWindow(g_hWndTest, SW_SHOWDEFAULT);
    UpdateWindow(g_hWndTest);

    // Initialize WebView2 - This is the core part
    // The message loop (GetMessage, TranslateMessage, DispatchMessage)
    // will be handled by BlueGriffon's main loop, hopefully.
    // For this PoC, we fire off the async creation and don't wait/block.

    CreateCoreWebView2EnvironmentWithOptions(nullptr, nullptr, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(result)) {
                    OutputDebugString(L"Failed to create WebView2 environment\n");
                    return result;
                }

                env->CreateCoreWebView2Controller(g_hWndTest, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                        if (FAILED(result) || controller == nullptr) {
                            OutputDebugString(L"Failed to create WebView2 controller\n");
                            return result;
                        }

                        g_webviewController = controller;
                        g_webviewController->get_CoreWebView2(&g_webview);

                        if (g_webview) {
                            // Basic settings (optional for PoC)
                            wil::com_ptr<ICoreWebView2Settings> settings;
                            g_webview->get_Settings(&settings);
                            if (settings) {
                                settings->put_IsScriptEnabled(TRUE);
                                settings->put_AreDefaultScriptDialogsEnabled(TRUE);
                                settings->put_IsWebMessageEnabled(TRUE); // For future use
                            }

                            // Resize WebView to fit the bounds of the parent window
                            RECT bounds;
                            GetClientRect(g_hWndTest, &bounds);
                            g_webviewController->put_Bounds(bounds);

                            // Navigate to a test page
                            g_webview->Navigate(L"https://www.bing.com/");
                        }
                        return S_OK;
                    }).Get());
                return S_OK;
            }).Get());

    return true; // Window created, WebView2 initialization started
}

LRESULT CALLBACK TestWndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
    case WM_SIZE:
        if (g_webviewController != nullptr) {
            RECT bounds;
            GetClientRect(hWnd, &bounds);
            g_webviewController->put_Bounds(bounds);
        }
        break;
    case WM_DESTROY:
        // Clean up WebView2 (optional for this simple PoC, but good practice)
        if (g_webviewController) {
            g_webviewController->Close();
            g_webviewController = nullptr;
            g_webview = nullptr;
        }
        PostQuitMessage(0); // Only if this window had its own message loop
        break;
    default:
        return DefWindowProc(hWnd, message, wParam, lParam);
    }
    return 0;
}

#endif // _WIN32
