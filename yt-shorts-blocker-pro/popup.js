document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggle-blocker');
    const blockedCountEl = document.getElementById('blocked-count');
    const timeSavedEl = document.getElementById('time-saved');

    // Load initial state
    chrome.storage.local.get(['isEnabled', 'blockedCount'], (result) => {
        // Default to true if not set
        const isEnabled = result.isEnabled !== false;
        toggle.checked = isEnabled;

        const count = result.blockedCount || 0;
        updateStats(count);
    });

    // Handle toggle switch events
    toggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ isEnabled });
    });

    // Listen for storage changes to update live metrics and status
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.blockedCount) {
                updateStats(changes.blockedCount.newValue);
            }
            if (changes.isEnabled) {
                toggle.checked = changes.isEnabled.newValue;
            }
        }
    });

    function updateStats(count) {
        // Animate counter logic (simple text content for now)
        blockedCountEl.textContent = count.toLocaleString();

        // Estimate 0.5 min saved per block (approx 30s)
        const totalMinutes = Math.floor(count * 0.5);

        if (totalMinutes === 0) {
            timeSavedEl.textContent = '< 1m';
        } else if (totalMinutes < 60) {
            timeSavedEl.textContent = `${totalMinutes}m`;
        } else {
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            timeSavedEl.textContent = `${hours}h ${mins}m`;
        }
    }
});
