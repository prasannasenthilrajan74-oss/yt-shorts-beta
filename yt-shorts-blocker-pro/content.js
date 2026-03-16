let isEnabled = true;

// CSS to instantly and permanently hide shorts, avoiding UI flicker and YouTube's element recreation
const styleElement = document.createElement('style');
styleElement.id = 'yt-shorts-blocker-style';
styleElement.innerHTML = `
    ytd-reel-shelf-renderer,
    ytd-rich-section-renderer:has(ytd-reel-shelf-renderer),
    ytd-item-section-renderer:has(ytd-reel-shelf-renderer),
    ytd-horizontal-card-list-renderer:has(ytd-reel-item-renderer),
    ytd-shelf-renderer:has(ytd-reel-item-renderer),
    ytd-rich-item-renderer:has(a[href^="/shorts/"]),
    ytd-video-renderer:has(a[href^="/shorts/"]),
    ytd-grid-video-renderer:has(a[href^="/shorts/"]),
    ytd-compact-video-renderer:has(a[href^="/shorts/"]),
    yt-lockup-view-model:has(a[href^="/shorts/"]),
    yt-shorts-lockup-view-model,
    ytd-guide-entry-renderer:has(a[href^="/shorts"]),
    ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]),
    a[title='Shorts'] {
        display: none !important;
    }
`;

function toggleCSS(enable) {
    if (enable) {
        if (!document.getElementById('yt-shorts-blocker-style')) {
            document.head.appendChild(styleElement);
        }
    } else {
        const style = document.getElementById('yt-shorts-blocker-style');
        if (style) style.remove();
    }
}

// Retrieve initial state from storage
chrome.storage.local.get(['isEnabled', 'blockedCount'], (result) => {
    if (result.isEnabled === false) isEnabled = false;
    // Initial run on load
    if (isEnabled) {
        toggleCSS(true);
        removeShorts();
    }
});

// Listen for toggle changes from the popup
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isEnabled) {
        isEnabled = changes.isEnabled.newValue;
        if (isEnabled) {
            toggleCSS(true);
            removeShorts();
        } else {
            toggleCSS(false);
            // Suggest manually reloading to bring shorts back, 
            // since we entirely destroyed the DOM elements earlier.
        }
    }
});

let localBlockedCount = 0;
let saveTimeout = null;

// Debounced saving to storage to prevent rate limits
function incrementStats(count) {
    localBlockedCount += count;

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        chrome.storage.local.get(['blockedCount'], (result) => {
            const newCount = (result.blockedCount || 0) + localBlockedCount;
            chrome.storage.local.set({ blockedCount: newCount });
            localBlockedCount = 0; // reset local pending
        });
    }, 1500);
}

function removeShorts() {
    if (!isEnabled) return;
    let newlyBlocked = 0;

    // Remove shorts shelf (home page, search results, related videos)
    document.querySelectorAll("ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-shelf-renderer, ytd-horizontal-card-list-renderer, ytd-item-section-renderer").forEach(section => {
        const isReelShelf = section.tagName.toLowerCase() === 'ytd-reel-shelf-renderer';
        const hasReelItems = section.querySelector('ytd-reel-item-renderer, yt-shorts-lockup-view-model') !== null;
        const hasReelShelfChild = section.querySelector('ytd-reel-shelf-renderer') !== null;
        
        // Target title to check for shorts
        const titleElement = section.querySelector('#title, .title, yt-formatted-string');
        const hasShortsText = titleElement && titleElement.innerText && titleElement.innerText.trim().toLowerCase() === "shorts";
        
        if (isReelShelf || hasReelItems || hasReelShelfChild || hasShortsText) {
            section.remove();
            newlyBlocked++;
        }
    });

    // Remove individual shorts videos from feeds, search results, related video sidebars, etc.
    document.querySelectorAll("a").forEach(link => {
        if (link.href && link.href.includes("/shorts/")) {
            // Find closest video container, including newer yt-lockup-view-model components
            let video = link.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer, yt-lockup-view-model, yt-shorts-lockup-view-model");
            if (video) {
                video.remove();
                newlyBlocked++;
            }
        }
    });

    // Remove sidebar shorts link from the navigation menu
    document.querySelectorAll("a[title='Shorts'], ytd-guide-entry-renderer a[href^='/shorts'], ytd-mini-guide-entry-renderer a[href^='/shorts']").forEach(link => {
        let parent = link.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer") || link;
        parent.remove();
    });

    if (newlyBlocked > 0) {
        incrementStats(newlyBlocked);
    }
}

// Observe dynamically loaded elements for SPA architecture
let debounceTimeout = null;

const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;

    let shouldRun = false;
    for (let mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldRun = true;
            break;
        }
    }

    if (shouldRun) {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        // Debounce by 100ms to significantly improve performance (smoothness)
        // by avoiding running heavy DOM queries on every single node insertion
        debounceTimeout = setTimeout(() => {
            removeShorts();
        }, 100);
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
