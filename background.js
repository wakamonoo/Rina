// background.js

let activeYouTubeTabId = null; // Stores the ID of the YouTube tab Rina should control

// Listener for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // A content script is reporting itself as an active YouTube tab
    if (message.action === "reportActiveYouTubeTab" && sender.tab && sender.tab.url.includes("youtube.com")) {
        activeYouTubeTabId = sender.tab.id;
        console.log("Rina: Active YouTube tab set to:", activeYouTubeTabId);
        return true; // Indicate that sendResponse will be called asynchronously
    }

    // A content script requested a search and play action
    if (message.action === "searchAndPlay") {
        const query = message.query;
        console.log(`Rina: Received search request for "${query}"`);

        if (activeYouTubeTabId) {
            // If we have a designated active YouTube tab, send the command there
            chrome.tabs.get(activeYouTubeTabId, (tab) => {
                if (chrome.runtime.lastError) {
                    // Tab might have been closed or become invalid
                    console.error("Rina: Active YouTube tab not found, attempting to find a new one.");
                    activeYouTubeTabId = null; // Clear invalid tab ID
                    // Fall through to search for a new tab
                } else {
                    // Navigate the designated tab
                    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    chrome.tabs.update(activeYouTubeTabId, { url: youtubeSearchUrl, active: true }, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Rina: Error updating active YouTube tab:", chrome.runtime.lastError.message);
                            // If update fails, try to open a new tab as a fallback
                            chrome.tabs.create({ url: youtubeSearchUrl }, (newTab) => {
                                activeYouTubeTabId = newTab.id;
                                console.log("Rina: Opened new YouTube tab for search:", activeYouTubeTabId);
                            });
                        } else {
                            console.log(`Rina: Navigated designated tab ${activeYouTubeTabId} to search results.`);
                        }
                    });
                    return true; // Indicate that sendResponse will be called asynchronously (though not used here)
                }
            });
        }

        // If no active YouTube tab or if the previous one failed, find or create one
        if (!activeYouTubeTabId) {
            chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
                if (tabs.length > 0) {
                    // Activate the first YouTube tab found and set it as active
                    activeYouTubeTabId = tabs[0].id;
                    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    chrome.tabs.update(activeYouTubeTabId, { url: youtubeSearchUrl, active: true }, () => {
                        console.log(`Rina: Activated existing YouTube tab ${activeYouTubeTabId} and navigated to search.`);
                    });
                } else {
                    // No YouTube tab found, create a new one
                    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    chrome.tabs.create({ url: youtubeSearchUrl }, (newTab) => {
                        activeYouTubeTabId = newTab.id;
                        console.log("Rina: Created new YouTube tab for search:", activeYouTubeTabId);
                    });
                }
            });
        }
        return true; // Indicate that the message was handled asynchronously
    }
});

// Listen for tab activation to potentially update activeYouTubeTabId
chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.includes("youtube.com")) {
            activeYouTubeTabId = tab.id;
            console.log("Rina: Switched to YouTube tab:", activeYouTubeTabId);
        }
    });
});

// Listen for tab removals to clear activeYouTubeTabId if the controlled tab is closed
chrome.tabs.onRemoved.addListener(tabId => {
    if (tabId === activeYouTubeTabId) {
        activeYouTubeTabId = null;
        console.log("Rina: Controlled YouTube tab was closed.");
    }
});