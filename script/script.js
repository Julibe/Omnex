let debug = true;
console.clear();

const tilt_limit = 15;
const magnet_force = 20;

const modal_overlay = document.getElementById('modal');
const modal_body = document.getElementById('mBody');
const asset_title = document.getElementById('mTitle');
const asset_meta = document.getElementById('mMeta');
const download_link = document.getElementById('mDown');
const toast_container = document.getElementById('toast');

/**
 * Handle 3D Perspective Rotation and Magnetic Attraction
 * Preserving full logical steps for animation fidelity
 */
function handleInteraction(event, card) {
    try {
        const rect_data = card.getBoundingClientRect();
        const x_coord = event.clientX - rect_data.left;
        const y_coord = event.clientY - rect_data.top;

        const center_point_x = rect_data.width / 2;
        const center_point_y = rect_data.height / 2;

        const rotate_axis_x = -((y_coord - center_point_y) / center_point_y) * tilt_limit;
        const rotate_axis_y = ((x_coord - center_point_x) / center_point_x) * tilt_limit;

        // Apply 3D perspective transformation
        card.style.transform = `perspective(1000px) rotateX(${rotate_axis_x}deg) rotateY(${rotate_axis_y}deg) scale3d(1.02, 1.02, 1.02)`;

        // Magnetic Attraction Logic for Inner Element
        const inner_magnet = card.querySelector('.magnetic-element');
        if (inner_magnet) {
            const pull_x = ((x_coord - center_point_x) / center_point_x) * magnet_force;
            const pull_y = ((y_coord - center_point_y) / center_point_y) * magnet_force;
            inner_magnet.style.transform = `translate3d(${pull_x}px, ${pull_y}px, 40px)`;
        }

        if (debug) {
            // Highly verbose tracking for UI state
            // console.log(`[State] Interaction detected. Vector: ${rotate_axis_x.toFixed(2)}x / ${rotate_axis_y.toFixed(2)}y`);
        }
    } catch (err_obj) {
        if (debug) console.error("%c[System Error] %cInteraction Logic Failed", "color: #ff595e; font-weight: bold", "color: inherit", err_obj);
    }
}

/**
 * Reset element to neutral state on pointer exit
 */
function resetCardState(card) {
    if (debug) console.log("%c[System] %cResetting interactive state", "color: #fca311; font-weight: bold", "color: inherit");
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    const inner_magnet = card.querySelector('.magnetic-element');
    if (inner_magnet) inner_magnet.style.transform = `translate3d(0, 0, 0)`;
}

/**
 * Display UI Toast Notifications
 */
function notifyUser(msg_text) {
    if (debug) {
        console.log(`%c[Omnex Notification] %c${msg_text}`, "color: var(--accent); font-weight: bold", "color: inherit");
    }
    if (toast_container) {
        toast_container.innerText = msg_text;
        toast_container.classList.add('visible');
        setTimeout(() => toast_container.classList.remove('visible'), 3000);
    }
}

/**
 * Live search filter for asset grid logic
 */
window.filterGrid = function filterGrid() {
    const search_input_val = document.getElementById('assetSearch').value.toLowerCase();
    const grid_cards = document.querySelectorAll('.interactive-card');

    if (debug) console.log(`%c[Search Engine] %cFiltering assets for query: "${search_input_val}"`, "color: var(--accent); font-weight: bold", "color: inherit");

    grid_cards.forEach(card_node => {
        const asset_name_val = card_node.getAttribute('data-name');
        if (asset_name_val.includes(search_input_val)) {
            card_node.style.display = 'flex';
        } else {
            card_node.style.display = 'none';
        }
    });
};

/**
 * Viewer Modal Orchestration and Media Handling
 */
