// Update status based on extension state
document.addEventListener('DOMContentLoaded', () => {
    chrome.runtime.sendMessage({ type: 'CHECK_STATUS' }, (response) => {
        const statusEl = document.getElementById('status');
        if (chrome.runtime.lastError) {
            statusEl.textContent = 'Extension error';
            statusEl.style.background = '#ffdddd';
        } else {
            statusEl.textContent = 'Extension is active';
            statusEl.style.background = '#ddffdd';
        }
    });
});