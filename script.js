$(function () {
	const $dropzone = $('#dropzone');
	const $fileInput = $('#fileInput');
	const $selectBtn = $('#selectBtn');
	const $processBtn = $('#processBtn');
	const $presetSelect = $('#presetSelect');
	const $preview = $('#preview');
	const $downloadArea = $('#downloadArea');

	let image = null;
	let cropBox = null;
	let cropHandle = null;

	let overlayTop, overlayLeft, overlayRight, overlayBottom;
	let previewScale = 1;
	const isMobile = window.innerWidth < 768; // simple mobile check
	const deviceDPR = window.devicePixelRatio || 1;

	/* --- Detect monitor DPI --- */
	function getScreenDPI() {
		const div = document.createElement('div');
		div.style.width = '1in';
		div.style.height = '1in';
		div.style.position = 'absolute';
		div.style.top = '-100%';
		document.body.appendChild(div);
		const dpi = div.offsetWidth;
		document.body.removeChild(div);
		return dpi;
	}
	const screenDPI = getScreenDPI() * deviceDPR;

	/* --- File selection --- */
	$selectBtn.on('click', () => $fileInput.trigger('click'));
	$fileInput.on('change', function () { handleFile(this.files[0]); });
	$dropzone.on('dragover', e => { e.preventDefault(); $dropzone.addClass('dragover'); });
	$dropzone.on('dragleave', () => $dropzone.removeClass('dragover'));
	$dropzone.on('drop', e => { e.preventDefault(); $dropzone.removeClass('dragover'); handleFile(e.originalEvent.dataTransfer.files[0]); });

	/* --- Clipboard paste --- */
	$(window).on('paste', function(e) {
		const items = e.originalEvent.clipboardData.items;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				handleFile(file);
				if ($presetSelect.val() !== 'Custom') $presetSelect.val('Custom');
				break;
			}
		}
	});

	function handleFile(file) {
		if (!file || !file.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = e => {
			$preview.empty();
			image = new Image();
			image.src = e.target.result;
			image.onload = () => {
				image.style.position = 'absolute';
				$preview.append(image);
				setupCropBox();
				if ($presetSelect.val() !== 'Custom') $presetSelect.val('Custom');
			};
		};
		reader.readAsDataURL(file);
	}

	/* --- Presets --- */
	const presets = {
		'Passport': { widthIn: 2, heightIn: 2 },
		'Visa': { widthIn: 35 / 25.4, heightIn: 45 / 25.4 },
		'Facebook Profile': { widthIn: 320 / 96, heightIn: 320 / 96 },
		'Facebook Cover': { widthIn: 820 / 96, heightIn: 312 / 96 },
		'Instagram Profile': { widthIn: 320 / 96, heightIn: 320 / 96 },
		'Instagram Post Square': { widthIn: 1080 / 96, heightIn: 1080 / 96 },
		'Instagram Post Portrait': { widthIn: 1080 / 96, heightIn: 1350 / 96 },
		'Instagram Story': { widthIn: 1080 / 96, heightIn: 1920 / 96 },
		'X Profile': { widthIn: 400 / 96, heightIn: 400 / 96 },
		'X Header': { widthIn: 1500 / 96, heightIn: 500 / 96 },
		'LinkedIn Profile': { widthIn: 400 / 96, heightIn: 400 / 96 },
		'LinkedIn Cover': { widthIn: 1584 / 96, heightIn: 396 / 96 },
		'TikTok Profile': { widthIn: 200 / 96, heightIn: 200 / 96 },
		'TikTok Story/Reel': { widthIn: 1080 / 96, heightIn: 1920 / 96 },
		'Pinterest Profile': { widthIn: 165 / 96, heightIn: 165 / 96 },
		'Pinterest Pin': { widthIn: 1000 / 96, heightIn: 1500 / 96 },
		'YouTube Profile': { widthIn: 800 / 96, heightIn: 800 / 96 },
		'YouTube Banner': { widthIn: 2560 / 96, heightIn: 1440 / 96 },
		'YouTube Thumbnail': { widthIn: 1280 / 96, heightIn: 720 / 96 }
	};

	$presetSelect.on('change', setPreset);

	/* --- Crop box setup --- */
	function setupCropBox() {
		if (cropBox) cropBox.remove();

		cropBox = document.createElement('div');
		cropBox.id = 'cropBox';
		$preview.append(cropBox);

		cropHandle = document.createElement('div');
		cropHandle.id = 'cropHandle';
		cropBox.appendChild(cropHandle);

		overlayTop = $('<div class="overlay-part"></div>').appendTo($preview);
		overlayLeft = $('<div class="overlay-part"></div>').appendTo($preview);
		overlayRight = $('<div class="overlay-part"></div>').appendTo($preview);
		overlayBottom = $('<div class="overlay-part"></div>').appendTo($preview);

		makeDraggable(cropBox);
		makeResizable(cropBox, cropHandle);

		setPreset();
	}

	/* --- Set preset --- */
	function setPreset() {
		const presetVal = $presetSelect.val();
		const preset = presets[presetVal];

		if (!cropBox || !image) return;

		const imgRatio = image.naturalWidth / image.naturalHeight;
		let displayWidth = $preview.width();
		let displayHeight = displayWidth / imgRatio;
		if (displayHeight > $preview.height()) {
			displayHeight = $preview.height();
			displayWidth = displayHeight * imgRatio;
		}
		image.style.width = displayWidth + 'px';
		image.style.height = displayHeight + 'px';
		image.style.left = ($preview.width() - displayWidth) / 2 + 'px';
		image.style.top = ($preview.height() - displayHeight) / 2 + 'px';

		previewScale = displayWidth / image.naturalWidth;

		if (presetVal === 'Custom') {
			const size = Math.min($preview.width(), $preview.height()) * 0.4;
			cropBox.style.width = size + 'px';
			cropBox.style.height = size + 'px';
			cropBox.style.left = ($preview.width() - size) / 2 + 'px';
			cropBox.style.top = ($preview.height() - size) / 2 + 'px';
		} else {
			let targetWidthPx = preset.widthIn * screenDPI;
			let targetHeightPx = preset.heightIn * screenDPI;

			// Make sure it fits nicely on mobile
			const maxWidth = $preview.width() * 0.8;
			const maxHeight = $preview.height() * 0.8;
			if (targetWidthPx > maxWidth) {
				targetHeightPx *= maxWidth / targetWidthPx;
				targetWidthPx = maxWidth;
			}
			if (targetHeightPx > maxHeight) {
				targetWidthPx *= maxHeight / targetHeightPx;
				targetHeightPx = maxHeight;
			}

			cropBox.style.width = targetWidthPx * previewScale + 'px';
			cropBox.style.height = targetHeightPx * previewScale + 'px';
			cropBox.style.left = ($preview.width() - targetWidthPx * previewScale) / 2 + 'px';
			cropBox.style.top = ($preview.height() - targetHeightPx * previewScale) / 2 + 'px';
		}

		updateOverlay();
	}

	/* --- Draggable crop box (desktop & touch) --- */
	function makeDraggable(element) {
		let offsetX = 0, offsetY = 0, dragging = false;

		function startDrag(clientX, clientY) {
			dragging = true;
			const rect = element.getBoundingClientRect();
			offsetX = clientX - rect.left;
			offsetY = clientY - rect.top;
		}

		function drag(clientX, clientY) {
			if (!dragging) return;
			let x = clientX - $preview[0].getBoundingClientRect().left - offsetX;
			let y = clientY - $preview[0].getBoundingClientRect().top - offsetY;
			x = Math.max(0, Math.min(x, $preview.width() - element.offsetWidth));
			y = Math.max(0, Math.min(y, $preview.height() - element.offsetHeight));
			element.style.left = x + 'px';
			element.style.top = y + 'px';
			updateOverlay();
		}

		element.addEventListener('mousedown', e => { if (e.target !== cropHandle) { startDrag(e.clientX, e.clientY); e.preventDefault(); } });
		element.addEventListener('touchstart', e => { if (e.target !== cropHandle) { const t = e.touches[0]; startDrag(t.clientX, t.clientY); e.preventDefault(); } });
		document.addEventListener('mousemove', e => drag(e.clientX, e.clientY));
		document.addEventListener('touchmove', e => drag(e.touches[0].clientX, e.touches[0].clientY));
		document.addEventListener('mouseup', () => dragging = false);
		document.addEventListener('touchend', () => dragging = false);
	}

	/* --- Resizable crop box (desktop & touch) --- */
	function makeResizable(element, handle) {
		let startX = 0, startY = 0, startW = 0, startH = 0, resizing = false;

		function startResize(clientX, clientY) {
			resizing = true;
			startX = clientX;
			startY = clientY;
			startW = element.offsetWidth;
			startH = element.offsetHeight;
		}

		function resize(clientX, clientY) {
			if (!resizing) return;
			let newW = startW + (clientX - startX);
			let newH = startH + (clientY - startY);
			newW = Math.max(20, Math.min(newW, $preview.width() - element.offsetLeft));
			newH = Math.max(20, Math.min(newH, $preview.height() - element.offsetTop));

			if ($presetSelect.val() !== 'Custom') {
				const preset = presets[$presetSelect.val()];
				const aspect = (preset.heightIn * screenDPI) / (preset.widthIn * screenDPI);
				newH = newW * aspect;
				if (element.offsetTop + newH > $preview.height()) newH = $preview.height() - element.offsetTop;
				newW = newH / aspect;
			}

			element.style.width = newW + 'px';
			element.style.height = newH + 'px';
			updateOverlay();

			if ($presetSelect.val() !== 'Custom') $presetSelect.val('Custom');
		}

		handle.addEventListener('mousedown', e => { startResize(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); });
		handle.addEventListener('touchstart', e => { const t = e.touches[0]; startResize(t.clientX, t.clientY); e.preventDefault(); e.stopPropagation(); });
		document.addEventListener('mousemove', e => resize(e.clientX, e.clientY));
		document.addEventListener('touchmove', e => resize(e.touches[0].clientX, e.touches[0].clientY));
		document.addEventListener('mouseup', () => resizing = false);
		document.addEventListener('touchend', () => resizing = false);
	}

	/* --- Overlay --- */
	function updateOverlay() {
		if (!cropBox) return;
		const rect = cropBox.getBoundingClientRect();
		const previewRect = $preview[0].getBoundingClientRect();

		const left = rect.left - previewRect.left;
		const top = rect.top - previewRect.top;
		const width = rect.width;
		const height = rect.height;

		overlayTop.css({ left: 0, top: 0, width: '100%', height: top });
		overlayLeft.css({ left: 0, top: top, width: left, height: height });
		overlayRight.css({ left: left + width, top: top, width: $preview.width() - (left + width), height: height });
		overlayBottom.css({ left: 0, top: top + height, width: '100%', height: $preview.height() - (top + height) });
	}

	/* --- Cropping --- */
	$processBtn.on('click', () => {
		if (!image || !cropBox) return;

		$processBtn.prop('disabled', true).text('Processing...');
		$downloadArea.empty();

		setTimeout(() => {
			const presetVal = $presetSelect.val();
			const imgRect = image.getBoundingClientRect();
			const previewRect = $preview[0].getBoundingClientRect();

			const x = (parseFloat(cropBox.style.left) - (imgRect.left - previewRect.left)) / previewScale;
			const y = (parseFloat(cropBox.style.top) - (imgRect.top - previewRect.top)) / previewScale;
			const w = cropBox.offsetWidth / previewScale;
			const h = cropBox.offsetHeight / previewScale;

			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			if (presetVal === 'Custom') {
				canvas.width = w;
				canvas.height = h;
				ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
			} else {
				const preset = presets[presetVal];
				canvas.width = preset.widthIn * screenDPI;
				canvas.height = preset.heightIn * screenDPI;
				ctx.drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
			}

			const dataURL = canvas.toDataURL('image/jpeg', 0.95);
			$downloadArea.html(`<a href="${dataURL}" download="cropped-image.jpg">Download Cropped Image</a>`);
			$processBtn.prop('disabled', false).text('Download Cropped');
		}, 50);
	});
});
