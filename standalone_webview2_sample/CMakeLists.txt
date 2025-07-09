cmake_minimum_required(VERSION 3.10)

project(MinimalWebView2Sample LANGUAGES CXX)

# Require C++17 for things like wil/com.h and modern practices
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Add the executable
add_executable(MinimalWebView2 MinimalWebView2.cpp)

# Set properties for a Windows GUI application (not a console app)
set_target_properties(MinimalWebView2 PROPERTIES WIN32_EXECUTABLE ON)

# --- WebView2 SDK Integration ---
# This part assumes the WebView2 SDK has been downloaded and its location is known.
# For GitHub Actions, a step would download/extract the SDK, and we might pass its path here.
# For local builds, you'd set WEBVIEW2_SDK_PATH as a CMake variable or environment variable.

# Option 1: User provides path to the extracted WebView2 SDK
# Example: cmake -DWEBVIEW2_SDK_PATH=/path/to/your/sdk ..
option(WEBVIEW2_SDK_PATH "Path to the extracted WebView2 SDK (contains include, lib, bin)" "")

if(NOT WEBVIEW2_SDK_PATH OR NOT IS_DIRECTORY "${WEBVIEW2_SDK_PATH}")
    # Fallback: Check an environment variable if the CMake variable isn't set
    if(DEFINED ENV{WEBVIEW2_SDK_PATH_ENV} AND IS_DIRECTORY "$ENV{WEBVIEW2_SDK_PATH_ENV}")
        set(WEBVIEW2_SDK_PATH "$ENV{WEBVIEW2_SDK_PATH_ENV}")
        message(STATUS "Using WebView2 SDK from environment variable WEBVIEW2_SDK_PATH_ENV: ${WEBVIEW2_SDK_PATH}")
    else()
        # Fallback: Assume it's in a 'third_party/webview2_sdk' subdirectory relative to project source
        # This matches the GitHub Actions workflow's placement.
        set(WEBVIEW2_SDK_PATH_GUESS "${CMAKE_SOURCE_DIR}/../third_party/webview2_sdk") # Relative to parent of this sample's dir
        if(IS_DIRECTORY "${WEBVIEW2_SDK_PATH_GUESS}")
            set(WEBVIEW2_SDK_PATH "${WEBVIEW2_SDK_PATH_GUESS}")
            message(STATUS "Guessed WebView2 SDK path: ${WEBVIEW2_SDK_PATH}")
        else()
            message(FATAL_ERROR "WEBVIEW2_SDK_PATH is not set or invalid. Please provide the path to your WebView2 SDK (e.g., via -DWEBVIEW2_SDK_PATH=...) or ensure it's at '../third_party/webview2_sdk'.")
        endif()
    endif()
endif()

# Define include directory for WebView2.h
target_include_directories(MinimalWebView2 PRIVATE "${WEBVIEW2_SDK_PATH}/include")

# Define library path and library for WebView2Loader.dll.lib
# Assuming x64 build for simplicity. Adjust if building for x86.
set(WEBVIEW2_LIB_DIR "${WEBVIEW2_SDK_PATH}/lib/x64")
if(NOT IS_DIRECTORY "${WEBVIEW2_LIB_DIR}")
    message(FATAL_ERROR "WebView2 SDK lib/x64 directory not found at ${WEBVIEW2_LIB_DIR}")
endif()

# Link against WebView2Loader and common Windows libraries
target_link_libraries(MinimalWebView2 PRIVATE
    "${WEBVIEW2_LIB_DIR}/WebView2Loader.dll.lib"
    user32      # For windowing functions
    gdi32       # For graphics device interface functions
    shell32     # For Shell functions (if any, good to have for path functions indirectly)
    ole32       # For COM
    shlwapi     # For Path functions if used (not directly in this minimal sample, but often useful)
)

# --- Post-build step to copy WebView2Loader.dll ---
# This ensures WebView2Loader.dll is next to the executable for runtime.
# Assuming x64.
set(WEBVIEW2_RUNTIME_DLL_SOURCE "${WEBVIEW2_SDK_PATH}/bin/x64/WebView2Loader.dll")
if(NOT EXISTS "${WEBVIEW2_RUNTIME_DLL_SOURCE}")
    message(FATAL_ERROR "WebView2Loader.dll not found at ${WEBVIEW2_RUNTIME_DLL_SOURCE}")
endif()

add_custom_command(
    TARGET MinimalWebView2 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${WEBVIEW2_RUNTIME_DLL_SOURCE}"
        "$<TARGET_FILE_DIR:MinimalWebView2>/WebView2Loader.dll"
    COMMENT "Copying WebView2Loader.dll to output directory"
)

# Optional: Add resource file if you have one for icons, etc.
# target_sources(MinimalWebView2 PRIVATE resource.rc)

message(STATUS "MinimalWebView2Sample configured. SDK Path: ${WEBVIEW2_SDK_PATH}")
