let activeYouTubeTabId = null;

//──────────────── Listener for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "reportActiveYouTubeTab" && sender.tab && sender.tab.url.includes("youtube.com")) {
        activeYouTubeTabId = sender.tab.id;
        console.log("Rina: Active YouTube tab set to:", activeYouTubeTabId);
        return true; 
    }

    //──────────────── A content script requested a search and play action
    if (message.action === "searchAndPlay") {
        const query = message.query;
        console.log(`Rina: Received search request for "${query}"`);

        if (activeYouTubeTabId) {
            chrome.tabs.get(activeYouTubeTabId, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error("Rina: Active YouTube tab not found, attempting to find a new one.");
                    activeYouTubeTabId = null; 
                } else {
                    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    chrome.tabs.update(activeYouTubeTabId, { url: youtubeSearchUrl, active: true }, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Rina: Error updating active YouTube tab:", chrome.runtime.lastError.message);
                            chrome.tabs.create({ url: youtubeSearchUrl }, (newTab) => {
                                activeYouTubeTabId = newTab.id;
                                console.log("Rina: Opened new YouTube tab for search:", activeYouTubeTabId);
                            });
                        } else {
                            console.log(`Rina: Navigated designated tab ${activeYouTubeTabId} to search results.`);
                        }
                    });
                    return true; 
                }
            });
        }

        //──────────────── If no active YouTube tab or if the previous one failed, find or create one
        if (!activeYouTubeTabId) {
            chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
                if (tabs.length > 0) {
                    activeYouTubeTabId = tabs[0].id;
                    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    chrome.tabs.update(activeYouTubeTabId, { url: youtubeSearchUrl, active: true }, () => {
                        console.log(`Rina: Activated existing YouTube tab ${activeYouTubeTabId} and navigated to search.`);
                    });
                } else {
                    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    chrome.tabs.create({ url: youtubeSearchUrl }, (newTab) => {
                        activeYouTubeTabId = newTab.id;
                        console.log("Rina: Created new YouTube tab for search:", activeYouTubeTabId);
                    });
                }
            });
        }
        return true; 
    }
});

//──────────────── Listen for tab activation to potentially update activeYouTubeTabId
chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url && tab.url.includes("youtube.com")) {
            activeYouTubeTabId = tab.id;
            console.log("Rina: Switched to YouTube tab:", activeYouTubeTabId);
        }
    });
});

//──────────────── Listen for tab removals to clear activeYouTubeTabId if the controlled tab is closed
chrome.tabs.onRemoved.addListener(tabId => {
    if (tabId === activeYouTubeTabId) {
        activeYouTubeTabId = null;
        console.log("Rina: Controlled YouTube tab was closed.");
    }
});