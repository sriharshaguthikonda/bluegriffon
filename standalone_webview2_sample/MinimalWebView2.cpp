// MinimalWebView2.cpp
// A minimal Win32 application to host WebView2.
// Based on Microsoft's Win32_GettingStarted sample.

#define UNICODE
#include <windows.h>
#include <string>
#include <wrl.h>      // For Microsoft::WRL::ComPtr
#include <wil/com.h>  // For wil::com_ptr (alternative)
#include "WebView2.h" // WebView2 SDK header

// Global variables for this minimal sample
HWND g_hWndMain = nullptr;
wil::com_ptr<ICoreWebView2Controller> g_webviewController;
wil::com_ptr<ICoreWebView2> g_webview;

// Forward declarations
LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam);
void InitializeWebView2(HWND hWnd);

int APIENTRY wWinMain(_In_ HINSTANCE hInstance,
                     _In_opt_ HINSTANCE hPrevInstance,
                     _In_ LPWSTR    lpCmdLine,
                     _In_ int       nCmdShow)
{
    UNREFERENCED_PARAMETER(hPrevInstance);
    UNREFERENCED_PARAMETER(lpCmdLine);

    const wchar_t CLASS_NAME[]  = L"MinimalWebView2WindowClass";

    WNDCLASS wc = { };
    wc.lpfnWndProc   = WndProc;
    wc.hInstance     = hInstance;
    wc.lpszClassName = CLASS_NAME;
    wc.hIcon         = LoadIcon(NULL, IDI_APPLICATION);
    wc.hCursor       = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);

    RegisterClass(&wc);

    g_hWndMain = CreateWindowEx(
        0,                              // Optional window styles.
        CLASS_NAME,                     // Window class
        L"Minimal WebView2 Sample",       // Window text
        WS_OVERLAPPEDWINDOW,            // Window style
        CW_USEDEFAULT, CW_USEDEFAULT, 1280, 720, // Size and position
        NULL,       // Parent window
        NULL,       // Menu
        hInstance,  // Instance handle
        NULL        // Additional application data
    );

    if (g_hWndMain == NULL)
    {
        MessageBox(NULL, L"Window Creation Failed!", L"Error", MB_ICONEXCLAMATION | MB_OK);
        return 0;
    }

    ShowWindow(g_hWndMain, nCmdShow);
    UpdateWindow(g_hWndMain);

    InitializeWebView2(g_hWndMain);

    // Main message loop:
    MSG msg = { };
    while (GetMessage(&msg, NULL, 0, 0))
    {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    return (int) msg.wParam;
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
    case WM_SIZE:
        if (g_webviewController != nullptr) {
            RECT bounds;
            GetClientRect(hWnd, &bounds);
            g_webviewController->put_Bounds(bounds);
        }
        break;
    case WM_DESTROY:
        if (g_webviewController) {
            g_webviewController->Close(); // Important to close WebView2 controller
            g_webviewController = nullptr;
            g_webview = nullptr;
        }
        PostQuitMessage(0);
        break;
    default:
        return DefWindowProc(hWnd, message, wParam, lParam);
    }
    return 0;
}

void InitializeWebView2(HWND hWnd) {
    // Specify a user data folder (optional, but recommended for stability)
    // For this sample, let's use a subfolder in the temp directory.
    wchar_t tempPath[MAX_PATH];
    GetTempPath(MAX_PATH, tempPath);
    std::wstring userDataFolder = std::wstring(tempPath) + L"MinimalWebView2_UserData";

    CreateCoreWebView2EnvironmentWithOptions(nullptr, userDataFolder.c_str(), nullptr,
        Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [hWnd](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(result)) {
                    MessageBox(hWnd, L"Failed to create WebView2 Environment.", L"Error", MB_ICONERROR);
                    return result;
                }

                env->CreateCoreWebView2Controller(hWnd,
                    Microsoft::WRL::Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [hWnd](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                            if (FAILED(result) || controller == nullptr) {
                                MessageBox(hWnd, L"Failed to create WebView2 Controller.", L"Error", MB_ICONERROR);
                                return result;
                            }

                            g_webviewController = controller;
                            g_webviewController->get_CoreWebView2(&g_webview);

                            if (g_webview) {
                                // Basic settings
                                wil::com_ptr<ICoreWebView2Settings> settings;
                                g_webview->get_Settings(&settings);
                                if (settings) {
                                    settings->put_IsScriptEnabled(TRUE);
                                    settings->put_AreDefaultScriptDialogsEnabled(TRUE);
                                    settings->put_IsWebMessageEnabled(TRUE);
                                }

                                // Resize WebView to fit the bounds of the parent window
                                RECT bounds;
                                GetClientRect(hWnd, &bounds);
                                g_webviewController->put_Bounds(bounds);

                                // Navigate to a test page
                                g_webview->Navigate(L"https://www.bing.com/");
                            } else {
                                MessageBox(hWnd, L"Failed to get CoreWebView2.", L"Error", MB_ICONERROR);
                            }
                            return S_OK;
                        }).Get());
                return S_OK;
            }).Get());
}
