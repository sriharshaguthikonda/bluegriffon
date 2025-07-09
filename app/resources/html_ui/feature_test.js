document.addEventListener('DOMContentLoaded', () => {
    const getDataButton = document.getElementById('getDataButton');
    const dataDisplayDiv = document.getElementById('dataDisplay');

    // Ensure appBridge is available (loaded from about_dialog.js in the HTML)
    if (typeof appBridge === 'undefined') {
        dataDisplayDiv.textContent = 'Error: appBridge is not loaded. Ensure about_dialog.js is included and loaded first.';
        if(getDataButton) getDataButton.disabled = true;
        return;
    }

    // Add the new specific API function to our existing appBridge for this feature
    // In a real app, appBridge would be a more structured module.
    appBridge.getDynamicDataFromHost = function() {
        return this.invokeHost('getDynamicData'); // 'getDynamicData' is the action C++ will look for
    };

    if (getDataButton && dataDisplayDiv) {
        getDataButton.addEventListener('click', () => {
            dataDisplayDiv.textContent = 'Fetching data...';
            appBridge.getDynamicDataFromHost()
                .then(data => {
                    if (data && data.message) {
                        dataDisplayDiv.textContent = data.message;
                    } else {
                        dataDisplayDiv.textContent = 'Received no message in data from C++.';
                    }
                })
                .catch(error => {
                    console.error("Error getting dynamic data:", error);
                    dataDisplayDiv.textContent = `Error: ${error}`;
                });
        });
    } else {
        console.error('Could not find button or display div for feature_test.js');
        if(dataDisplayDiv) dataDisplayDiv.textContent = 'Error: UI elements missing.';
    }
});
