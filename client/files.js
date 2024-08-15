import { adaptStateForSaving } from './state.js';

function saveDataToFile(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
  
    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
    }, function(downloadId) {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
        }
    });
}

export function saveStateToFile(state) {
    const data = JSON.stringify(adaptStateForSaving(state));
    const timestamp = (new Date()).getTime();
    const filename = `header_craft_${timestamp}`;
    saveDataToFile(data, filename);
}

export function openJsonFile(onSuccess) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';

    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
    
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const fileContent = event.target.result;
                const fileData = JSON.parse(fileContent);

                onSuccess(fileData);
            };
            reader.readAsText(file);
        }
    });
  
    fileInput.click();
}