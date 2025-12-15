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
	let previewScale = 1; // zoom factor for the preview image

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
	const screenDPI = getScreenDPI();

	/* --- File selection --- */
	$selectBtn.on('click', () => $fileInput.trigger('click'));
	$fileInput.on('change', function () { handleFile(this.files[0]); });
	$dropzone.on('dragover', e => { e.preventDefault(); $dropzone.addClass('dragover'); });
	$dropzone.on('dragleave', () => $dropzone.removeClass('dragover'));
	$dropzone.on('drop', e => { e.preventDefault(); $dropzone.removeClass('dragover'); handleFile(e.originalEvent.dataTransfer.files[0]); });

	/* --- Clipboard paste (for screenshots) --- */
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

	/* --- Presets grouped by platform --- */
	const presets = {
		'Passport': { widthIn: 2, heightIn: 2 },
		'Visa': { widthIn: 35 / 25.4, heightIn: 45 / 25.4 },
		'Facebook Profile': { widthIn: 1, heightIn: 1 },
		'Facebook Cover': { widthIn: 820 / 300, heightIn: 312 / 300 }, // web pixels / 300 DPI
		'Instagram Profile': { widthIn: 1, heightIn: 1 },
		'Instagram Post Square': { widthIn: 1, heightIn: 1 },
		'Instagram Post Portrait': { widthIn: 1080 / 300, heightIn: 1350 / 300 },
		'Instagram Story': { widthIn: 1080 / 300, heightIn: 1920 / 300 },
		'X Profile': { widthIn: 1, heightIn: 1 },
		'X Header': { widthIn: 1500 / 300, heightIn: 500 / 300 },
		'LinkedIn Profile': { widthIn: 1, heightIn: 1 },
		'LinkedIn Cover': { widthIn: 1584 / 300, heightIn: 396 / 300 },
		'TikTok Profile': { widthIn: 1, heightIn: 1 },
		'TikTok Story/Reel': { widthIn: 1080 / 300, heightIn: 1920 / 300 },
		'Pinterest Profile': { widthIn: 1, heightIn: 1 },
		'Pinterest Pin': { widthIn: 1000 / 300, heightIn: 1500 / 300 },
		'YouTube Profile': { widthIn: 1, heightIn: 1 },
		'YouTube Banner': { widthIn: 2560 / 300, heightIn: 1440 / 300 },
		'YouTube Thumbnail': { widthIn: 1280 / 300, heightIn: 720 / 300 }
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

	/* --- Set preset & enforce aspect ratio --- */
	function setPreset() {
		const preset = presets[$presetSelect.val()];
		if (!cropBox || !image) return;

		let targetWidthPx = preset.widthIn * screenDPI;
		let targetHeightPx = preset.heightIn * screenDPI;

		// Maintain aspect ratio
		const aspectRatio = targetWidthPx / targetHeightPx;

		// scale image to fit preview
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

		// enforce aspect ratio for crop box
		let cropWidth = targetWidthPx * previewScale;
		let cropHeight = targetHeightPx * previewScale;

		const currentRatio = cropWidth / cropHeight;
		if (currentRatio > aspectRatio) cropWidth = cropHeight * aspectRatio;
		else cropHeight = cropWidth / aspectRatio;

		cropBox.style.width = cropWidth + 'px';
		cropBox.style.height = cropHeight + 'px';
		cropBox.style.left = ($preview.width() - cropWidth) / 2 + 'px';
		cropBox.style.top = ($preview.height() - cropHeight) / 2 + 'px';

		updateOverlay();
	}

	/* --- Draggable crop box --- */
	function makeDraggable(element) {
		let offsetX = 0, offsetY = 0, dragging = false;
		element.addEventListener('mousedown', e => {
			if (e.target === cropHandle) return;
			dragging = true;
			const rect = element.getBoundingClientRect();
			offsetX = e.clientX - rect.left;
			offsetY = e.clientY - rect.top;
			e.preventDefault();
		});
		document.addEventListener('mousemove', e => {
			if (!dragging) return;
			let x = e.clientX - $preview[0].getBoundingClientRect().left - offsetX;
			let y = e.clientY - $preview[0].getBoundingClientRect().top - offsetY;
			x = Math.max(0, Math.min(x, $preview.width() - element.offsetWidth));
			y = Math.max(0, Math.min(y, $preview.height() - element.offsetHeight));
			element.style.left = x + 'px';
			element.style.top = y + 'px';
			updateOverlay();
		});
		document.addEventListener('mouseup', () => dragging = false);
	}

	/* --- Resizable crop box --- */
	function makeResizable(element, handle) {
		let startX = 0, startY = 0, startW = 0, startH = 0, resizing = false;
		handle.addEventListener('mousedown', e => {
			resizing = true;
			startX = e.clientX;
			startY = e.clientY;
			startW = element.offsetWidth;
			startH = element.offsetHeight;
			e.preventDefault();
			e.stopPropagation();
		});
		document.addEventListener('mousemove', e => {
			if (!resizing) return;
			let newW = startW + (e.clientX - startX);
			let newH = startH + (e.clientY - startY);
			// enforce aspect ratio
			const preset = presets[$presetSelect.val()];
			if (preset && $presetSelect.val() !== 'Custom') {
				const aspectRatio = (preset.widthIn * screenDPI) / (preset.heightIn * screenDPI);
				if (newW / newH > aspectRatio) newW = newH * aspectRatio;
				else newH = newW / aspectRatio;
			}

			newW = Math.max(20, Math.min(newW, $preview.width() - element.offsetLeft));
			newH = Math.max(20, Math.min(newH, $preview.height() - element.offsetTop));
			element.style.width = newW + 'px';
			element.style.height = newH + 'px';
			updateOverlay();

			if ($presetSelect.val() !== 'Custom') $presetSelect.val('Custom');
		});
		document.addEventListener('mouseup', () => resizing = false);
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
