/**
 * Omnex UI Controller - Enhanced Version
 * With ExifReader Fix, Navigation Arrows, and Cool Animations
 */

'use strict';

// --- CONFIGURATION ---
const UI_CONFIG = {
    tilt_max: 15,
    tilt_scale: 1.05,
    smoothness: 0.1,
    transition_speed: 0.4
};

// --- GLOBAL STATE ---
const activeAnimations = new Map();
let waveSurferInstance = null;
let currentAssetList = []; // For navigation
let currentAssetIndex = 0; // Current position in list

// --- UTILITIES ---
const lerp = (start, end, factor) => start + (end - start) * factor;

/**
 * KINETIC CARD ENGINE - Enhanced with smoother animations
 */
function updateKineticCards() {
    activeAnimations.forEach((state, card) => {
        state.currentX = lerp(state.currentX, state.targetX, UI_CONFIG.smoothness);
        state.currentY = lerp(state.currentY, state.targetY, UI_CONFIG.smoothness);

        const transform = `perspective(1000px) rotateX(${state.currentX}deg) rotateY(${state.currentY}deg) scale3d(${UI_CONFIG.tilt_scale}, ${UI_CONFIG.tilt_scale}, ${UI_CONFIG.tilt_scale})`;
        card.style.transform = transform;

        const icon = card.querySelector('.magnetic-element');
        if(icon) {
            icon.style.transform = `translateX(${state.currentY * 2}px) translateY(${state.currentX * 2}px)`;
        }

        // Add glow effect based on tilt
        const glowIntensity = Math.abs(state.currentX) + Math.abs(state.currentY);
        card.style.boxShadow = `0 20px 40px rgba(0,0,0,0.5), 0 0 ${glowIntensity * 2}px var(--accent_glow)`;

        if (!state.active && Math.abs(state.currentX) < 0.01 && Math.abs(state.currentY) < 0.01) {
            card.style.transform = '';
            card.style.boxShadow = '';
            if(icon) icon.style.transform = '';
            activeAnimations.delete(card);
        }
    });

    if (activeAnimations.size > 0) requestAnimationFrame(updateKineticCards);
}

function handleCardMove(e, card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -UI_CONFIG.tilt_max;
    const rotateY = ((x - centerX) / centerX) * UI_CONFIG.tilt_max;

    if (!activeAnimations.has(card)) {
        activeAnimations.set(card, { active: true, currentX: 0, currentY: 0, targetX: rotateX, targetY: rotateY });
        requestAnimationFrame(updateKineticCards);
    } else {
        const state = activeAnimations.get(card);
        state.active = true; state.targetX = rotateX; state.targetY = rotateY;
    }
}

function handleCardLeave(card) {
    if (activeAnimations.has(card)) {
        const state = activeAnimations.get(card);
        state.active = false; state.targetX = 0; state.targetY = 0;
    }
}

/**
 * VIEWER SYSTEM - Enhanced with Navigation
 */
window.openViewer = async function(element) {
    try {
        const b64 = element.getAttribute('data-b64');
        const item = JSON.parse(atob(b64));

        // Build asset list for navigation (only files, not folders)
        buildAssetList();

        // Find current index
        currentAssetIndex = currentAssetList.findIndex(a => a.actual_path === item.actual_path);

        const modal = document.getElementById('modal');
        const mBody = document.getElementById('mBody');

        document.getElementById('mTitle').textContent = item.filename;
        document.getElementById('mMeta').textContent = `${item.mime_type} • ${item.size_formatted}`;

        const mDown = document.getElementById('mDown');
        mDown.href = item.actual_path;
        mDown.setAttribute('download', item.filename);

        renderAssetViewer(item);

        modal.classList.add('active');

    } catch (e) {
        console.error("Viewer Error:", e);
        showToast("Error opening file", "error");
    }
};

/**
 * Build list of all file assets for navigation
 */
function buildAssetList() {
    currentAssetList = [];
    const cards = document.querySelectorAll('.interactive-card');

    cards.forEach(card => {
        try {
            const b64 = card.getAttribute('data-b64');
            if (b64) {
                const item = JSON.parse(atob(b64));
                if (item.type !== 'dir') {
                    currentAssetList.push(item);
                }
            }
        } catch (e) {
            // Skip invalid items
        }
    });
}

/**
 * Render the appropriate viewer for the asset
 */
