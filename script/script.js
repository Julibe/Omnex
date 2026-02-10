let debug = true;
console.clear();

const config_smoothness = 0.08;
const config_tilt = 15;
const config_magnet = 10;

const lang_map = { 'js': 'javascript', 'php': 'php', 'css': 'css', 'html': 'markup', 'json': 'json', 'md': 'markdown' };
const text_extensions = Object.keys(lang_map).concat(['txt', 'log', 'sql']);

const active_interactions = new Map();

/**
 * Linear Interpolation Logic
 */
function lerp(start, end, factor) {
	return start + (end - start) * factor;
}

/**
 * Kinetic Animation Loop
 */
function runKineticLoop() {
	if (active_interactions.size === 0) return;

	active_interactions.forEach((state, card) => {
		state.curr_rx = lerp(state.curr_rx, state.targ_rx, config_smoothness);
		state.curr_ry = lerp(state.curr_ry, state.targ_ry, config_smoothness);
		state.curr_mx = lerp(state.curr_mx, state.targ_mx, config_smoothness);
		state.curr_my = lerp(state.curr_my, state.targ_my, config_smoothness);

		card.style.transform = `perspective(1000px) rotateX(${state.curr_rx}deg) rotateY(${state.curr_ry}deg) scale3d(1.02, 1.02, 1.02)`;

		const magnet = card.querySelector('.magnetic-element');
		if (magnet) {
			magnet.style.transform = `translate3d(${state.curr_mx}px, ${state.curr_my}px, 20px)`;
		}

		const delta = Math.abs(state.curr_rx) + Math.abs(state.curr_ry);
		if (!state.active && delta < 0.01) {
			card.style.transform = '';
			if (magnet) magnet.style.transform = '';
			active_interactions.delete(card);
		}
	});

	requestAnimationFrame(runKineticLoop);
}

function handleInteraction(event, card) {
	try {
		const rect = card.getBoundingClientRect();
		const mouse_x = event.clientX - rect.left;
		const mouse_y = event.clientY - rect.top;
		const center_x = rect.width / 2;
		const center_y = rect.height / 2;

		const target_rx = -((mouse_y - center_y) / center_y) * config_tilt;
		const target_ry = ((mouse_x - center_x) / center_x) * config_tilt;
		const target_mx = ((mouse_x - center_x) / center_x) * config_magnet;
		const target_my = ((mouse_y - center_y) / center_y) * config_magnet;

		if (!active_interactions.has(card)) {
			active_interactions.set(card, {
				active: true, curr_rx: 0, curr_ry: 0, curr_mx: 0, curr_my: 0,
				targ_rx: target_rx, targ_ry: target_ry, targ_mx: target_mx, targ_my: target_my
			});
			requestAnimationFrame(runKineticLoop);
		} else {
			const state = active_interactions.get(card);
			state.active = true;
			state.targ_rx = target_rx;
			state.targ_ry = target_ry;
			state.targ_mx = target_mx;
			state.targ_my = target_my;
		}
	} catch (err) { if (debug) console.error(err); }
}

function handleMouseLeave(card) {
	if (active_interactions.has(card)) {
		const state = active_interactions.get(card);
		state.active = false; state.targ_rx = 0; state.targ_ry = 0; state.targ_mx = 0; state.targ_my = 0;
	}
}

/**
 * Global Viewer Logic - Restored Open Original (mDown) logic
 */
window.openViewer = async function openViewer(el) {
    try {
        const payload = atob(el.getAttribute('data-b64'));
        const meta = JSON.parse(payload);

        if (debug) console.log("%c[Viewer] %cOpening sector:", "color: #d946ef", "color: inherit", meta.filename);

        // SYNC UI ELEMENTS
        document.getElementById('mTitle').innerText = meta.filename;
        document.getElementById('mMeta').innerText = `${meta.size_formatted} | ${meta.mime_type}`;

        // CRITICAL FIX: Update Open Original link
        const download_link = document.getElementById('mDown');
        download_link.href = meta.actual_path;
        download_link.setAttribute('download', meta.filename);

        document.getElementById('mBody').innerHTML = '<div class="loader"><i class="fa-solid fa-sync fa-spin"></i></div>';
        document.getElementById('modal').classList.add('active');

        const ext = meta.extension.toLowerCase();

        if (['jpg','png','webp','svg','gif'].includes(ext)) {
            document.getElementById('mBody').innerHTML = `<img src="${meta.actual_path}" style="max-width:90%; max-height:90%; border-radius:12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">`;
        }
        else if (['mp4', 'webm', 'mov'].includes(ext)) {
            document.getElementById('mBody').innerHTML = `<video controls autoplay style="width:100%; max-height:100%;"><source src="${meta.actual_path}"></video>`;
        }
        else if (['glb','gltf'].includes(ext)) {
            document.getElementById('mBody').innerHTML = `<model-viewer src="${meta.actual_path}" auto-rotate camera-controls shadow-intensity="1" style="width:100%; height:100%;"></model-viewer>`;
        }
        else if (text_extensions.includes(ext)) {
            const resp = await fetch(meta.actual_path);
            const content = await resp.text();
            const viewer_div = document.createElement('div');
            viewer_div.className = 'text-viewer-container';
            viewer_div.style.cssText = "padding:2.5rem; color:#c9d1d9; font-family:monospace; width:100%; height:100%; overflow:auto; background:#0d1117;";

            if (ext === 'md') {
                viewer_div.innerHTML = marked.parse(content);
            } else {
                const lang = lang_map[ext] || 'none';
                viewer_div.innerHTML = `<pre class="language-${lang}"><code class="language-${lang}">${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
                setTimeout(() => Prism.highlightElement(viewer_div.querySelector('code')), 10);
            }
            document.getElementById('mBody').innerHTML = '';
            document.getElementById('mBody').appendChild(viewer_div);
        }
        else {
            document.getElementById('mBody').innerHTML = `<div style="text-align:center;"><i class="fa-solid fa-file-circle-exclamation" style="font-size:4rem; color:var(--accent);"></i><p>PREVIEW_NOT_SUPPORTED</p></div>`;
        }

        if (toast) {
            const t = document.getElementById('toast');
            t.innerText = `Sector Accessed: ${meta.filename}`;
            t.classList.add('visible');
            setTimeout(() => t.classList.remove('visible'), 3000);
        }

    } catch (e) { console.error("%c[System] %cViewer Failure", "color: #ff595e", "color: inherit", e); }
};

window.closeModal = function closeModal() {
	const modal = document.getElementById('modal');
    modal.querySelectorAll('video, audio').forEach(m => m.pause());
    modal.classList.remove('active');
    setTimeout(() => { document.getElementById('mBody').innerHTML = ''; }, 250);
};

window.filterGrid = function filterGrid() {
	const val = document.getElementById('assetSearch').value.toLowerCase();
	document.querySelectorAll('.interactive-card').forEach(card => {
		card.style.display = card.getAttribute('data-name').includes(val) ? 'flex' : 'none';
	});
};

window.toggleSidebar = function toggleSidebar() {
	document.getElementById('mainSidebar').classList.toggle('open');
};

document.addEventListener('DOMContentLoaded', () => {
    if (debug) console.log("%c[Omnex] %cKernel Loaded. Optimizing physics.", "color: #d946ef", "color: inherit");
	document.querySelectorAll('.interactive-card').forEach(card => {
		card.addEventListener('mousemove', (e) => handleInteraction(e, card));
		card.addEventListener('mouseleave', () => handleMouseLeave(card));
	});
	document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
});