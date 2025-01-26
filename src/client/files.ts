import { State } from '../state';

function saveDataToFile(data: any, filename: string) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
  
    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
    }, function() {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
        }
    });
}

export function saveStateToFile(state: State) {
    const data = JSON.stringify(state.getCleanItems());
    const timestamp = (new Date()).getTime();
    const filename = `header_craft_${timestamp}`;
    saveDataToFile(data, filename);
}

export function openJsonFile(onSuccess: (data: any) => void) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';

    fileInput.addEventListener('change', function(event) {
        const target = event.target as HTMLInputElement | null;
        if (!target) {
            return;
        }
        const file = target.files?.[0];
    
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const fileContent = event.target?.result;

                if (typeof fileContent !== 'string') {
                    return;
                }

                const fileData = JSON.parse(fileContent);

                onSuccess(fileData);
            };
            reader.readAsText(file);
        }
    });
  
    fileInput.click();
}