function renderAssetViewer(item) {
    const mBody = document.getElementById('mBody');

    if(waveSurferInstance) {
        waveSurferInstance.destroy();
        waveSurferInstance = null;
    }

    const ext = item.extension;
    const path = item.actual_path;
    let mediaHTML = '';

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'heic', 'avif', 'svg'].includes(ext);

    // Check if we need navigation arrows
    const needsNav = isImage || ['glb','gltf','obj','fbx'].includes(ext) ||
                     ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi', 'flv', 'wmv', 'mts', 'ts', 'ogv', 'vp9'].includes(ext) ||
                     ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'weba'].includes(ext);

    if (['glb','gltf','obj','fbx'].includes(ext)) {
        mediaHTML = `<model-viewer src="${path}" camera-controls auto-rotate shadow-intensity="1" ar style="width: 100%; height: 100%;" background-color="#121212"></model-viewer>`;
    } else if (['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi', 'flv', 'wmv', 'mts', 'ts', 'ogv', 'vp9'].includes(ext)) {
        mediaHTML = `<video controls autoplay style="max-width: 100%; max-height: 100%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);"><source src="${path}" type="${item.mime_type}"></video>`;
    } else if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'weba'].includes(ext)) {
        mediaHTML = `<div style="width: 100%; max-width: 600px; padding: 20px;"><div id="waveform" style="width: 100%;"></div><div style="text-align: center; margin-top: 20px;"><button class="btn" onclick="toggleAudio()"><i id="playPauseIcon" class="fa-solid fa-play"></i> Play / Pause</button></div></div>`;
        setTimeout(() => initAudio(path), 50);
    } else if (isImage) {
        mediaHTML = `<img src="${path}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;" class="fade-in-image">`;
    } else if (['json', 'xml', 'js', 'css', 'html', 'php', 'txt', 'md', 'yml'].includes(ext)) {
        mediaHTML = `<div class="text-viewer-container"><pre><code id="codeBlock" class="language-${ext}">Loading...</code></pre></div>`;
        loadTextContent(path);
    } else if(['pdf'].includes(ext)) {
        mediaHTML = `<iframe src="${path}" style="width: 100%; height: 100%; border: none; border-radius: 12px;"></iframe>`;
    } else {
        mediaHTML = `<div style="text-align: center; color: #666;"><i class="fa-solid fa-file-circle-question" style="font-size: 4rem; margin-bottom: 1rem;"></i><p>Preview not available</p></div>`;
    }

    // TAB SYSTEM for images with navigation
    if (isImage) {
        mBody.innerHTML = `
            <div class="viewer-container">
                ${needsNav ? `
                <button class="nav-arrow nav-prev ${currentAssetIndex <= 0 ? 'disabled' : ''}" onclick="navigateAsset(-1)" title="Previous (Left Arrow)">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                ` : ''}
                <div class="viewer-main">
                    <div class="modal-tabs">
                        <button class="modal-tab-btn active" onclick="switchTab('view', event)"><i class="fa-regular fa-eye"></i> Preview</button>
                        <button class="modal-tab-btn" onclick="switchTab('meta', event)"><i class="fa-solid fa-circle-info"></i> EXIF Data</button>
                    </div>
                    <div id="tab-view" class="tab-content active">
                        <div class="image-viewer-wrapper">${mediaHTML}</div>
                    </div>
                    <div id="tab-meta" class="tab-content">
                        <div class="exif-container">
                            <div style="text-align:center; padding: 2rem; color: var(--text_dim);">
                                <div class="exif-loading">
                                    <i class="fa-solid fa-spinner fa-spin"></i>
                                </div>
                                Reading Metadata...
                            </div>
                        </div>
                    </div>
                </div>
                ${needsNav ? `
                <button class="nav-arrow nav-next ${currentAssetIndex >= currentAssetList.length - 1 ? 'disabled' : ''}" onclick="navigateAsset(1)" title="Next (Right Arrow)">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
                ` : ''}
            </div>`;
        loadExifData(path);
    } else if (needsNav) {
        // Other media types with navigation
        mBody.innerHTML = `
            <div class="viewer-container">
                <button class="nav-arrow nav-prev ${currentAssetIndex <= 0 ? 'disabled' : ''}" onclick="navigateAsset(-1)" title="Previous (Left Arrow)">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="viewer-main">${mediaHTML}</div>
                <button class="nav-arrow nav-next ${currentAssetIndex >= currentAssetList.length - 1 ? 'disabled' : ''}" onclick="navigateAsset(1)" title="Next (Right Arrow)">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>`;
    } else {
        mBody.innerHTML = mediaHTML;
    }
}

