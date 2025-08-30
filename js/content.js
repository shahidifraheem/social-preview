// Track extension validity
let extensionContextValid = true;

// Initialize preview container
let previewContainer;
let currentLink = null; // Track the currently hovered link

// Initialize the system when injected
initializeSystem();

function initializeSystem() {
    initializePreviewContainer();
    setupEventListeners();
    setupMutationObserver();
}

function initializePreviewContainer() {
    if (!document.getElementById('social-preview-container')) {
        previewContainer = document.createElement('div');
        previewContainer.id = 'social-preview-container';
        document.body.appendChild(previewContainer);
    } else {
        previewContainer = document.getElementById('social-preview-container');
    }
}

function setupEventListeners() {
    document.addEventListener('mouseover', handleLinkHover);
    document.addEventListener('mouseout', handleLinkLeave);
    document.addEventListener('scroll', hidePreview);
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function setupMutationObserver() {
    const observer = new MutationObserver(() => {
        if (!document.getElementById('social-preview-container')) {
            initializePreviewContainer();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function handleLinkHover(e) {
    const link = e.target.closest('a');
    if (!link || !link.href) return;

    currentLink = link; // Store the current link

    if (!extensionContextValid) {
        showErrorPreview('Extension disconnected - please refresh page');
        return;
    }

    showPreview(link);
}

function handleLinkLeave(e) {
    if (!previewContainer) return;
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.target.contains(relatedTarget)) {
        hidePreview();
        currentLink = null;
    }
}

function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        checkExtensionContext();
    }
}

function checkExtensionContext() {
    try {
        if (!chrome.runtime?.id) {
            extensionContextValid = false;
            return false;
        }
        return true;
    } catch (e) {
        extensionContextValid = false;
        return false;
    }
}

async function showPreview(link) {
    if (!extensionContextValid || !checkExtensionContext()) {
        showErrorPreview('Extension disconnected - please refresh page');
        return;
    }

    try {
        if (!previewContainer) {
            initializePreviewContainer();
        }

        // Show loading state first
        showLoadingPreview(link);

        const metadata = await getLinkMetadata(link.href);
        renderPreview(link, metadata);
    } catch (error) {
        console.error('Preview error:', error);
        showErrorPreview('Failed to load preview');
    }
}

async function getLinkMetadata(url) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { type: 'FETCH_METADATA', url },
            (response) => {
                if (chrome.runtime.lastError) {
                    extensionContextValid = false;
                    reject(new Error('Extension context invalid'));
                    return;
                }
                resolve(response || { url });
            }
        );
    });
}

function positionPreview(link) {
    if (!link || !previewContainer) return;

    const rect = link.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Calculate position - try to show below the link first
    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;

    // Check if preview would go off screen
    const previewHeight = previewContainer.offsetHeight || 200; // Estimate height
    const previewWidth = previewContainer.offsetWidth || 320; // Estimate width

    // If preview would go below screen, show above instead
    if (top + previewHeight > window.scrollY + viewportHeight) {
        top = rect.top + window.scrollY - previewHeight - 5;
    }

    // If preview would go off right side of screen, adjust left
    if (left + previewWidth > window.scrollX + viewportWidth) {
        left = window.scrollX + viewportWidth - previewWidth - 10;
    }

    // Ensure minimum positioning
    top = Math.max(10, top);
    left = Math.max(10, left);

    previewContainer.style.top = `${top}px`;
    previewContainer.style.left = `${left}px`;
}

function renderPreview(link, metadata) {
    previewContainer.innerHTML = `
        <div class="preview-card">
            ${metadata.image ? `<img src="${metadata.image}" class="preview-image">` : ''}
            <div class="preview-content">
                <div class="preview-title">${metadata.title || 'No title'}</div>
                <div class="preview-description">${metadata.description || 'No description available'}</div>
                <div class="preview-url">
                    ${metadata.favicon ? `<img src="${metadata.favicon}" class="preview-favicon">` : ''}
                    <span>${new URL(metadata.url).hostname}</span>
                </div>
            </div>
        </div>
    `;
    previewContainer.style.display = 'block';
    positionPreview(link);
}

function showLoadingPreview(link) {
    if (!previewContainer) return;
    previewContainer.innerHTML = `
        <div class="preview-card loading">
            <div class="preview-content">
                <div class="preview-title">Loading preview...</div>
            </div>
        </div>
    `;
    previewContainer.style.display = 'block';
    positionPreview(link);
}

function showErrorPreview(message) {
    if (!previewContainer || !currentLink) return;

    previewContainer.innerHTML = `
        <div class="preview-card error">
            <div class="preview-content">
                <div class="preview-title">${message}</div>
                <div class="preview-description">Try refreshing the page</div>
            </div>
        </div>
    `;
    previewContainer.style.display = 'block';
    positionPreview(currentLink); // Position using the current link
}

function hidePreview() {
    if (!previewContainer) return;
    previewContainer.style.display = 'none';
}

// Listen for extension disconnect
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'EXTENSION_DISCONNECTED') {
        extensionContextValid = false;
        showErrorPreview('Extension disconnected - please refresh page');
    }
});