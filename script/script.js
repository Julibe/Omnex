/**
 * Omnex UI Controller
 */

'use strict';

// --- CONFIGURATION ---
const UI_CONFIG = {
    tilt_max: 15,
    tilt_scale: 1.05,
    smoothness: 0.1
};

// --- GLOBAL STATE ---
const activeAnimations = new Map();
let waveSurferInstance = null;

// --- UTILITIES ---
const lerp = (start, end, factor) => start + (end - start) * factor;

/**
 * KINETIC CARD ENGINE
 */
function updateKineticCards() {
    activeAnimations.forEach((state, card) => {
        state.currentX = lerp(state.currentX, state.targetX, UI_CONFIG.smoothness);
        state.currentY = lerp(state.currentY, state.targetY, UI_CONFIG.smoothness);
        card.style.transform = `perspective(1000px) rotateX(${state.currentX}deg) rotateY(${state.currentY}deg) scale3d(${UI_CONFIG.tilt_scale}, ${UI_CONFIG.tilt_scale}, ${UI_CONFIG.tilt_scale})`;

        const icon = card.querySelector('.magnetic-element');
        if(icon) {
            icon.style.transform = `translateX(${state.currentY * 2}px) translateY(${state.currentX * 2}px)`;
        }

        if (!state.active && Math.abs(state.currentX) < 0.01 && Math.abs(state.currentY) < 0.01) {
            card.style.transform = '';
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
 * VIEWER SYSTEM
 */
window.openViewer = async function(element) {
    try {
        const b64 = element.getAttribute('data-b64');
        const item = JSON.parse(atob(b64));

        const modal = document.getElementById('modal');
        const mBody = document.getElementById('mBody');

        document.getElementById('mTitle').textContent = item.filename;
        document.getElementById('mMeta').textContent = `${item.mime_type} • ${item.size_formatted}`;

        const mDown = document.getElementById('mDown');
        mDown.href = item.actual_path;
        mDown.setAttribute('download', item.filename);

        const ext = item.extension;
        const path = item.actual_path;
        let mediaHTML = '';

        if(waveSurferInstance) {
            waveSurferInstance.destroy();
            waveSurferInstance = null;
        }

        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'heic', 'avif','svg'].includes(ext);

        if (['glb','gltf','obj','fbx'].includes(ext)) {
            mediaHTML = `<model-viewer src="${path}" camera-controls auto-rotate shadow-intensity="1" ar style="width: 100%; height: 100%;" background-color="#121212"></model-viewer>`;
        } else if (['mp4', 'webm', 'mov', 'mkv','m4v', 'avi', 'flv', 'wmv', 'mts', 'ts', 'ogv', 'vp9'].includes(ext)) {
            mediaHTML = `<video controls autoplay style="max-width: 100%; max-height: 100%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);"><source src="${path}" type="${item.mime_type}"></video>`;
        } else if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'weba'].includes(ext)) {
            mediaHTML = `<div style="width: 100%; max-width: 600px; padding: 20px;"><div id="waveform" style="width: 100%;"></div><div style="text-align: center; margin-top: 20px;"><button class="btn" onclick="toggleAudio()"><i id="playPauseIcon" class="fa-solid fa-play"></i> Play / Pause</button></div></div>`;
            setTimeout(() => initAudio(path), 50);
        } else if (isImage) {
            mediaHTML = `<img src="${path}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">`;
        } else if (['json', 'xml', 'js', 'css', 'html', 'php', 'txt', 'md', 'yml'].includes(ext)) {
            mediaHTML = `<div class="text-viewer-container"><pre><code id="codeBlock" class="language-${ext}">Loading...</code></pre></div>`;
            loadTextContent(path);
        } else if(['pdf'].includes(ext)) {
            mediaHTML = `<iframe src="${path}" style="width: 100%; height: 100%; border: none; border-radius: 12px;"></iframe>`;
        } else {
            mediaHTML = `<div style="text-align: center; color: #666;"><i class="fa-solid fa-file-circle-question" style="font-size: 4rem; margin-bottom: 1rem;"></i><p>Preview not available</p></div>`;
        }

        // TAB SYSTEM
        if (isImage) {
            mBody.innerHTML = `
                <div style="display: flex; flex-direction: column; width: 100%; height: 100%;">
                    <div class="modal-tabs">
                        <button class="modal-tab-btn active" onclick="switchTab('view')"><i class="fa-regular fa-eye"></i> Preview</button>
                        <button class="modal-tab-btn" onclick="switchTab('meta')"><i class="fa-solid fa-circle-info"></i> EXIF Data</button>
                    </div>
                    <div id="tab-view" class="tab-content active">${mediaHTML}</div>
                    <div id="tab-meta" class="tab-content">
                        <div class="exif-container"><div style="text-align:center; padding: 2rem; color: var(--text_dim);"><i class="fa-solid fa-spinner fa-spin"></i> Reading Metadata...</div></div>
                    </div>
                </div>`;
            loadExifData(path);
        } else {
            mBody.innerHTML = mediaHTML;
        }

        modal.classList.add('active');

    } catch (e) {
        console.error("Viewer Error:", e);
        showToast("Error opening file", "error");
    }
};

window.closeModal = function() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
    if(waveSurferInstance) {
        waveSurferInstance.destroy();
        waveSurferInstance = null;
    }
    setTimeout(() => { document.getElementById('mBody').innerHTML = ''; }, 300);
};