/**
 * Navigate between assets
 */
window.navigateAsset = function(direction) {
    const newIndex = currentAssetIndex + direction;

    if (newIndex < 0 || newIndex >= currentAssetList.length) return;

    currentAssetIndex = newIndex;
    const item = currentAssetList[currentAssetIndex];

    // Update title and meta
    document.getElementById('mTitle').textContent = item.filename;
    document.getElementById('mMeta').textContent = `${item.mime_type} • ${item.size_formatted}`;

    const mDown = document.getElementById('mDown');
    mDown.href = item.actual_path;
    mDown.setAttribute('download', item.filename);

    // Re-render with animation
    const mBody = document.getElementById('mBody');
    mBody.classList.add('navigating');

    setTimeout(() => {
        renderAssetViewer(item);
        mBody.classList.remove('navigating');
    }, 150);
};

window.closeModal = function() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
    if(waveSurferInstance) {
        waveSurferInstance.destroy();
        waveSurferInstance = null;
    }
    currentAssetList = [];
    currentAssetIndex = 0;
    setTimeout(() => { document.getElementById('mBody').innerHTML = ''; }, 300);
};

// --- TABS & EXIF LOGIC ---
window.switchTab = function(tabName, event) {
    if (event) {
        document.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
};

/**
 * FIXED EXIF DATA LOADER
 * Uses ArrayBuffer for better compatibility with ExifReader
 */
async function loadExifData(url) {
    const container = document.querySelector('#tab-meta .exif-container');

    try {
        // Check for ExifReader availability with retry
        let attempts = 0;
        while (typeof window.ExifReader === 'undefined' && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (typeof window.ExifReader === 'undefined') {
            throw new Error("ExifReader library not loaded. Please refresh the page.");
        }

        // Fetch as ArrayBuffer (required by ExifReader)
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();

        // Use ExifReader with ArrayBuffer
        const tags = window.ExifReader.load(arrayBuffer);

        const ignoredTags = ['MakerNote', 'UserComment', 'Thumbnail', 'PrintIM', 'Padding', 'ColorSpace', 'GPSLatitudeRef', 'GPSLongitudeRef'];
        let tableHtml = '<table class="exif-table"><tbody>';
        let count = 0;

        // Group tags by category
        const categories = {
            'Image Info': [],
            'Camera Settings': [],
            'GPS Data': [],
            'Other': []
        };

        for (let key in tags) {
            if (ignoredTags.some(ignored => key.includes(ignored))) continue;

            let val = tags[key].description || tags[key].value;
            if (Array.isArray(val) && val.length > 10) {
                val = `[${val.length} values]`;
            } else if (typeof val === 'object') {
                val = JSON.stringify(val);
            }
            if (typeof val === 'string' && val.length > 80) {
                val = val.substring(0, 80) + '...';
            }

            // Categorize
            let category = 'Other';
            if (['ImageWidth', 'ImageHeight', 'Orientation', 'XResolution', 'YResolution', 'Software', 'DateTime', 'Make', 'Model'].some(k => key.includes(k))) {
                category = 'Image Info';
            } else if (['ExposureTime', 'FNumber', 'ISOSpeedRatings', 'FocalLength', 'ApertureValue', 'ExposureMode', 'WhiteBalance', 'Flash'].some(k => key.includes(k))) {
                category = 'Camera Settings';
            } else if (key.includes('GPS')) {
                category = 'GPS Data';
            }

            categories[category].push({ key, val });
            count++;
        }

        // Render categorized
        for (let cat in categories) {
            if (categories[cat].length > 0) {
                tableHtml += `<tr class="exif-category"><td colspan="2"><i class="fa-solid ${cat === 'Image Info' ? 'fa-image' : cat === 'Camera Settings' ? 'fa-camera' : cat === 'GPS Data' ? 'fa-location-dot' : 'fa-circle-info'}"></i> ${cat}</td></tr>`;
                categories[cat].forEach(({ key, val }) => {
                    tableHtml += `<tr><td class="exif-key">${key}</td><td class="exif-val">${val}</td></tr>`;
                });
            }
        }
        tableHtml += '</tbody></table>';

        container.innerHTML = (count === 0)
            ? '<div class="exif-empty"><i class="fa-solid fa-circle-info"></i><p>No EXIF metadata found in this image.</p></div>'
            : tableHtml;

    } catch (error) {
        console.warn('Exif Error:', error);
        container.innerHTML = `
            <div class="exif-error">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>Could not read metadata</p>
                <small>${error.message}</small>
                <button class="btn" onclick="retryExif('${url}')" style="margin-top: 1rem;">
                    <i class="fa-solid fa-rotate"></i> Retry
                </button>
            </div>`;
    }
}

window.retryExif = function(url) {
    loadExifData(url);
};

// --- HELPER LOADERS ---
function loadTextContent(path) {
    fetch(path)
        .then(r => r.text())
        .then(text => {
            const codeBlock = document.getElementById('codeBlock');
            if(codeBlock) {
                codeBlock.textContent = text;
                if(window.Prism) Prism.highlightElement(codeBlock);
            }
        })
        .catch(err => {
            const codeBlock = document.getElementById('codeBlock');
            if(codeBlock) {
                codeBlock.textContent = 'Error loading file content';
            }
        });
}

function initAudio(path) {
    const rootStyles = getComputedStyle(document.documentElement);
    const accent = rootStyles.getPropertyValue('--accent').trim() || '#d946ef';

    waveSurferInstance = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#4b5563',
        progressColor: accent,
        cursorColor: '#ffffff',
        barWidth: 2,
        barRadius: 3,
        height: 120,
        barGap: 2
    });
    waveSurferInstance.load(path);
    waveSurferInstance.on('ready', () => waveSurferInstance.play());
    waveSurferInstance.on('play', () => {
        const icon = document.getElementById('playPauseIcon');
        if(icon) icon.className = 'fa-solid fa-pause';
    });
    waveSurferInstance.on('pause', () => {
        const icon = document.getElementById('playPauseIcon');
        if(icon) icon.className = 'fa-solid fa-play';
    });
}

