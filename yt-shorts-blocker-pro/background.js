chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url && tab.url.includes("youtube.com/shorts")) {
        // Check if blocker is enabled before redirecting
        chrome.storage.local.get(['isEnabled'], (result) => {
            if (result.isEnabled !== false) { // Default to true
                chrome.tabs.update(tabId, {
                    url: "https://www.youtube.com/"
                });

                // Track this URL block as a stat
                chrome.storage.local.get(['blockedCount'], (stats) => {
                    const count = (stats.blockedCount || 0) + 1;
                    chrome.storage.local.set({ blockedCount: count });
                });
            }
        });
    }
});
