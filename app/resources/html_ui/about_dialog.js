// Simple Interop Layer for PoC
const appBridge = {
    _messageIdCounter: 0,
    _pendingRequests: {},

    _initListener: function() {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.addEventListener('message', event => {
                try {
                    // In WebView2, if the host sends a JSON string via PostWebMessageAsJson,
                    // event.data will be that string. If it sends an object via PostWebMessageAsJson
                    // (which isn't directly possible without stringifying first on host),
                    // or if JS sends an object via postMessage, it might be auto-parsed by some environments
                    // but safest to assume string and parse if C++ sent stringified JSON.
                    // However, window.chrome.webview.postMessage(object) from JS to C++
                    // will result in C++ receiving a JSON string if the object is JSON-serializable.
                    // And ICoreWebView2::PostWebMessageAsString from C++ to JS means event.data is a string.
                    // ICoreWebView2::PostWebMessageAsJSON from C++ to JS also means event.data is a string (the JSON string).

                    const response = JSON.parse(event.data); // event.data is the JSON string from host.

                    if (response.id && this._pendingRequests[response.id]) {
                        if (response.success) {
                            this._pendingRequests[response.id].resolve(response.data);
                        } else {
                            this._pendingRequests[response.id].reject(response.error || 'Unknown error from host');
                        }
                        delete this._pendingRequests[response.id];
                    }
                } catch (e) {
                    console.error("Error parsing message from host, or message was not JSON:", e, event.data);
                }
            });
        } else {
            console.warn("WebView messaging API (window.chrome.webview) not available for appBridge listener.");
        }
    },

    invokeHost: function(action, payload = {}) {
        return new Promise((resolve, reject) => {
            if (!window.chrome || !window.chrome.webview) {
                return reject('WebView messaging API not available for invoking host.');
            }
            const messageId = `msg_${this._messageIdCounter++}`;
            this._pendingRequests[messageId] = { resolve, reject };

            const message = {
                id: messageId,
                action: action,
                payload: payload
            };
            // When JS posts an object, WebView2 converts it to a JSON string for the C++ host.
            window.chrome.webview.postMessage(message);
        });
    },

    // Specific API functions
    getAppVersion: function() {
        return this.invokeHost('getAppVersion');
    }
};

appBridge._initListener(); // Initialize the listener

document.addEventListener('DOMContentLoaded', () => {
    const closeButton = document.getElementById('closeButton');
    const appVersionSpan = document.getElementById('appVersion');

    if (window.chrome && window.chrome.webview) {
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                // Send a message to the host C++ code to close the dialog
                // This specific message can remain simple as it doesn't need a response via appBridge
                window.chrome.webview.postMessage({ type: 'closeAboutDialog' });
            });
        }

        if (appVersionSpan) {
            appBridge.getAppVersion()
                .then(data => {
                    if (data && data.version) {
                        appVersionSpan.textContent = data.version;
                    } else {
                        appVersionSpan.textContent = 'N/A';
                    }
                })
                .catch(error => {
                    console.error("Error getting app version:", error);
                    appVersionSpan.textContent = 'Error';
                });
        }

    } else {
        console.warn("WebView messaging API (window.chrome.webview) not available. UI features will be limited.");
        if (appVersionSpan) {
            appVersionSpan.textContent = 'WebView N/A';
        }
        if (closeButton) {
            closeButton.textContent = "Close (Won't work)";
            closeButton.disabled = true;
        }
    }
});
