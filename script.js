// State Management
let currentFile = null;
let convertedFileUrl = null;
let convertedFileName = "";
const markdownConverter = new showdown.Converter();

// Mapping supported formats for Smart Drop section
const FORMAT_MAP = {
    // Images
    png: ['jpeg', 'webp', 'bmp'],
    jpg: ['png', 'webp', 'bmp'],
    jpeg: ['png', 'webp', 'bmp'],
    webp: ['png', 'jpeg', 'bmp'],
    bmp: ['png', 'jpeg', 'webp'],

    // Documents & Text
    pdf: ['txt', 'html', 'png'],
    docx: ['txt', 'html', 'pdf'],
    txt: ['html', 'pdf', 'md'],
    html: ['txt', 'md', 'pdf'],

    // Data Formats
    json: ['csv', 'yaml', 'xml', 'txt'],
    csv: ['json', 'xml', 'txt'],
    xml: ['json', 'csv', 'txt'],
    yaml: ['json', 'txt'],
    yml: ['json', 'txt'],

    // Markdown
    md: ['html', 'txt'],
    markdown: ['html', 'txt']
};
// Target choices mapping for Paste Section
const PASTE_TARGET_OPTIONS = {
    json: ['csv', 'yaml', 'xml'],
    csv: ['json', 'xml'],
    xml: ['json', 'csv'],
    markdown: ['html'],
    plain: ['uppercase', 'lowercase', 'base64']
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updatePasteTargetOptions();
});

function setupEventListeners() {
    // Dropzone Click & Drag Event Handlers
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    dropzone.addEventListener('click', (e) => {
        if (!e.target.closest('#dropzone-active')) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dropzone-dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dropzone-dragover'), false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files.length > 0) handleFileSelect(dt.files[0]);
    });

    // Remove File & Quality Range Sync
    document.getElementById('btn-remove-file').addEventListener('click', resetSmartDrop);
    
    document.getElementById('imgQuality').addEventListener('input', (e) => {
        document.getElementById('qualityVal').textContent = `${e.target.value}%`;
    });

    // Smart Drop Conversion Trigger
    document.getElementById('btn-convert').addEventListener('click', processSmartDropConversion);

    // Download & Reset Buttons
    document.getElementById('btn-download').addEventListener('click', () => {
        if (!convertedFileUrl) return;
        const a = document.createElement('a');
        a.href = convertedFileUrl;
        a.download = convertedFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    document.getElementById('btn-reset').addEventListener('click', resetSmartDrop);

    // Text Paste Section Handlers
    document.getElementById('paste-source-type').addEventListener('change', updatePasteTargetOptions);
    document.getElementById('btn-paste-clipboard').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('paste-input').value = text;
        } catch (err) {
            alert('Failed to read clipboard contents.');
        }
    });

    document.getElementById('btn-copy-output').addEventListener('click', () => {
        const output = document.getElementById('paste-output').value;
        if (output) {
            navigator.clipboard.writeText(output);
            alert('Copied to clipboard!');
        }
    });

    document.getElementById('btn-clear-paste').addEventListener('click', () => {
        document.getElementById('paste-input').value = '';
        document.getElementById('paste-output').value = '';
    });

    document.getElementById('btn-convert-paste').addEventListener('click', processPasteConversion);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Tab Switching
