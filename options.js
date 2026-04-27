const saveOptions = () => {
  const lang = document.getElementById('lang').value;
  chrome.storage.sync.set({ targetLang: lang }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
};

const restoreOptions = () => {
  chrome.storage.sync.get({ targetLang: 'en' }, (items) => {
    document.getElementById('lang').value = items.targetLang;
  });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);