// --- TABS & EXIF LOGIC ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
};

async function loadExifData(url) {
    const container = document.querySelector('#tab-meta .exif-container');

    try {
        // EXPLICIT CHECK FOR GLOBAL OBJECT
        if (typeof window.ExifReader === 'undefined') {
            throw new Error("ExifReader library not loaded");
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        const fileBlob = await response.blob();

        // Use global ExifReader
        const tags = await window.ExifReader.load(fileBlob);

        const ignoredTags = ['MakerNote', 'UserComment', 'Thumbnail', 'PrintIM', 'Padding', 'ColorSpace'];
        let tableHtml = '<table class="exif-table"><tbody>';
        let count = 0;

        for (let key in tags) {
            if (ignoredTags.includes(key)) continue;
            let val = tags[key].description ? tags[key].description : tags[key].value;
            if (typeof val === 'object') val = JSON.stringify(val);
            if (typeof val === 'string' && val.length > 50) val = val.substring(0, 50) + '...';

            tableHtml += `<tr><td class="exif-key">${key}</td><td class="exif-val">${val}</td></tr>`;
            count++;
        }
        tableHtml += '</tbody></table>';

        container.innerHTML = (count === 0) ? '<div style="text-align:center; padding:2rem; color:#666;">No EXIF metadata found.</div>' : tableHtml;

    } catch (error) {
        console.warn('Exif Error', error);
        container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--accent);">Could not read metadata.<br><small style="opacity:0.6">' + error.message + '</small></div>';
    }
}

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
        });
}

function initAudio(path) {
    const rootStyles = getComputedStyle(document.documentElement);
    const accent = rootStyles.getPropertyValue('--accent').trim();
    waveSurferInstance = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#4b5563',
        progressColor: accent,
        cursorColor: '#ffffff',
        barWidth: 2, barRadius: 3, height: 120, barGap: 2
    });
    waveSurferInstance.load(path);
    waveSurferInstance.on('ready', () => waveSurferInstance.play());
    waveSurferInstance.on('play', () => document.getElementById('playPauseIcon').className = 'fa-solid fa-pause');
    waveSurferInstance.on('pause', () => document.getElementById('playPauseIcon').className = 'fa-solid fa-play');
}

window.toggleAudio = function() {
    if(waveSurferInstance) waveSurferInstance.playPause();
};

window.filterGrid = function() {
    // Client-side filtering currently only filters what's on the current page
    // For full filtering with pagination, you'd typically need server-side filtering.
    // This implementation just hides items on the current 25-item page.
    const input = document.getElementById('assetSearch');
    const filter = input.value.toLowerCase();
    const cards = document.querySelectorAll('.interactive-card');
    cards.forEach(card => {
        const name = card.getAttribute('data-name');
        card.style.display = name.includes(filter) ? "flex" : "none";
    });
};

window.toggleSidebar = function() {
    document.getElementById('mainSidebar').classList.toggle('open');
};

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.interactive-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => handleCardMove(e, card));
        card.addEventListener('mouseleave', () => handleCardLeave(card));
    });

    const modal = document.getElementById('modal');
    modal.addEventListener('click', (e) => {
        if(e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") closeModal();
    });
});