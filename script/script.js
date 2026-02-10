let debug = true;
console.clear();

/* ==========================================================================
   CONFIG
========================================================================== */

const config_smoothness = 0.08;
const config_tilt = 15;
const config_magnet = 10;

/* ==========================================================================
   KINETIC CARD SYSTEM
========================================================================== */

const active_interactions = new Map();

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function runKineticLoop() {
	if (!active_interactions.size) return;

	active_interactions.forEach((s, card) => {
		s.rx = lerp(s.rx, s.trx, config_smoothness);
		s.ry = lerp(s.ry, s.try, config_smoothness);
		s.mx = lerp(s.mx, s.tmx, config_smoothness);
		s.my = lerp(s.my, s.tmy, config_smoothness);

		card.style.transform = `perspective(1000px)
			 rotateX(${s.rx}deg)
			 rotateY(${s.ry}deg)
			 scale3d(1.02,1.02,1.02)`;

		const magnet = card.querySelector(".magnetic-element");
		if (magnet) {
			magnet.style.transform = `translate3d(${s.mx}px, ${s.my}px, 20px)`;
		}

		if (!s.active && Math.abs(s.rx) + Math.abs(s.ry) < 0.01) {
			card.style.transform = "";
			if (magnet) magnet.style.transform = "";
			active_interactions.delete(card);
		}
	});

	requestAnimationFrame(runKineticLoop);
}

function handleInteraction(e, card) {
	const r = card.getBoundingClientRect();
	const x = e.clientX - r.left;
	const y = e.clientY - r.top;
	const cx = r.width / 2;
	const cy = r.height / 2;

	const trx = -((y - cy) / cy) * config_tilt;
	const tryy = ((x - cx) / cx) * config_tilt;
	const tmx = ((x - cx) / cx) * config_magnet;
	const tmy = ((y - cy) / cy) * config_magnet;

	if (!active_interactions.has(card)) {
		active_interactions.set(card, {
			active: true,
			rx: 0,
			ry: 0,
			mx: 0,
			my: 0,
			trx,
			try: tryy,
			tmx,
			tmy,
		});
		requestAnimationFrame(runKineticLoop);
	} else {
		const s = active_interactions.get(card);
		s.active = true;
		s.trx = trx;
		s.try = tryy;
		s.tmx = tmx;
		s.tmy = tmy;
	}
}

function handleMouseLeave(card) {
	const s = active_interactions.get(card);
	if (!s) return;
	s.active = false;
	s.trx = s.try = s.tmx = s.tmy = 0;
}

/* ==========================================================================
   MODAL REFERENCES
========================================================================== */

const modal = {
	root: null,
	body: null,
	title: null,
	meta: null,
	down: null,
};

/* ==========================================================================
   ASSET VIEWER
========================================================================== */

window.openViewer = function (card) {
	if (!card || !card.dataset || !card.dataset.b64) return;

	let data;
	try {
		data = JSON.parse(atob(card.dataset.b64));
	} catch (e) {
		if (debug) console.error(e);
		return;
	}

	const { filename, mime_type, size_formatted, actual_path, extension } =
		data;

	modal.title.textContent = filename || "Unknown";
	modal.meta.textContent = `${mime_type} • ${size_formatted}`;
	modal.down.href = actual_path;
	modal.down.setAttribute("download", filename || "");

	modal.body.innerHTML = "";

	/* ================= IMAGE ================= */

	if (mime_type.startsWith("image/")) {
		const img = document.createElement("img");
		img.src = actual_path;
		img.style.maxWidth = "100%";
		img.style.maxHeight = "75vh";
		img.style.objectFit = "contain";
		modal.body.appendChild(img);
	} else if (["glb", "gltf"].includes(extension)) {

	/* ================= 3D MODELS ================= */
		modal.body.innerHTML = `
			<model-viewer
				src="${actual_path}"
				camera-controls
				auto-rotate
				shadow-intensity="1"
				style="width:100%; height:75vh;">
			</model-viewer>
		`;
	} else if (mime_type.startsWith("audio/")) {

	/* ================= AUDIO + WAVESURFER ================= */
		const audio = document.createElement("audio");
		audio.src = actual_path;
		audio.controls = true;
		audio.style.width = "100%";

		const wave = document.createElement("div");
		wave.style.height = "100px";
		wave.style.marginTop = "12px";

		modal.body.appendChild(audio);
		modal.body.appendChild(wave);

		const ws = WaveSurfer.create({
			container: wave,
			waveColor: "#7c3aed",
			progressColor: "#d946ef",
			height: 100,
			barWidth: 2,
			responsive: true,
		});

		ws.load(actual_path);

		audio.addEventListener("play", () => ws.play());
		audio.addEventListener("pause", () => ws.pause());
		audio.addEventListener("seeked", () =>
			ws.seekTo(audio.currentTime / audio.duration),
		);
		ws.on("interaction", (p) => (audio.currentTime = p * audio.duration));
	} else if (mime_type.startsWith("video/")) {

	/* ================= VIDEO ================= */
		const video = document.createElement("video");
		video.src = actual_path;
		video.controls = true;
		video.style.width = "100%";
		video.style.maxHeight = "75vh";
		modal.body.appendChild(video);
	} else if (extension === "md") {

	/* ================= MARKDOWN ================= */
		fetch(actual_path)
			.then((r) => r.text())
			.then((t) => {
				const article = document.createElement("article");
				article.className = "markdown-body";
				article.innerHTML = marked.parse(t);
				modal.body.appendChild(article);
				if (window.Prism) Prism.highlightAllUnder(article);
			});
	} else if (

	/* ================= TEXT + CODE ================= */
		mime_type.startsWith("text/") ||
		mime_type.includes("json") ||
		mime_type.includes("xml")
	) {
		fetch(actual_path)
			.then((r) => r.text())
			.then((t) => {
				const pre = document.createElement("pre");
				const code = document.createElement("code");
				code.textContent = t;

				if (extension) code.className = `language-${extension}`;
				pre.appendChild(code);
				modal.body.appendChild(pre);

				if (window.Prism) Prism.highlightElement(code);
			});
	} else {

	/* ================= FALLBACK ================= */
		modal.body.innerHTML =
			'<p style="text-align:center;opacity:.6">Preview not supported</p>';
	}

	modal.root.classList.add("active");
};

window.closeModal = function () {
	modal.root.classList.remove("active");
	modal.root.querySelectorAll("audio,video").forEach((m) => m.pause());
	setTimeout(() => (modal.body.innerHTML = ""), 200);
};

/* ==========================================================================
   UI HELPERS
========================================================================== */

window.filterGrid = function () {
	const v = document.getElementById("assetSearch").value.toLowerCase();
	document.querySelectorAll(".interactive-card").forEach((c) => {
		c.style.display = c.dataset.name.includes(v) ? "flex" : "none";
	});
};

window.toggleSidebar = function () {
	document.getElementById("mainSidebar").classList.toggle("open");
};

/* ==========================================================================
   INIT
========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
	modal.root = document.getElementById("modal");
	modal.body = document.getElementById("mBody");
	modal.title = document.getElementById("mTitle");
	modal.meta = document.getElementById("mMeta");
	modal.down = document.getElementById("mDown");

	document.querySelectorAll(".interactive-card").forEach((card) => {
		card.addEventListener("mousemove", (e) => handleInteraction(e, card));
		card.addEventListener("mouseleave", () => handleMouseLeave(card));
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") closeModal();
	});

	if (debug) console.log("[Omnex] Full kernel loaded. Nothing removed.");
});
