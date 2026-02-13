/**
 * Omnex UI Controller - Enhanced Version
 * With ExifReader Fix, Navigation Arrows, Custom Video Player, and Cool Animations
 */

"use strict";

// --- CONFIGURATION ---
const UI_CONFIG = {
	tilt_max: 15,
	tilt_scale: 1.05,
	smoothness: 0.1,
	transition_speed: 0.4,
};

// --- GLOBAL STATE ---
const activeAnimations = new Map();
let waveSurferInstance = null;
let currentAssetList = [];
let currentAssetIndex = 0;

// --- UTILITIES ---
const lerp = (start, end, factor) => start + (end - start) * factor;

/**
 * EXIFREADER INITIALIZATION - Robust Loading
 */
const ExifReaderLoader = {
	isLoaded: false,
	isLoading: false,
	callbacks: [],

	async ensureLoaded() {
		// Already loaded
		if (
			typeof window.ExifReader !== "undefined" &&
			window.ExifReader.load
		) {
			this.isLoaded = true;
			return true;
		}

		// Wait for existing load attempt
		if (this.isLoading) {
			return new Promise((resolve) => {
				this.callbacks.push(resolve);
			});
		}

		this.isLoading = true;

		// Try waiting for script to load (up to 10 seconds)
		for (let i = 0; i < 100; i++) {
			await new Promise((r) => setTimeout(r, 100));
			if (
				typeof window.ExifReader !== "undefined" &&
				window.ExifReader.load
			) {
				this.isLoaded = true;
				this.isLoading = false;
				this.callbacks.forEach((cb) => cb(true));
				this.callbacks = [];
				return true;
			}
		}

		// Try dynamic loading as fallback
		try {
			await this.loadScript();
			this.isLoaded = true;
			this.isLoading = false;
			this.callbacks.forEach((cb) => cb(true));
			this.callbacks = [];
			return true;
		} catch (e) {
			console.error("Failed to load ExifReader:", e);
			this.isLoading = false;
			this.callbacks.forEach((cb) => cb(false));
			this.callbacks = [];
			return false;
		}
	},

	loadScript() {
		return new Promise((resolve, reject) => {
			if (document.querySelector('script[src*="exif-reader"]')) {
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src =
				"https://unpkg.com/exifreader@4.12.0/dist/exif-reader.min.js";
			script.onload = () => {
				// Give it a moment to initialize
				setTimeout(resolve, 100);
			};
			script.onerror = reject;
			document.head.appendChild(script);
		});
	},
};

/**
 * KINETIC CARD ENGINE
 */
function updateKineticCards() {
	activeAnimations.forEach((state, card) => {
		state.currentX = lerp(
			state.currentX,
			state.targetX,
			UI_CONFIG.smoothness,
		);
		state.currentY = lerp(
			state.currentY,
			state.targetY,
			UI_CONFIG.smoothness,
		);

		const transform = `perspective(1000px) rotateX(${state.currentX}deg) rotateY(${state.currentY}deg) scale3d(${UI_CONFIG.tilt_scale}, ${UI_CONFIG.tilt_scale}, ${UI_CONFIG.tilt_scale})`;
		card.style.transform = transform;

		const icon = card.querySelector(".magnetic-element");
		if (icon) {
			icon.style.transform = `translateX(${state.currentY * 2}px) translateY(${state.currentX * 2}px)`;
		}

		const glowIntensity =
			Math.abs(state.currentX) + Math.abs(state.currentY);
		card.style.boxShadow = `0 20px 40px rgba(0,0,0,0.5), 0 0 ${glowIntensity * 2}px var(--accent_glow)`;

		if (
			!state.active &&
			Math.abs(state.currentX) < 0.01 &&
			Math.abs(state.currentY) < 0.01
		) {
			card.style.transform = "";
			card.style.boxShadow = "";
			if (icon) icon.style.transform = "";
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
		activeAnimations.set(card, {
			active: true,
			currentX: 0,
			currentY: 0,
			targetX: rotateX,
			targetY: rotateY,
		});
		requestAnimationFrame(updateKineticCards);
	} else {
		const state = activeAnimations.get(card);
		state.active = true;
		state.targetX = rotateX;
		state.targetY = rotateY;
	}
}

function handleCardLeave(card) {
	if (activeAnimations.has(card)) {
		const state = activeAnimations.get(card);
		state.active = false;
		state.targetX = 0;
		state.targetY = 0;
	}
}

/**
 * VIEWER SYSTEM
 */
window.openViewer = async function (element) {
	try {
		const b64 = element.getAttribute("data-b64");
		const item = JSON.parse(atob(b64));

		buildAssetList();
		currentAssetIndex = currentAssetList.findIndex(
			(a) => a.actual_path === item.actual_path,
		);

		const modal = document.getElementById("modal");
		const mBody = document.getElementById("mBody");

		document.getElementById("mTitle").textContent = item.filename;
		document.getElementById("mMeta").textContent =
			`${item.mime_type} • ${item.size_formatted}`;

		const mDown = document.getElementById("mDown");
		mDown.href = item.actual_path;
		mDown.setAttribute("download", item.filename);

		renderAssetViewer(item);
		modal.classList.add("active");
	} catch (e) {
		console.error("Viewer Error:", e);
		showToast("Error opening file", "error");
	}
};

function buildAssetList() {
	currentAssetList = [];
	const cards = document.querySelectorAll(".interactive-card");

	cards.forEach((card) => {
		try {
			const b64 = card.getAttribute("data-b64");
			if (b64) {
				const item = JSON.parse(atob(b64));
				if (item.type !== "dir") {
					currentAssetList.push(item);
				}
			}
		} catch (e) {}
	});
}

/**
 * CUSTOM VIDEO PLAYER CLASS
 */
class CustomVideoPlayer {
	constructor(container, src, mime) {
		this.container = container;
		this.src = src;
		this.mime = mime;
		this.video = null;
		this.isPlaying = false;
		this.isMuted = false;
		this.isFullscreen = false;
		this.showControls = true;
		this.controlsTimeout = null;

		this.init();
	}

	init() {
		this.container.innerHTML = `
            <div class="video-wrapper">
                <video class="custom-video" preload="metadata">
                    <source src="${this.src}" type="${this.mime}">
                </video>

                <div class="video-overlay">
                    <div class="video-big-play">
                        <i class="fa-solid fa-play"></i>
                    </div>
                    <div class="video-loading">
                        <div class="spinner"></div>
                    </div>
                </div>

                <div class="video-controls">
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-filled"></div>
                            <div class="progress-buffered"></div>
                            <div class="progress-handle"></div>
                        </div>
                        <div class="progress-tooltip">0:00</div>
                    </div>

                    <div class="controls-row">
                        <div class="controls-left">
                            <button class="ctrl-btn play-btn" title="Play (Space)">
                                <i class="fa-solid fa-play"></i>
                            </button>
                            <button class="ctrl-btn rewind-btn" title="Rewind 10s">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                            <button class="ctrl-btn forward-btn" title="Forward 10s">
                                <i class="fa-solid fa-rotate-right"></i>
                            </button>
                            <div class="volume-control">
                                <button class="ctrl-btn volume-btn" title="Mute (M)">
                                    <i class="fa-solid fa-volume-high"></i>
                                </button>
                                <div class="volume-slider-container">
                                    <input type="range" class="volume-slider" min="0" max="1" step="0.05" value="1">
                                </div>
                            </div>
                            <span class="time-display">
                                <span class="current-time">0:00</span>
                                <span class="time-sep">/</span>
                                <span class="duration">0:00</span>
                            </span>
                        </div>

                        <div class="controls-right">
                            <button class="ctrl-btn speed-btn" title="Playback Speed">
                                <span>1x</span>
                            </button>
                            <div class="speed-menu">
                                <button data-speed="0.25">0.25x</button>
                                <button data-speed="0.5">0.5x</button>
                                <button data-speed="0.75">0.75x</button>
                                <button data-speed="1" class="active">1x</button>
                                <button data-speed="1.25">1.25x</button>
                                <button data-speed="1.5">1.5x</button>
                                <button data-speed="2">2x</button>
                            </div>
                            <button class="ctrl-btn pip-btn" title="Picture in Picture">
                                <i class="fa-solid fa-table-cells-large"></i>
                            </button>
                            <button class="ctrl-btn fullscreen-btn" title="Fullscreen (F)">
                                <i class="fa-solid fa-expand"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

		this.video = this.container.querySelector(".custom-video");
		this.bindEvents();
	}

	bindEvents() {
		const wrapper = this.container.querySelector(".video-wrapper");
		const bigPlay = this.container.querySelector(".video-big-play");
		const loading = this.container.querySelector(".video-loading");
		const controls = this.container.querySelector(".video-controls");
		const playBtn = this.container.querySelector(".play-btn");
		const rewindBtn = this.container.querySelector(".rewind-btn");
		const forwardBtn = this.container.querySelector(".forward-btn");
		const volumeBtn = this.container.querySelector(".volume-btn");
		const volumeSlider = this.container.querySelector(".volume-slider");
		const progressContainer = this.container.querySelector(
			".progress-container",
		);
		const progressFilled = this.container.querySelector(".progress-filled");
		const progressBuffered =
			this.container.querySelector(".progress-buffered");
		const progressHandle = this.container.querySelector(".progress-handle");
		const progressTooltip =
			this.container.querySelector(".progress-tooltip");
		const currentTimeEl = this.container.querySelector(".current-time");
		const durationEl = this.container.querySelector(".duration");
		const speedBtn = this.container.querySelector(".speed-btn");
		const speedMenu = this.container.querySelector(".speed-menu");
		const pipBtn = this.container.querySelector(".pip-btn");
		const fullscreenBtn = this.container.querySelector(".fullscreen-btn");

		// Play/Pause
		const togglePlay = () => {
			if (this.video.paused) {
				this.video.play();
			} else {
				this.video.pause();
			}
		};

		this.video.addEventListener("click", togglePlay);
		bigPlay.addEventListener("click", togglePlay);
		playBtn.addEventListener("click", togglePlay);

		this.video.addEventListener("play", () => {
			this.isPlaying = true;
			bigPlay.classList.add("hidden");
			playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
		});

		this.video.addEventListener("pause", () => {
			this.isPlaying = false;
			bigPlay.classList.remove("hidden");
			playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
		});

		// Loading
		this.video.addEventListener("waiting", () =>
			loading.classList.add("visible"),
		);
		this.video.addEventListener("canplay", () =>
			loading.classList.remove("visible"),
		);

		// Time updates
		this.video.addEventListener("timeupdate", () => {
			const progress =
				(this.video.currentTime / this.video.duration) * 100;
			progressFilled.style.width = `${progress}%`;
			progressHandle.style.left = `${progress}%`;
			currentTimeEl.textContent = this.formatTime(this.video.currentTime);
		});

		this.video.addEventListener("loadedmetadata", () => {
			durationEl.textContent = this.formatTime(this.video.duration);
		});

		// Buffering
		this.video.addEventListener("progress", () => {
			if (this.video.buffered.length > 0) {
				const buffered =
					(this.video.buffered.end(this.video.buffered.length - 1) /
						this.video.duration) *
					100;
				progressBuffered.style.width = `${buffered}%`;
			}
		});

		// Progress bar interaction
		progressContainer.addEventListener("click", (e) => {
			const rect = progressContainer.getBoundingClientRect();
			const pos = (e.clientX - rect.left) / rect.width;
			this.video.currentTime = pos * this.video.duration;
		});

		progressContainer.addEventListener("mousemove", (e) => {
			const rect = progressContainer.getBoundingClientRect();
			const pos = (e.clientX - rect.left) / rect.width;
			progressTooltip.textContent = this.formatTime(
				pos * this.video.duration,
			);
			progressTooltip.style.left = `${pos * 100}%`;
			progressTooltip.style.opacity = "1";
		});

		progressContainer.addEventListener("mouseleave", () => {
			progressTooltip.style.opacity = "0";
		});

		// Volume
		volumeBtn.addEventListener("click", () => {
			this.video.muted = !this.video.muted;
			this.updateVolumeIcon();
		});

		volumeSlider.addEventListener("input", (e) => {
			this.video.volume = e.target.value;
			this.updateVolumeIcon();
		});

		// Rewind/Forward
		rewindBtn.addEventListener("click", () => {
			this.video.currentTime = Math.max(0, this.video.currentTime - 10);
		});

		forwardBtn.addEventListener("click", () => {
			this.video.currentTime = Math.min(
				this.video.duration,
				this.video.currentTime + 10,
			);
		});

		// Speed
		speedBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			speedMenu.classList.toggle("visible");
		});

		speedMenu.querySelectorAll("button").forEach((btn) => {
			btn.addEventListener("click", () => {
				const speed = parseFloat(btn.dataset.speed);
				this.video.playbackRate = speed;
				speedBtn.querySelector("span").textContent = `${speed}x`;
				speedMenu
					.querySelectorAll("button")
					.forEach((b) => b.classList.remove("active"));
				btn.classList.add("active");
				speedMenu.classList.remove("visible");
			});
		});

		// Picture in Picture
		pipBtn.addEventListener("click", async () => {
			try {
				if (document.pictureInPictureElement) {
					await document.exitPictureInPicture();
				} else {
					await this.video.requestPictureInPicture();
				}
			} catch (e) {
				console.log("PiP not supported");
			}
		});

		// Fullscreen
		fullscreenBtn.addEventListener("click", () => {
			if (document.fullscreenElement) {
				document.exitFullscreen();
			} else {
				wrapper.requestFullscreen();
			}
		});

		document.addEventListener("fullscreenchange", () => {
			const icon = fullscreenBtn.querySelector("i");
			if (document.fullscreenElement) {
				icon.className = "fa-solid fa-compress";
			} else {
				icon.className = "fa-solid fa-expand";
			}
		});

		// Auto-hide controls
		let hideTimeout;
		const showControls = () => {
			controls.classList.add("visible");
			clearTimeout(hideTimeout);
			if (this.isPlaying) {
				hideTimeout = setTimeout(() => {
					controls.classList.remove("visible");
				}, 3000);
			}
		};

		wrapper.addEventListener("mousemove", showControls);
		wrapper.addEventListener("mouseleave", () => {
			if (this.isPlaying) {
				controls.classList.remove("visible");
			}
		});

		// Keyboard shortcuts
		const handleKeydown = (e) => {
			if (
				document.fullscreenElement !== wrapper &&
				!wrapper.contains(document.activeElement)
			)
				return;

			switch (e.key.toLowerCase()) {
				case " ":
					e.preventDefault();
					togglePlay();
					break;
				case "arrowleft":
					this.video.currentTime -= 5;
					break;
				case "arrowright":
					this.video.currentTime += 5;
					break;
				case "arrowup":
					e.preventDefault();
					this.video.volume = Math.min(1, this.video.volume + 0.1);
					volumeSlider.value = this.video.volume;
					break;
				case "arrowdown":
					e.preventDefault();
					this.video.volume = Math.max(0, this.video.volume - 0.1);
					volumeSlider.value = this.video.volume;
					break;
				case "m":
					this.video.muted = !this.video.muted;
					this.updateVolumeIcon();
					break;
				case "f":
					fullscreenBtn.click();
					break;
			}
		};

		document.addEventListener("keydown", handleKeydown);

		// Click outside speed menu
		document.addEventListener("click", () => {
			speedMenu.classList.remove("visible");
		});

		// Initial state
		setTimeout(() => showControls(), 100);
	}

	updateVolumeIcon() {
		const volumeBtn = this.container.querySelector(".volume-btn");
		const icon = volumeBtn.querySelector("i");

		if (this.video.muted || this.video.volume === 0) {
			icon.className = "fa-solid fa-volume-xmark";
		} else if (this.video.volume < 0.5) {
			icon.className = "fa-solid fa-volume-low";
		} else {
			icon.className = "fa-solid fa-volume-high";
		}
	}

	formatTime(seconds) {
		if (isNaN(seconds)) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}

	destroy() {
		if (this.video) {
			this.video.pause();
			this.video.src = "";
		}
	}
}

/**
 * RENDER ASSET VIEWER
 */
function renderAssetViewer(item) {
	const mBody = document.getElementById("mBody");

	if (waveSurferInstance) {
		waveSurferInstance.destroy();
		waveSurferInstance = null;
	}

	const ext = item.extension;
	const path = item.actual_path;
	let mediaHTML = "";

	const isImage = [
		"jpg",
		"jpeg",
		"png",
		"gif",
		"webp",
		"tiff",
		"heic",
		"avif",
		"svg",
	].includes(ext);
	const isVideo = [
		"mp4",
		"webm",
		"mov",
		"mkv",
		"m4v",
		"avi",
		"flv",
		"wmv",
		"mts",
		"ts",
		"ogv",
		"vp9",
	].includes(ext);
	const isAudio = [
		"mp3",
		"wav",
		"ogg",
		"flac",
		"aac",
		"m4a",
		"opus",
		"weba",
	].includes(ext);
	const is3D = ["glb", "gltf", "obj", "fbx"].includes(ext);

	const needsNav = isImage || is3D || isVideo || isAudio;

	if (is3D) {
		mediaHTML = `<model-viewer src="${path}" camera-controls auto-rotate shadow-intensity="1" ar style="width: 100%; height: 100%;" background-color="#121212"></model-viewer>`;
	} else if (isVideo) {
		mediaHTML = `<div class="custom-video-player" id="videoPlayer"></div>`;
		setTimeout(
			() =>
				new CustomVideoPlayer(
					document.getElementById("videoPlayer"),
					path,
					item.mime_type,
				),
			50,
		);
	} else if (isAudio) {
		mediaHTML = `<div style="width: 100%; max-width: 600px; padding: 20px;"><div id="waveform" style="width: 100%;"></div><div style="text-align: center; margin-top: 20px;"><button class="btn" onclick="toggleAudio()"><i id="playPauseIcon" class="fa-solid fa-play"></i> Play / Pause</button></div></div>`;
		setTimeout(() => initAudio(path), 50);
	} else if (isImage) {
		mediaHTML = `<img src="${path}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;" class="fade-in-image">`;
	} else if (
		[
			"json",
			"xml",
			"js",
			"css",
			"html",
			"php",
			"txt",
			"md",
			"yml",
		].includes(ext)
	) {
		mediaHTML = `<div class="text-viewer-container"><pre><code id="codeBlock" class="language-${ext}">Loading...</code></pre></div>`;
		loadTextContent(path);
	} else if (["pdf"].includes(ext)) {
		mediaHTML = `<iframe src="${path}" style="width: 100%; height: 100%; border: none; border-radius: 12px;"></iframe>`;
	} else {
		mediaHTML = `<div style="text-align: center; color: #666;"><i class="fa-solid fa-file-circle-question" style="font-size: 4rem; margin-bottom: 1rem;"></i><p>Preview not available</p></div>`;
	}

	// TAB SYSTEM for images with navigation
	if (isImage) {
		mBody.innerHTML = `
            <div class="viewer-container">
                ${
					needsNav ?
						`
                <button class="nav-arrow nav-prev ${currentAssetIndex <= 0 ? "disabled" : ""}" onclick="navigateAsset(-1)" title="Previous (Left Arrow)">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                `
					:	""
				}
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
                                Loading EXIF Reader...
                            </div>
                        </div>
                    </div>
                </div>
                ${
					needsNav ?
						`
                <button class="nav-arrow nav-next ${currentAssetIndex >= currentAssetList.length - 1 ? "disabled" : ""}" onclick="navigateAsset(1)" title="Next (Right Arrow)">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
                `
					:	""
				}
            </div>`;
		loadExifData(path);
	} else if (needsNav) {
		mBody.innerHTML = `
            <div class="viewer-container">
                <button class="nav-arrow nav-prev ${currentAssetIndex <= 0 ? "disabled" : ""}" onclick="navigateAsset(-1)" title="Previous (Left Arrow)">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="viewer-main">${mediaHTML}</div>
                <button class="nav-arrow nav-next ${currentAssetIndex >= currentAssetList.length - 1 ? "disabled" : ""}" onclick="navigateAsset(1)" title="Next (Right Arrow)">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>`;
	} else {
		mBody.innerHTML = mediaHTML;
	}
}

/**
 * NAVIGATE ASSETS
 */
window.navigateAsset = function (direction) {
	const newIndex = currentAssetIndex + direction;

	if (newIndex < 0 || newIndex >= currentAssetList.length) return;

	currentAssetIndex = newIndex;
	const item = currentAssetList[currentAssetIndex];

	document.getElementById("mTitle").textContent = item.filename;
	document.getElementById("mMeta").textContent =
		`${item.mime_type} • ${item.size_formatted}`;

	const mDown = document.getElementById("mDown");
	mDown.href = item.actual_path;
	mDown.setAttribute("download", item.filename);

	const mBody = document.getElementById("mBody");
	mBody.classList.add("navigating");

	setTimeout(() => {
		renderAssetViewer(item);
		mBody.classList.remove("navigating");
	}, 150);
};

window.closeModal = function () {
	const modal = document.getElementById("modal");
	modal.classList.remove("active");
	if (waveSurferInstance) {
		waveSurferInstance.destroy();
		waveSurferInstance = null;
	}
	currentAssetList = [];
	currentAssetIndex = 0;
	setTimeout(() => {
		document.getElementById("mBody").innerHTML = "";
	}, 300);
};

// --- TABS & EXIF LOGIC ---
window.switchTab = function (tabName, event) {
	if (event) {
		document
			.querySelectorAll(".modal-tab-btn")
			.forEach((btn) => btn.classList.remove("active"));
		event.currentTarget.classList.add("active");
	}
	document
		.querySelectorAll(".tab-content")
		.forEach((c) => c.classList.remove("active"));
	document.getElementById(`tab-${tabName}`).classList.add("active");
};

/**
 * EXIF DATA LOADER - Fixed with robust loading
 */
async function loadExifData(url) {
	const container = document.querySelector("#tab-meta .exif-container");

	try {
		// Update loading message
		container.innerHTML = `
            <div style="text-align:center; padding: 2rem; color: var(--text_dim);">
                <div class="exif-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>
                Loading EXIF Reader...
            </div>`;

		// Ensure ExifReader is loaded
		const loaded = await ExifReaderLoader.ensureLoaded();

		if (!loaded || typeof window.ExifReader === "undefined") {
			throw new Error(
				"Could not load ExifReader library. Check your internet connection.",
			);
		}

		// Update message
		container.innerHTML = `
            <div style="text-align:center; padding: 2rem; color: var(--text_dim);">
                <div class="exif-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>
                Reading Metadata...
            </div>`;

		// Fetch image as ArrayBuffer
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(`Failed to fetch image (${response.status})`);

		const arrayBuffer = await response.arrayBuffer();

		// Parse EXIF data
		const tags = window.ExifReader.load(arrayBuffer);

		const ignoredTags = [
			"MakerNote",
			"UserComment",
			"Thumbnail",
			"PrintIM",
			"Padding",
		];
		let tableHtml = '<table class="exif-table"><tbody>';
		let count = 0;

		const categories = {
			"Image Info": [],
			"Camera Settings": [],
			"GPS Data": [],
			Other: [],
		};

		for (let key in tags) {
			if (ignoredTags.some((ignored) => key.includes(ignored))) continue;

			let val = tags[key].description || tags[key].value;
			if (Array.isArray(val) && val.length > 10) {
				val = `[${val.length} values]`;
			} else if (typeof val === "object") {
				val = JSON.stringify(val);
			}
			if (typeof val === "string" && val.length > 80) {
				val = val.substring(0, 80) + "...";
			}

			let category = "Other";
			if (
				[
					"ImageWidth",
					"ImageHeight",
					"Orientation",
					"Resolution",
					"Software",
					"DateTime",
					"Make",
					"Model",
				].some((k) => key.includes(k))
			) {
				category = "Image Info";
			} else if (
				[
					"Exposure",
					"FNumber",
					"ISO",
					"FocalLength",
					"Aperture",
					"WhiteBalance",
					"Flash",
				].some((k) => key.includes(k))
			) {
				category = "Camera Settings";
			} else if (key.includes("GPS")) {
				category = "GPS Data";
			}

			categories[category].push({ key, val });
			count++;
		}

		for (let cat in categories) {
			if (categories[cat].length > 0) {
				tableHtml += `<tr class="exif-category"><td colspan="2"><i class="fa-solid ${
					cat === "Image Info" ? "fa-image"
					: cat === "Camera Settings" ? "fa-camera"
					: cat === "GPS Data" ? "fa-location-dot"
					: "fa-circle-info"
				}"></i> ${cat}</td></tr>`;
				categories[cat].forEach(({ key, val }) => {
					tableHtml += `<tr><td class="exif-key">${key}</td><td class="exif-val">${val}</td></tr>`;
				});
			}
		}
		tableHtml += "</tbody></table>";

		container.innerHTML =
			count === 0 ?
				'<div class="exif-empty"><i class="fa-solid fa-circle-info"></i><p>No EXIF metadata found in this image.</p></div>'
			:	tableHtml;
	} catch (error) {
		console.warn("Exif Error:", error);
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

window.retryExif = function (url) {
	loadExifData(url);
};

// --- HELPER LOADERS ---
function loadTextContent(path) {
	fetch(path)
		.then((r) => r.text())
		.then((text) => {
			const codeBlock = document.getElementById("codeBlock");
			if (codeBlock) {
				codeBlock.textContent = text;
				if (window.Prism) Prism.highlightElement(codeBlock);
			}
		})
		.catch((err) => {
			const codeBlock = document.getElementById("codeBlock");
			if (codeBlock) codeBlock.textContent = "Error loading file content";
		});
}

function initAudio(path) {
	const rootStyles = getComputedStyle(document.documentElement);
	const accent = rootStyles.getPropertyValue("--accent").trim() || "#d946ef";

	waveSurferInstance = WaveSurfer.create({
		container: "#waveform",
		waveColor: "#4b5563",
		progressColor: accent,
		cursorColor: "#ffffff",
		barWidth: 2,
		barRadius: 3,
		height: 120,
		barGap: 2,
	});
	waveSurferInstance.load(path);
	waveSurferInstance.on("ready", () => waveSurferInstance.play());
	waveSurferInstance.on("play", () => {
		const icon = document.getElementById("playPauseIcon");
		if (icon) icon.className = "fa-solid fa-pause";
	});
	waveSurferInstance.on("pause", () => {
		const icon = document.getElementById("playPauseIcon");
		if (icon) icon.className = "fa-solid fa-play";
	});
}

window.toggleAudio = function () {
	if (waveSurferInstance) waveSurferInstance.playPause();
};

window.filterGrid = function () {
	const input = document.getElementById("assetSearch");
	const filter = input.value.toLowerCase();
	const cards = document.querySelectorAll(".interactive-card");
	let visibleCount = 0;

	cards.forEach((card) => {
		const name = card.getAttribute("data-name");
		const matches = name.includes(filter);
		card.style.display = matches ? "flex" : "none";
		if (matches) visibleCount++;
	});

	let noResults = document.querySelector(".no-results");
	if (visibleCount === 0 && filter !== "") {
		if (!noResults) {
			noResults = document.createElement("div");
			noResults.className = "no-results";
			noResults.innerHTML =
				'<i class="fa-solid fa-magnifying-glass"></i><p>No assets found matching your search</p>';
			document.getElementById("assetGrid").appendChild(noResults);
		}
	} else if (noResults) {
		noResults.remove();
	}
};

window.toggleSidebar = function () {
	document.getElementById("mainSidebar").classList.toggle("open");
};

function showToast(message, type = "info") {
	const toast = document.getElementById("toast");
	toast.textContent = message;
	toast.className = `toast visible ${type}`;
	setTimeout(() => toast.classList.remove("visible"), 3000);
}

// --- KEYBOARD NAVIGATION ---
function handleKeyboard(e) {
	const modal = document.getElementById("modal");
	if (!modal.classList.contains("active")) return;

	switch (e.key) {
		case "Escape":
			closeModal();
			break;
		case "ArrowLeft":
			if (!e.target.closest(".custom-video-player")) {
				navigateAsset(-1);
				e.preventDefault();
			}
			break;
		case "ArrowRight":
			if (!e.target.closest(".custom-video-player")) {
				navigateAsset(1);
				e.preventDefault();
			}
			break;
	}
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
	// Preload ExifReader
	ExifReaderLoader.ensureLoaded();

	// Card interactions
	const cards = document.querySelectorAll(".interactive-card");
	cards.forEach((card) => {
		card.addEventListener("mousemove", (e) => handleCardMove(e, card));
		card.addEventListener("mouseleave", () => handleCardLeave(card));

		card.addEventListener("click", function (e) {
			const ripple = document.createElement("div");
			ripple.className = "ripple";
			const rect = this.getBoundingClientRect();
			ripple.style.left = e.clientX - rect.left + "px";
			ripple.style.top = e.clientY - rect.top + "px";
			this.appendChild(ripple);
			setTimeout(() => ripple.remove(), 600);
		});
	});

	// Modal interactions
	const modal = document.getElementById("modal");
	modal.addEventListener("click", (e) => {
		if (
			e.target === modal ||
			e.target.classList.contains("viewer-container")
		)
			closeModal();
	});

	// Keyboard shortcuts
	document.addEventListener("keydown", handleKeyboard);
});

// Touch swipe support
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener(
	"touchstart",
	(e) => {
		touchStartX = e.changedTouches[0].screenX;
	},
	false,
);

document.addEventListener(
	"touchend",
	(e) => {
		touchEndX = e.changedTouches[0].screenX;
		handleSwipe();
	},
	false,
);

function handleSwipe() {
	const modal = document.getElementById("modal");
	if (!modal.classList.contains("active")) return;

	const swipeThreshold = 50;
	const diff = touchStartX - touchEndX;

	if (Math.abs(diff) > swipeThreshold) {
		if (diff > 0) {
			navigateAsset(1);
		} else {
			navigateAsset(-1);
		}
	}
}