window.switchTab = function(tab) {
    const autoSection = document.getElementById('section-auto');
    const textSection = document.getElementById('section-text');
    const btnAuto = document.getElementById('tab-auto');
    const btnText = document.getElementById('tab-text');

    if (tab === 'auto') {
        autoSection.classList.remove('hidden');
        textSection.classList.add('hidden');
        
        btnAuto.className = "tab-btn flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 bg-indigo-600 text-white shadow-md shadow-indigo-500/10";
        btnText.className = "tab-btn flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all duration-200";
        
        setTimeout(() => {
            autoSection.classList.remove('scale-95', 'opacity-0');
            autoSection.classList.add('scale-100', 'opacity-100');
        }, 10);
    } else {
        textSection.classList.remove('hidden');
        autoSection.classList.add('hidden');
        
        btnText.className = "tab-btn flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 bg-indigo-600 text-white shadow-md shadow-indigo-500/10";
        btnAuto.className = "tab-btn flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all duration-200";
        
        setTimeout(() => {
            textSection.classList.remove('scale-95', 'opacity-0');
            textSection.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
};

// Smart Drop File Processing
function handleFileSelect(file) {
    currentFile = file;
    const ext = file.name.split('.').pop().toLowerCase();

    document.getElementById('dropzone-empty').classList.add('hidden');
    document.getElementById('dropzone-active').classList.remove('hidden');

    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = formatBytes(file.size);
    document.getElementById('file-type-badge').textContent = ext;

    const select = document.getElementById('targetFormat');
    select.innerHTML = '';

    const imageSettings = document.getElementById('image-settings');
    
    // Check if file is an image by MIME type or extension
    const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext);

    if (isImage) {
        imageSettings.classList.remove('hidden');
        
        // Populate image targets from FORMAT_MAP or fallback defaults
        const targets = FORMAT_MAP[ext] || ['png', 'jpeg', 'webp', 'bmp'].filter(f => f !== ext);
        targets.forEach(fmt => {
            select.innerHTML += `<option value="${fmt}">${fmt.toUpperCase()}</option>`;
        });

        // Get original dimensions
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            document.getElementById('imgWidth').placeholder = img.width;
            document.getElementById('imgHeight').placeholder = img.height;
        };
    } else {
        imageSettings.classList.add('hidden');

        // Look up options by exact extension, fallback to txt
        const allowed = FORMAT_MAP[ext] || ['txt'];
        allowed.forEach(fmt => {
            select.innerHTML += `<option value="${fmt}">${fmt.toUpperCase()}</option>`;
        });
    }
}

function resetSmartDrop() {
    currentFile = null;
    convertedFileUrl = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('dropzone-empty').classList.remove('hidden');
    document.getElementById('dropzone-active').classList.add('hidden');
    document.getElementById('conversion-result').classList.add('hidden');
    document.getElementById('convert-progress').classList.add('hidden');
}

// Convert Smart Drop Action
async function processSmartDropConversion() {
    if (!currentFile) return;

    const targetFormat = document.getElementById('targetFormat').value;
    const progress = document.getElementById('convert-progress');
    const progressBar = document.getElementById('progress-bar');
    
    progress.classList.remove('hidden');
    progressBar.style.width = '30%';

    try {
        if (currentFile.type.startsWith('image/')) {
            await convertImage(currentFile, targetFormat);
        } else {
            await convertDataFile(currentFile, targetFormat);
        }

        progressBar.style.width = '100%';
        setTimeout(() => {
            progress.classList.add('hidden');
            progressBar.style.width = '0%';
            
            document.getElementById('success-message').textContent = 
                `Your file "${currentFile.name}" was converted to ${targetFormat.toUpperCase()} successfully.`;
            document.getElementById('conversion-result').classList.remove('hidden');
        }, 300);

    } catch (err) {
        progress.classList.add('hidden');
        alert(`Conversion Error: ${err.message}`);
    }
}

// Image Conversion Engine
function convertImage(file, format) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            let width = parseInt(document.getElementById('imgWidth').value) || img.width;
            let height = parseInt(document.getElementById('imgHeight').value) || img.height;
            const maintainAspect = document.getElementById('maintainAspect').checked;

            if (maintainAspect && document.getElementById('imgWidth').value && !document.getElementById('imgHeight').value) {
                height = Math.round((width / img.width) * img.height);
            } else if (maintainAspect && document.getElementById('imgHeight').value && !document.getElementById('imgWidth').value) {
                width = Math.round((height / img.height) * img.width);
            }

            canvas.width = width;
            canvas.height = height;

            // Handle background fill for transparent images going to JPEG
            if (format === 'jpeg' || format === 'jpg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0, width, height);

            const quality = parseInt(document.getElementById('imgQuality').value) / 100;
            const mimeType = format === 'bmp' ? 'image/bmp' : `image/${format}`;

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Canvas export failed.'));
                    return;
                }
                convertedFileUrl = URL.createObjectURL(blob);
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
                convertedFileName = `${nameWithoutExt}.${format}`;
                resolve();
            }, mimeType, quality);
        };

        img.onerror = () => reject(new Error('Failed to load image file.'));
    });
}

// Text/Data File Conversion Engine
function convertDataFile(file, targetFormat) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const textContent = e.target.result;
                const ext = file.name.split('.').pop().toLowerCase();
                const result = runTextConversion(textContent, ext, targetFormat);

                const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
                convertedFileUrl = URL.createObjectURL(blob);
                
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
                convertedFileName = `${nameWithoutExt}.${targetFormat}`;
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed reading text file.'));
        reader.readAsText(file);
    });
}