window.openViewer = function openViewer(target_card) {
    try {
        const payload_b64 = target_card.getAttribute('data-b64');
        const asset_metadata = JSON.parse(atob(payload_b64));

        if (debug) {
            console.log("%c[Media Server] %cInitializing viewer for:", "color: #00f5d4; font-weight: bold", "color: inherit", asset_metadata.filename);
        }

        asset_title.innerText = asset_metadata.filename;
        asset_meta.innerText = `${asset_metadata.size_formatted} | ${asset_metadata.mime_type}`;
        download_link.href = asset_metadata.actual_path;

        const f_extension = asset_metadata.extension.toLowerCase();
        let viewer_markup = '';

        if (['jpg','jpeg','png','webp','gif','svg'].includes(f_extension)) {
            viewer_markup = `<img src="${asset_metadata.actual_path}" style="max-width:90%; max-height:90%; border-radius:12px; box-shadow: 0 30px 60px rgba(0,0,0,0.5);">`;
        } else if (['glb','gltf'].includes(f_extension)) {
            viewer_markup = `<model-viewer src="${asset_metadata.actual_path}" auto-rotate camera-controls shadow-intensity="1" style="width:100%; height:100%;"></model-viewer>`;
        } else if (['mp4', 'webm', 'mov'].includes(f_extension)) {
            viewer_markup = `<video controls autoplay style="width:100%; max-height:100%;"><source src="${asset_metadata.actual_path}"></video>`;
        } else if (['mp3', 'wav', 'ogg'].includes(f_extension)) {
            viewer_markup = `<div style="text-align:center;"><div style="font-size:5rem;margin-bottom:1rem;color:var(--accent);"><i class="fa-solid fa-music"></i></div><audio controls autoplay style="width:300px;"><source src="${asset_metadata.actual_path}"></audio></div>`;
        } else {
            viewer_markup = `<div style="color: #4b5563; font-family: monospace; display:flex; flex-direction:column; align-items:center;"><i class="fa-solid fa-file-circle-exclamation" style="font-size:4rem; margin-bottom:1rem;"></i>PREVIEW_UNAVAILABLE: .${f_extension}</div>`;
        }

        modal_body.innerHTML = viewer_markup;
        modal_overlay.classList.add('active');
        notifyUser(`Opening Sector Asset: ${asset_metadata.filename}`);

    } catch (session_err) {
        console.error("%c[Critical Error] %cViewer session failed to initialize", "color: #ff595e; font-weight: bold", "color: inherit", session_err);
    }
};

/**
 * Terminate viewer session and release media resources
 */
window.closeModal = function closeModal() {
    if (debug) console.log("%c[Media Server] %cTerminating session", "color: #9ca3af; font-weight: bold", "color: inherit");
    modal_overlay.querySelectorAll('video, audio').forEach(media_node => media_node.pause());
    modal_overlay.classList.remove('active');
    setTimeout(() => {
        modal_body.innerHTML = '';
    }, 250);
};

/**
 * Mobile Interface Toggle logic
 */
window.toggleSidebar = function toggleSidebar() {
    if (debug) console.log("%c[Interface] %cMobile Sidebar Toggle Triggered", "color: #a855f7; font-weight: bold", "color: inherit");
    document.getElementById('mainSidebar').classList.toggle('open');
};

/**
 * Initialize core listeners on DOM satisfaction
 */
document.addEventListener('DOMContentLoaded', () => {
    if (debug) console.log("%c[Omnex Core] %cSystem Satisfied. Orchestrating listeners.", "color: var(--accent); font-weight: bold", "color: inherit");

    const interactive_cards = document.querySelectorAll('.interactive-card');
    interactive_cards.forEach(card_node => {
        card_node.addEventListener('mousemove', (e_event) => handleInteraction(e_event, card_node));
        card_node.addEventListener('mouseleave', () => resetCardState(card_node));
    });

    document.addEventListener('keydown', (e_key) => {
        if (e_key.key === 'Escape') closeModal();
    });

    if (modal_overlay) {
        modal_overlay.addEventListener('click', (e_click) => {
            if (e_click.target.id === 'modal') closeModal();
        });
    }
});