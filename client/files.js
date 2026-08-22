import { importProfile, serializeProfile } from './state.js';

export function parseState(text) {
  return importProfile(JSON.parse(text));
}

export function stringifyState(state) {
  return JSON.stringify(serializeProfile(state), null, 2);
}

export async function saveStateToFile(state) {
  const blob = new Blob([stringifyState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  try {
    return await chrome.downloads.download({
      url,
      filename: `header_craft_${Date.now()}.json`,
      saveAs: true,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function openJsonFile() {
  return new Promise((resolve, reject) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';

    fileInput.addEventListener('change', async () => {
      try {
        const file = fileInput.files?.[0];
        resolve(file ? parseState(await file.text()) : undefined);
      } catch (error) {
        reject(error);
      }
    }, { once: true });
    fileInput.addEventListener('cancel', () => resolve(undefined), { once: true });
    fileInput.click();
  });
}