// Text / Data Converter Helper Matrix
function runTextConversion(input, sourceFormat, targetFormat) {
    if (!input.trim()) return '';

    if (sourceFormat === 'json') {
        const parsed = JSON.parse(input);
        if (targetFormat === 'csv') {
            return Papa.unparse(Array.isArray(parsed) ? parsed : [parsed]);
        }
        if (targetFormat === 'yaml') {
            return jsyaml.dump(parsed);
        }
        if (targetFormat === 'xml') {
            return jsonToXml(parsed);
        }
    }

    if (sourceFormat === 'csv') {
        const parsed = Papa.parse(input, { header: true }).data;
        if (targetFormat === 'json') {
            return JSON.stringify(parsed, null, 2);
        }
        if (targetFormat === 'xml') {
            return jsonToXml({ row: parsed });
        }
    }

    if (sourceFormat === 'xml') {
        if (targetFormat === 'json') {
            return JSON.stringify(xmlToJson(input), null, 2);
        }
    }

    if (sourceFormat === 'markdown' && targetFormat === 'html') {
        return markdownConverter.makeHtml(input);
    }

    if (sourceFormat === 'plain') {
        if (targetFormat === 'uppercase') return input.toUpperCase();
        if (targetFormat === 'lowercase') return input.toLowerCase();
        if (targetFormat === 'base64') return btoa(input);
    }

    return input;
}

// Custom Text/Data Paste Section Processing
function updatePasteTargetOptions() {
    const sourceType = document.getElementById('paste-source-type').value;
    const targetSelect = document.getElementById('paste-target-type');
    targetSelect.innerHTML = '';

    const targets = PASTE_TARGET_OPTIONS[sourceType] || [];
    targets.forEach(t => {
        targetSelect.innerHTML += `<option value="${t}">${t.toUpperCase()}</option>`;
    });
}

function processPasteConversion() {
    const input = document.getElementById('paste-input').value;
    const sourceType = document.getElementById('paste-source-type').value;
    const targetType = document.getElementById('paste-target-type').value;

    try {
        const result = runTextConversion(input, sourceType, targetType);
        document.getElementById('paste-output').value = result;
    } catch (err) {
        alert(`Conversion Failed: ${err.message}`);
    }
}

// Data conversion utility functions
function jsonToXml(obj) {
    let xml = '';
    for (let prop in obj) {
        xml += obj[prop] instanceof Array ? '' : "<" + prop + ">";
        if (obj[prop] instanceof Array) {
            for (let array in obj[prop]) {
                xml += "<" + prop + ">";
                xml += jsonToXml(new Object(obj[prop][array]));
                xml += "</" + prop + ">";
            }
        } else if (typeof obj[prop] == "object") {
            xml += jsonToXml(new Object(obj[prop]));
        } else {
            xml += obj[prop];
        }
        xml += obj[prop] instanceof Array ? '' : "</" + prop + ">";
    }
    return xml.replace(/<\/?[0-9]+>/g, '');
}

function xmlToJson(xmlStr) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, "text/xml");
    
    function parseNode(node) {
        let obj = {};
        if (node.nodeType === 1) { 
            if (node.attributes.length > 0) {
                for (let j = 0; j < node.attributes.length; j++) {
                    const attribute = node.attributes.item(j);
                    obj["@" + attribute.nodeName] = attribute.nodeValue;
                }
            }
        } else if (node.nodeType === 3) {
            return node.nodeValue.trim();
        }
        if (node.hasChildNodes()) {
            for (let i = 0; i < node.childNodes.length; i++) {
                const item = node.childNodes.item(i);
                const nodeName = item.nodeName;
                if (typeof obj[nodeName] == "undefined") {
                    const parsed = parseNode(item);
                    if (parsed !== "") obj[nodeName] = parsed;
                } else {
                    if (typeof obj[nodeName].push == "undefined") {
                        const old = obj[nodeName];
                        obj[nodeName] = [];
                        obj[nodeName].push(old);
                    }
                    const parsed = parseNode(item);
                    if (parsed !== "") obj[nodeName].push(parsed);
                }
            }
        }
        return obj;
    }
    return parseNode(xmlDoc.documentElement);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}