window.toggleAudio = function() {
    if(waveSurferInstance) waveSurferInstance.playPause();
};

window.filterGrid = function() {
    const input = document.getElementById('assetSearch');
    const filter = input.value.toLowerCase();
    const cards = document.querySelectorAll('.interactive-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const name = card.getAttribute('data-name');
        const matches = name.includes(filter);
        card.style.display = matches ? "flex" : "none";
        if (matches) visibleCount++;
    });

    // Show/hide no results message
    let noResults = document.querySelector('.no-results');
    if (visibleCount === 0 && filter !== '') {
        if (!noResults) {
            noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><p>No assets found matching your search</p>';
            document.getElementById('assetGrid').appendChild(noResults);
        }
    } else if (noResults) {
        noResults.remove();
    }
};

window.toggleSidebar = function() {
    document.getElementById('mainSidebar').classList.toggle('open');
};

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast visible ${type}`;
    setTimeout(() => toast.classList.remove('visible'), 3000);
}

// --- KEYBOARD NAVIGATION ---
function handleKeyboard(e) {
    const modal = document.getElementById('modal');
    if (!modal.classList.contains('active')) return;

    switch (e.key) {
        case 'Escape':
            closeModal();
            break;
        case 'ArrowLeft':
            navigateAsset(-1);
            e.preventDefault();
            break;
        case 'ArrowRight':
            navigateAsset(1);
            e.preventDefault();
            break;
    }
}

// --- ANIMATION HELPERS ---
function addEntranceAnimation(element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';

    requestAnimationFrame(() => {
        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    });
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Card interactions
    const cards = document.querySelectorAll('.interactive-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => handleCardMove(e, card));
        card.addEventListener('mouseleave', () => handleCardLeave(card));

        // Add ripple effect on click
        card.addEventListener('click', function(e) {
            const ripple = document.createElement('div');
            ripple.className = 'ripple';
            const rect = this.getBoundingClientRect();
            ripple.style.left = (e.clientX - rect.left) + 'px';
            ripple.style.top = (e.clientY - rect.top) + 'px';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Modal interactions
    const modal = document.getElementById('modal');
    modal.addEventListener('click', (e) => {
        if(e.target === modal || e.target.classList.contains('viewer-container')) closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Preload ExifReader
    if (typeof window.ExifReader === 'undefined') {
        console.log('Waiting for ExifReader to load...');
    }
});

// Touch swipe support for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, false);

function handleSwipe() {
    const modal = document.getElementById('modal');
    if (!modal.classList.contains('active')) return;

    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swiped left - next
            navigateAsset(1);
        } else {
            // Swiped right - previous
            navigateAsset(-1);
        }
    }
}