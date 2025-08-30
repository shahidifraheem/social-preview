// Track connection state
let port;
let extensionActive = true;

// Handle content script connection
chrome.runtime.onConnect.addListener((connectedPort) => {
    port = connectedPort;
    port.onDisconnect.addListener(() => {
        extensionActive = false;
        notifyAllTabsAboutDisconnect();
    });
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CHECK_STATUS') {
        sendResponse({ status: extensionActive ? 'active' : 'inactive' });
    }
    return true;
});

function notifyAllTabsAboutDisconnect() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'EXTENSION_DISCONNECTED'
                }).catch(() => { });
            }
        });
    });
}

const metadataCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'FETCH_METADATA') {
        fetchMetadata(request.url).then(sendResponse);
        return true; // Required for async sendResponse
    }
});

async function fetchMetadata(url) {
    // Check cache first
    if (metadataCache.has(url)) {
        return metadataCache.get(url);
    }

    try {
        // Use a simpler approach without DOMParser
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();

        // Get the HTML content from the response
        const html = data.contents;

        // Parse metadata using regex instead of DOMParser
        const metadata = parseMetadataWithRegex(html, url);

        // Cache the result
        metadataCache.set(url, metadata);
        return metadata;
    } catch (error) {
        return {
            url: url,
            title: new URL(url).hostname,
            description: 'Could not fetch metadata for this link',
            image: null,
            favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`
        };
    }
}

function parseMetadataWithRegex(html, url) {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i) ||
        html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
    const title = titleMatch ? titleMatch[1] : new URL(url).hostname;

    // Extract description
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i) ||
        html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
    const description = descMatch ? descMatch[1] : '';

    // Extract image
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i) ||
        html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"[^>]*>/i);
    const image = imageMatch ? imageMatch[1] : null;

    // Ensure image URL is absolute
    let absoluteImage = image;
    if (image && !image.startsWith('http')) {
        try {
            absoluteImage = new URL(image, url).href;
        } catch (e) {
            absoluteImage = null;
        }
    }

    return {
        url: url,
        title: title.trim(),
        description: description.trim(),
        image: absoluteImage,
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`
    };
}

// Alternative approach: Use a content script to parse HTML in the page context
async function fetchMetadataAlternative(url) {
    try {
        // This approach would require injecting a content script into a temporary tab
        // It's more complex but more reliable for parsing HTML
        return await new Promise((resolve) => {
            chrome.tabs.create({ url: "about:blank", active: false }, (tab) => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: parseHTMLInPageContext,
                    args: [url]
                }, (results) => {
                    chrome.tabs.remove(tab.id);
                    if (results && results[0]) {
                        resolve(results[0]);
                    } else {
                        resolve(fallbackMetadata(url));
                    }
                });
            });
        });
    } catch (error) {
        console.error('Alternative metadata fetch failed:', error);
        return fallbackMetadata(url);
    }
}

function fallbackMetadata(url) {
    return {
        url: url,
        title: new URL(url).hostname,
        description: '',
        image: null,
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`
    };
}

// This function would be executed in the page context
function parseHTMLInPageContext(url) {
    // This is just a placeholder - this approach is more complex
    return {
        url: url,
        title: document.title || new URL(url).hostname,
        description: '',
        image: null,
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`
    };
}