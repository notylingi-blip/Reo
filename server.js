const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.text({ limit: '100mb' }));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.static('public'));

// Konfigurasi upload
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});

// Folder
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Generate ID
function generateId() {
    return crypto.randomBytes(6).toString('hex');
}

// Simpan paste
function savePaste(id, content, filename = null) {
    const filePath = path.join(DATA_DIR, `${id}.txt`);
    const metaPath = path.join(DATA_DIR, `${id}.meta.json`);
    
    fs.writeFileSync(filePath, content, 'utf8');
    
    const metadata = {
        id: id,
        filename: filename || `paste-${id}.txt`,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        size: content.length
    };
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    
    return metadata;
}

// Baca paste
function getPaste(id) {
    const filePath = path.join(DATA_DIR, `${id}.txt`);
    const metaPath = path.join(DATA_DIR, `${id}.meta.json`);
    
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        let metadata = null;
        if (fs.existsSync(metaPath)) {
            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
        return { content, metadata };
    }
    return null;
}

// Update paste
function updatePaste(id, content, filename = null) {
    const filePath = path.join(DATA_DIR, `${id}.txt`);
    const metaPath = path.join(DATA_DIR, `${id}.meta.json`);
    
    if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, 'utf8');
        
        if (fs.existsSync(metaPath)) {
            const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            metadata.updated = new Date().toISOString();
            metadata.size = content.length;
            if (filename) metadata.filename = filename;
            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
        }
        return true;
    }
    return false;
}

// Delete paste - FIXED: cuma hapus 1 file aja
function deletePaste(id) {
    const filePath = path.join(DATA_DIR, `${id}.txt`);
    const metaPath = path.join(DATA_DIR, `${id}.meta.json`);
    let deleted = false;
    
    // Hanya hapus file dengan ID yang spesifik
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
    }
    if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
    }
    return deleted;
}

// Get all pastes
function getAllPastes() {
    const files = fs.readdirSync(DATA_DIR);
    const pastes = [];
    
    files.forEach(file => {
        if (file.endsWith('.meta.json')) {
            try {
                const meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
                pastes.push(meta);
            } catch (e) {}
        }
    });
    
    return pastes.sort((a, b) => new Date(b.created) - new Date(a.created));
}

// HOME - UI yang lebih bagus
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reo Pastebin</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                :root {
                    --primary: #6C63FF;
                    --primary-dark: #5A52D5;
                    --secondary: #FF6584;
                    --success: #00C9A7;
                    --warning: #FFC107;
                    --danger: #FF4757;
                    --dark: #2D3436;
                    --gray: #636E72;
                    --light-gray: #DFE6E9;
                    --bg: #F8F9FA;
                }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .main-card {
                    background: white;
                    border-radius: 24px;
                    padding: 35px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    margin-bottom: 20px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                    flex-wrap: wrap;
                    gap: 15px;
                }
                .header-left h1 {
                    font-size: 2.2em;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .header-left .subtitle {
                    color: var(--gray);
                    font-size: 0.95em;
                }
                .header-actions {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .btn {
                    padding: 10px 22px;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.95em;
                    text-decoration: none;
                }
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                }
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .btn-success { background: var(--success); color: white; }
                .btn-danger { background: var(--danger); color: white; }
                .btn-warning { background: var(--warning); color: var(--dark); }
                .btn-secondary { background: var(--light-gray); color: var(--dark); }
                .btn-info { background: #4A9EFF; color: white; }
                .btn-outline {
                    background: transparent;
                    border: 2px solid var(--primary);
                    color: var(--primary);
                }
                .btn-outline:hover { background: var(--primary); color: white; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

                .upload-area {
                    border: 2px dashed var(--light-gray);
                    border-radius: 16px;
                    padding: 30px;
                    text-align: center;
                    transition: all 0.3s;
                    background: #FAFBFC;
                    margin-bottom: 20px;
                    position: relative;
                }
                .upload-area:hover, .upload-area.dragover {
                    border-color: var(--primary);
                    background: #F0EEFF;
                }
                .upload-area .icon { font-size: 40px; margin-bottom: 10px; }
                .upload-area label {
                    cursor: pointer;
                    color: var(--primary);
                    font-weight: 600;
                    font-size: 1.1em;
                }
                .upload-area label:hover { text-decoration: underline; }
                .upload-area input[type="file"] { display: none; }
                .upload-area .hint {
                    color: var(--gray);
                    font-size: 0.9em;
                    margin-top: 8px;
                }
                .file-info {
                    display: none;
                    align-items: center;
                    gap: 15px;
                    padding: 15px 20px;
                    background: #E8F5E9;
                    border-radius: 12px;
                    margin-top: 15px;
                }
                .file-info .filename {
                    font-weight: 600;
                    color: var(--dark);
                }
                .file-info .filesize {
                    color: var(--gray);
                    font-size: 0.9em;
                }
                .file-info .remove-file {
                    cursor: pointer;
                    color: var(--danger);
                    font-weight: 600;
                    margin-left: auto;
                    padding: 5px 12px;
                    border-radius: 8px;
                    background: rgba(255,71,87,0.1);
                }
                .file-info .remove-file:hover { background: rgba(255,71,87,0.2); }

                .filename-input-group {
                    display: flex;
                    gap: 15px;
                    align-items: center;
                    margin-bottom: 15px;
                    flex-wrap: wrap;
                }
                .filename-input-group label {
                    font-weight: 600;
                    color: var(--dark);
                }
                .filename-input-group input {
                    flex: 1;
                    min-width: 200px;
                    padding: 12px 16px;
                    border: 2px solid var(--light-gray);
                    border-radius: 12px;
                    font-size: 0.95em;
                    transition: border-color 0.3s;
                }
                .filename-input-group input:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .editor-wrapper {
                    position: relative;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 2px solid var(--light-gray);
                    transition: border-color 0.3s;
                }
                .editor-wrapper:focus-within {
                    border-color: var(--primary);
                }
                textarea {
                    width: 100%;
                    min-height: 450px;
                    padding: 20px;
                    font-size: 15px;
                    border: none;
                    resize: vertical;
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                    line-height: 1.7;
                    background: white;
                }
                textarea:focus { outline: none; }

                .toolbar {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 15px;
                    flex-wrap: wrap;
                    align-items: center;
                }
                .toolbar .btn { padding: 8px 18px; font-size: 0.9em; }

                .status-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 15px;
                    padding: 15px 20px;
                    background: #FAFBFC;
                    border-radius: 12px;
                    margin-top: 15px;
                }
                .status-left {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    flex-wrap: wrap;
                }
                .paste-id {
                    font-family: monospace;
                    background: var(--light-gray);
                    padding: 5px 14px;
                    border-radius: 8px;
                    font-size: 0.9em;
                }
                .paste-id a {
                    color: var(--primary);
                    text-decoration: none;
                    font-weight: 600;
                }
                .paste-id a:hover { text-decoration: underline; }
                .filename-display {
                    background: #E3F2FD;
                    padding: 5px 14px;
                    border-radius: 8px;
                    font-size: 0.9em;
                    color: #1565C0;
                    font-weight: 500;
                }
                .char-count {
                    color: var(--gray);
                    font-size: 0.85em;
                    background: var(--light-gray);
                    padding: 4px 12px;
                    border-radius: 20px;
                }
                .status-right {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .save-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9em;
                    font-weight: 500;
                }
                .save-status .dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    display: inline-block;
                }
                .dot.green { background: var(--success); }
                .dot.red { background: var(--danger); }
                .dot.yellow { background: var(--warning); }
                .save-status.saved { color: var(--success); }
                .save-status.unsaved { color: var(--danger); }
                .save-status.saving { color: var(--warning); }

                .progress-bar {
                    width: 100%;
                    height: 4px;
                    background: var(--light-gray);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 10px;
                }
                .progress-bar .fill {
                    height: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    width: 0%;
                    transition: width 0.5s ease;
                }

                .shortcuts {
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                    margin-top: 15px;
                    padding: 12px 16px;
                    background: #F8F9FA;
                    border-radius: 12px;
                    font-size: 0.85em;
                    color: var(--gray);
                }
                .shortcuts kbd {
                    background: white;
                    padding: 2px 10px;
                    border-radius: 6px;
                    border: 1px solid var(--light-gray);
                    font-family: monospace;
                    font-size: 0.85em;
                    color: var(--dark);
                }

                .footer {
                    text-align: center;
                    color: rgba(255,255,255,0.7);
                    font-size: 0.85em;
                    padding: 20px 0 10px;
                }

                /* Modal */
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(5px);
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }
                .modal-content {
                    background: white;
                    padding: 35px;
                    border-radius: 20px;
                    max-width: 420px;
                    width: 90%;
                    text-align: center;
                    animation: modalIn 0.3s ease;
                }
                @keyframes modalIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .modal-content .icon { font-size: 50px; margin-bottom: 15px; }
                .modal-content h3 { color: var(--dark); margin-bottom: 10px; }
                .modal-content p { color: var(--gray); margin-bottom: 20px; line-height: 1.6; }
                .modal-content .btn-group {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }

                /* Dashboard link */
                .dashboard-link {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    background: white;
                    padding: 15px 20px;
                    border-radius: 16px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    text-decoration: none;
                    color: var(--dark);
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s;
                    z-index: 100;
                }
                .dashboard-link:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 15px 40px rgba(0,0,0,0.3);
                }

                @media (max-width: 768px) {
                    .main-card { padding: 20px; }
                    .header-left h1 { font-size: 1.6em; }
                    .toolbar .btn { font-size: 0.8em; padding: 6px 14px; }
                    .filename-input-group input { min-width: 150px; }
                    .status-bar { flex-direction: column; align-items: stretch; }
                    .status-right { justify-content: flex-start; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="main-card">
                    <div class="header">
                        <div class="header-left">
                            <h1>📝 Reo Pastebin</h1>
                            <div class="subtitle">Unlimited text • Upload file • Auto-save</div>
                        </div>
                        <div class="header-actions">
                            <a href="/dashboard" class="btn btn-info">📊 Dashboard</a>
                        </div>
                    </div>

                    <!-- Upload Area -->
                    <div class="upload-area" id="uploadArea">
                        <div class="icon">📂</div>
                        <div>
                            <label for="fileInput">Upload file (drag & drop atau klik)</label>
                            <input type="file" id="fileInput" accept="*/*">
                        </div>
                        <div class="hint">Support semua format • Max 100MB</div>
                        <div class="file-info" id="fileInfo">
                            <span>📄</span>
                            <span class="filename" id="fileName">file.txt</span>
                            <span class="filesize" id="fileSize">0 KB</span>
                            <span class="remove-file" onclick="removeFile()">✕ Hapus</span>
                        </div>
                    </div>

                    <!-- Nama File Input -->
                    <div class="filename-input-group">
                        <label>📛 Nama File:</label>
                        <input type="text" id="filenameInput" placeholder="Nama file (contoh: my-code.js)" value="unnamed">
                        <span style="font-size:0.85em;color:var(--gray);">(opsional)</span>
                    </div>

                    <!-- Toolbar -->
                    <div class="toolbar">
                        <button class="btn btn-primary" id="saveBtn" onclick="manualSave()">💾 Save</button>
                        <button class="btn btn-success" onclick="createNew()">✨ New</button>
                        <button class="btn btn-info" onclick="viewRaw()">📄 Raw</button>
                        <button class="btn btn-warning" onclick="viewPaste()">👁️ View</button>
                        <button class="btn btn-secondary" onclick="downloadFile()">⬇️ Download</button>
                        <button class="btn btn-danger" onclick="confirmDelete()">🗑️ Delete</button>
                    </div>

                    <!-- Editor -->
                    <div class="editor-wrapper">
                        <textarea id="editor" placeholder="Tulis atau paste teks kamu di sini... (unlimited)"></textarea>
                    </div>

                    <!-- Status Bar -->
                    <div class="status-bar">
                        <div class="status-left">
                            <span class="paste-id" id="pasteIdDisplay">
                                ID: <a href="#" id="pasteIdLink">belum dibuat</a>
                            </span>
                            <span class="filename-display" id="filenameDisplay">📄 unnamed</span>
                            <span class="char-count" id="charCount">0 karakter</span>
                        </div>
                        <div class="status-right">
                            <div class="save-status saved" id="saveStatus">
                                <span class="dot green" id="saveDot"></span>
                                <span id="statusText">✅ Tersimpan</span>
                            </div>
                            <span style="color:var(--gray);font-size:0.85em;" id="lastSaveTime"></span>
                        </div>
                    </div>

                    <!-- Progress -->
                    <div class="progress-bar">
                        <div class="fill" id="progressFill"></div>
                    </div>

                    <!-- Shortcuts -->
                    <div class="shortcuts">
                        💡 <kbd>Ctrl+S</kbd> Save &nbsp;•&nbsp; <kbd>Ctrl+Shift+N</kbd> New &nbsp;•&nbsp;
                        <kbd>Ctrl+U</kbd> Upload &nbsp;•&nbsp; <kbd>Ctrl+D</kbd> Download
                    </div>
                </div>

                <div class="footer">
                    Reo Pastebin v2 • Unlimited karakter • Auto-save setiap 5 detik
                </div>
            </div>

            <!-- Delete Modal -->
            <div class="modal" id="deleteModal">
                <div class="modal-content">
                    <div class="icon">🗑️</div>
                    <h3>Hapus Paste?</h3>
                    <p>Yakin mau hapus paste ini? <br><strong style="color:var(--danger);">Tindakan ini tidak bisa dibatalkan!</strong></p>
                    <div class="btn-group">
                        <button class="btn btn-danger" onclick="deletePaste()">Ya, Hapus</button>
                        <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
                    </div>
                </div>
            </div>

            <!-- Dashboard Floating Button -->
            <a href="/dashboard" class="dashboard-link">
                📊 Dashboard
            </a>

            <script>
                let currentId = null;
                let currentFilename = 'unnamed';
                let isDirty = false;
                let lastSavedContent = '';
                let uploadedFile = null;
                const baseUrl = window.location.origin;

                // DOM Elements
                const editor = document.getElementById('editor');
                const filenameInput = document.getElementById('filenameInput');
                const statusText = document.getElementById('statusText');
                const saveDot = document.getElementById('saveDot');
                const saveStatus = document.getElementById('saveStatus');
                const progressFill = document.getElementById('progressFill');

                // Load dari localStorage
                function loadFromStorage() {
                    const savedId = localStorage.getItem('reo_paste_id');
                    const savedContent = localStorage.getItem('reo_paste_content');
                    const savedFilename = localStorage.getItem('reo_paste_filename');
                    
                    if (savedId && savedContent) {
                        currentId = savedId;
                        currentFilename = savedFilename || 'unnamed';
                        editor.value = savedContent;
                        filenameInput.value = currentFilename;
                        lastSavedContent = savedContent;
                        updatePasteInfo();
                        updateStatus('saved', '✅ Tersimpan');
                        updateFilenameDisplay();
                        updateCharCount();
                        return true;
                    }
                    return false;
                }

                // Simpan ke localStorage
                function saveToStorage(content, filename = null) {
                    if (currentId) {
                        localStorage.setItem('reo_paste_id', currentId);
                        localStorage.setItem('reo_paste_content', content);
                        if (filename) {
                            localStorage.setItem('reo_paste_filename', filename);
                            currentFilename = filename;
                            updateFilenameDisplay();
                        }
                        lastSavedContent = content;
                        isDirty = false;
                        updateStatus('saved', '✅ Tersimpan');
                        updateCharCount();
                    }
                }

                // Update status
                function updateStatus(type, message) {
                    statusText.textContent = message;
                    if (type === 'saved') {
                        saveStatus.className = 'save-status saved';
                        saveDot.className = 'dot green';
                        isDirty = false;
                    } else if (type === 'unsaved') {
                        saveStatus.className = 'save-status unsaved';
                        saveDot.className = 'dot red';
                        isDirty = true;
                    } else if (type === 'saving') {
                        saveStatus.className = 'save-status saving';
                        saveDot.className = 'dot yellow';
                    }
                }

                // Progress bar
                function showProgress(percent) {
                    progressFill.style.width = percent + '%';
                }

                // Update info
                function updatePasteInfo() {
                    const link = document.getElementById('pasteIdLink');
                    if (currentId) {
                        link.textContent = currentId;
                        link.href = '/' + currentId;
                    } else {
                        link.textContent = 'belum dibuat';
                        link.href = '#';
                    }
                }

                function updateFilenameDisplay() {
                    const display = document.getElementById('filenameDisplay');
                    const name = filenameInput.value || 'unnamed';
                    display.textContent = '📄 ' + name;
                    currentFilename = name;
                }

                function updateCharCount() {
                    const count = editor.value.length;
                    document.getElementById('charCount').textContent = count.toLocaleString() + ' karakter';
                }

                // Manual Save
                async function manualSave() {
                    const content = editor.value;
                    if (!content.trim()) {
                        alert('Konten tidak boleh kosong!');
                        return;
                    }

                    const filename = filenameInput.value.trim() || 'unnamed';
                    updateStatus('saving', '⏳ Menyimpan...');
                    showProgress(50);

                    try {
                        const response = await fetch('/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                id: currentId, 
                                content: content,
                                filename: filename
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                                saveToStorage(content, filename);
                                updateStatus('saved', '✅ Tersimpan');
                                document.getElementById('lastSaveTime').textContent = 
                                    '🕐 ' + new Date().toLocaleTimeString();
                                showProgress(100);
                                setTimeout(() => showProgress(0), 500);
                            }
                        } else {
                            throw new Error('Save failed');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        updateStatus('unsaved', '❌ Gagal menyimpan!');
                        showProgress(0);
                    }
                }

                // Auto-save
                async function autoSave() {
                    if (!currentId) return;

                    const content = editor.value;
                    if (content === lastSavedContent) return;
                    if (!content.trim()) {
                        updateStatus('unsaved', '⚠️ Konten kosong');
                        return;
                    }

                    const filename = filenameInput.value.trim() || 'unnamed';
                    showProgress(30);

                    try {
                        const response = await fetch('/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                id: currentId, 
                                content: content,
                                filename: filename
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                                saveToStorage(content, filename);
                                document.getElementById('lastSaveTime').textContent = 
                                    '🕐 ' + new Date().toLocaleTimeString();
                                showProgress(100);
                                setTimeout(() => showProgress(0), 300);
                            }
                        }
                    } catch (error) {
                        console.error('Auto-save error:', error);
                        updateStatus('unsaved', '⚠️ Auto-save gagal');
                        showProgress(0);
                    }
                }

                // Create new paste
                async function createNew() {
                    if (isDirty) {
                        if (!confirm('Ada perubahan yang belum disimpan. Buat baru tetap?')) {
                            return;
                        }
                    }

                    const content = editor.value;
                    if (!content.trim()) {
                        alert('Tulis sesuatu dulu!');
                        return;
                    }

                    const filename = filenameInput.value.trim() || 'unnamed';
                    showProgress(50);

                    try {
                        const response = await fetch('/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                content: content,
                                filename: filename
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                                currentId = data.id;
                                saveToStorage(content, filename);
                                updatePasteInfo();
                                updateStatus('saved', '✅ Paste baru dibuat');
                                document.getElementById('lastSaveTime').textContent = 
                                    '🕐 ' + new Date().toLocaleTimeString();
                                showProgress(100);
                                setTimeout(() => showProgress(0), 500);
                                window.history.pushState({}, '', '/' + currentId);
                            }
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        alert('Gagal membuat paste!');
                        showProgress(0);
                    }
                }

                // Upload file
                function handleFileUpload(file) {
                    if (!file) return;
                    
                    uploadedFile = file;
                    const filename = file.name;
                    filenameInput.value = filename;
                    currentFilename = filename;
                    
                    document.getElementById('fileInfo').style.display = 'flex';
                    document.getElementById('fileName').textContent = filename;
                    document.getElementById('fileSize').textContent = formatFileSize(file.size);
                    
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        editor.value = e.target.result;
                        lastSavedContent = e.target.result;
                        updateCharCount();
                        updateStatus('unsaved', '📂 File dimuat');
                        updateFilenameDisplay();
                        
                        if (currentId) {
                            setTimeout(autoSave, 1000);
                        }
                    };
                    reader.readAsText(file);
                }

                function formatFileSize(bytes) {
                    if (bytes < 1024) return bytes + ' B';
                    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                }

                function removeFile() {
                    uploadedFile = null;
                    document.getElementById('fileInfo').style.display = 'none';
                    document.getElementById('fileInput').value = '';
                }

                // View raw
                function viewRaw() {
                    if (currentId) {
                        window.open(baseUrl + '/raw/' + currentId, '_blank');
                    } else {
                        alert('Tidak ada paste untuk dilihat!');
                    }
                }

                function viewPaste() {
                    if (currentId) {
                        window.open(baseUrl + '/' + currentId, '_blank');
                    } else {
                        alert('Tidak ada paste untuk dilihat!');
                    }
                }

                // Download
                function downloadFile() {
                    const content = editor.value;
                    if (!content.trim()) {
                        alert('Tidak ada konten untuk di-download!');
                        return;
                    }
                    
                    const filename = filenameInput.value.trim() || 'paste.txt';
                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }

                // Delete - FIXED: cuma hapus 1 file
                function confirmDelete() {
                    if (!currentId) {
                        alert('Tidak ada paste untuk dihapus!');
                        return;
                    }
                    document.getElementById('deleteModal').style.display = 'flex';
                }

                async function deletePaste() {
                    if (!currentId) return;

                    try {
                        const response = await fetch('/delete/' + currentId, {
                            method: 'DELETE'
                        });

                        if (response.ok) {
                            // Hapus hanya data yang spesifik
                            localStorage.removeItem('reo_paste_id');
                            localStorage.removeItem('reo_paste_content');
                            localStorage.removeItem('reo_paste_filename');
                            currentId = null;
                            lastSavedContent = '';
                            editor.value = '';
                            filenameInput.value = 'unnamed';
                            updatePasteInfo();
                            updateStatus('saved', '✅ Paste dihapus');
                            document.getElementById('lastSaveTime').textContent = '';
                            closeModal();
                            window.history.pushState({}, '', '/');
                            removeFile();
                            updateCharCount();
                            updateFilenameDisplay();
                            showProgress(0);
                            alert('✅ Paste berhasil dihapus!');
                        } else {
                            throw new Error('Delete failed');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        alert('❌ Gagal menghapus paste!');
                    }
                }

                function closeModal() {
                    document.getElementById('deleteModal').style.display = 'none';
                }

                // Event Listeners
                document.getElementById('deleteModal').addEventListener('click', function(e) {
                    if (e.target === this) closeModal();
                });

                editor.addEventListener('input', function() {
                    const content = this.value;
                    if (content !== lastSavedContent) {
                        updateStatus('unsaved', '⚠️ Belum tersimpan');
                        if (currentId) {
                            localStorage.setItem('reo_paste_content', content);
                        }
                    }
                    updateCharCount();
                });

                filenameInput.addEventListener('input', function() {
                    updateFilenameDisplay();
                    if (currentId) {
                        localStorage.setItem('reo_paste_filename', this.value);
                    }
                });

                // Upload events
                document.getElementById('fileInput').addEventListener('change', function(e) {
                    if (this.files && this.files[0]) {
                        handleFileUpload(this.files[0]);
                    }
                });

                const uploadArea = document.getElementById('uploadArea');
                uploadArea.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    this.classList.add('dragover');
                });
                uploadArea.addEventListener('dragleave', function(e) {
                    e.preventDefault();
                    this.classList.remove('dragover');
                });
                uploadArea.addEventListener('drop', function(e) {
                    e.preventDefault();
                    this.classList.remove('dragover');
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileUpload(e.dataTransfer.files[0]);
                    }
                });

                // Keyboard shortcuts
                document.addEventListener('keydown', function(e) {
                    if (e.ctrlKey && e.key === 's') {
                        e.preventDefault();
                        manualSave();
                    }
                    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                        e.preventDefault();
                        createNew();
                    }
                    if (e.ctrlKey && e.key === 'u') {
                        e.preventDefault();
                        document.getElementById('fileInput').click();
                    }
                    if (e.ctrlKey && e.key === 'd') {
                        e.preventDefault();
                        downloadFile();
                    }
                });

                // Load data
                document.addEventListener('DOMContentLoaded', function() {
                    const path = window.location.pathname;
                    if (path && path.length > 1 && path !== '/dashboard') {
                        const id = path.substring(1);
                        if (id.length === 12) {
                            fetch('/get/' + id)
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        currentId = id;
                                        currentFilename = data.metadata?.filename || 'unnamed';
                                        editor.value = data.content;
                                        filenameInput.value = currentFilename;
                                        lastSavedContent = data.content;
                                        saveToStorage(data.content, currentFilename);
                                        updatePasteInfo();
                                        updateStatus('saved', '✅ Dimuat dari server');
                                        updateFilenameDisplay();
                                        updateCharCount();
                                    }
                                })
                                .catch(() => {
                                    if (!loadFromStorage()) {
                                        if (editor.value.trim()) {
                                            createNew();
                                        }
                                    }
                                });
                            return;
                        }
                    }

                    if (!loadFromStorage()) {
                        updatePasteInfo();
                        updateStatus('saved', '✅ Siap');
                        updateFilenameDisplay();
                        updateCharCount();
                    }
                });

                // Auto-save interval
                setInterval(autoSave, 5000);

                // Save before unload
                window.addEventListener('beforeunload', function() {
                    if (isDirty && currentId) {
                        const content = editor.value;
                        const filename = filenameInput.value.trim() || 'unnamed';
                        localStorage.setItem('reo_paste_content', content);
                        localStorage.setItem('reo_paste_filename', filename);
                        navigator.sendBeacon('/update', JSON.stringify({
                            id: currentId,
                            content: content,
                            filename: filename
                        }));
                    }
                });

                console.log('📝 Reo Pastebin v2 loaded!');
                console.log('✅ Bug delete fixed!');
                console.log('📛 Kolom nama file tersedia!');
                console.log('🎨 UI lebih bagus!');
                console.log('⌨️  Ctrl+S save, Ctrl+Shift+N new, Ctrl+U upload, Ctrl+D download');
            </script>
        </body>
        </html>
    `);
});

// DASHBOARD
app.get('/dashboard', (req, res) => {
    const pastes = getAllPastes();
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - Reo Pastebin</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                :root {
                    --primary: #6C63FF;
                    --gray: #636E72;
                    --light-gray: #DFE6E9;
                    --dark: #2D3436;
                }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: #F0F2F5;
                    padding: 20px;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .header {
                    background: white;
                    border-radius: 20px;
                    padding: 30px;
                    margin-bottom: 20px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.08);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 15px;
                }
                .header h1 {
                    font-size: 2em;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .header .stats {
                    color: var(--gray);
                    font-size: 1em;
                }
                .btn {
                    padding: 10px 24px;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px rgba(102,126,234,0.3);
                }
                .btn-secondary {
                    background: var(--light-gray);
                    color: var(--dark);
                }
                .btn-secondary:hover {
                    background: #d0d0d0;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                }
                .card {
                    background: white;
                    border-radius: 16px;
                    padding: 25px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.06);
                    transition: all 0.3s;
                }
                .card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                .card .id {
                    font-family: monospace;
                    color: var(--primary);
                    font-weight: 600;
                    font-size: 0.95em;
                }
                .card .filename {
                    font-weight: 600;
                    font-size: 1.1em;
                    margin: 10px 0 8px;
                    color: var(--dark);
                }
                .card .meta {
                    color: var(--gray);
                    font-size: 0.85em;
                    line-height: 1.6;
                }
                .card .size {
                    color: var(--gray);
                    font-size: 0.8em;
                    margin-top: 5px;
                }
                .card .actions {
                    margin-top: 15px;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .card .actions .btn {
                    padding: 6px 14px;
                    font-size: 0.8em;
                    border-radius: 8px;
                }
                .empty {
                    grid-column: 1/-1;
                    text-align: center;
                    padding: 80px 20px;
                    background: white;
                    border-radius: 20px;
                }
                .empty .icon { font-size: 70px; margin-bottom: 15px; }
                .empty h3 { color: var(--dark); margin-bottom: 8px; }
                .empty p { color: var(--gray); }
                @media (max-width: 768px) {
                    .grid { grid-template-columns: 1fr; }
                    .header { flex-direction: column; text-align: center; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div>
                        <h1>📊 Dashboard</h1>
                        <div class="stats">${pastes.length} paste${pastes.length !== 1 ? 's' : ''} tersimpan</div>
                    </div>
                    <a href="/" class="btn btn-primary">✏️ Kembali ke Editor</a>
                </div>
                
                <div class="grid">
                    ${pastes.length === 0 ? `
                        <div class="empty">
                            <div class="icon">📭</div>
                            <h3>Belum ada paste</h3>
                            <p>Buat paste pertama kamu di editor!</p>
                            <a href="/" class="btn btn-primary" style="margin-top:15px;">📝 Buat Paste</a>
                        </div>
                    ` : pastes.map(paste => `
                        <div class="card">
                            <div class="id">#${paste.id}</div>
                            <div class="filename">📄 ${paste.filename || 'unnamed'}</div>
                            <div class="meta">📅 Dibuat: ${new Date(paste.created).toLocaleString('id-ID')}</div>
                            <div class="meta">🔄 Diupdate: ${new Date(paste.updated).toLocaleString('id-ID')}</div>
                            <div class="size">📏 ${(paste.size || 0).toLocaleString()} karakter</div>
                            <div class="actions">
                                <a href="/${paste.id}" class="btn btn-secondary">👁️ View</a>
                                <a href="/raw/${paste.id}" class="btn btn-secondary">📄 Raw</a>
                                <a href="/?id=${paste.id}" class="btn btn-primary">✏️ Edit</a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </body>
        </html>
    `);
});

// API Routes
app.post('/create', (req, res) => {
    const { content, filename } = req.body;
    if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, error: 'Content cannot be empty' });
    }
    
    const id = generateId();
    const metadata = savePaste(id, content, filename || 'unnamed');
    res.json({ success: true, id: id, metadata: metadata });
});

app.get('/get/:id', (req, res) => {
    const id = req.params.id;
    const result = getPaste(id);
    
    if (!result) {
        return res.status(404).json({ success: false, error: 'Paste not found' });
    }
    
    res.json({ success: true, content: result.content, metadata: result.metadata });
});

app.post('/update', (req, res) => {
    const { id, content, filename } = req.body;
    
    if (!id || content === undefined) {
        return res.status(400).json({ success: false, error: 'ID and content required' });
    }
    
    const updated = updatePaste(id, content, filename || 'unnamed');
    if (!updated) {
        return res.status(404).json({ success: false, error: 'Paste not found' });
    }
    
    res.json({ success: true });
});

app.delete('/delete/:id', (req, res) => {
    const id = req.params.id;
    const deleted = deletePaste(id);
    
    if (!deleted) {
        return res.status(404).json({ success: false, error: 'Paste not found' });
    }
    
    res.json({ success: true });
});

app.get('/raw/:id', (req, res) => {
    const id = req.params.id;
    const result = getPaste(id);
    
    if (!result) {
        return res.status(404).send('Paste not found');
    }
    
    const filename = result.metadata?.filename || `paste-${id}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(result.content);
});

app.get('/:id', (req, res) => {
    const id = req.params.id;
    const result = getPaste(id);
    
    if (!result) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Not Found</title></head>
            <body style="font-family:Arial;text-align:center;padding:50px;">
                <h2>❌ Paste Not Found</h2>
                <p>Paste tidak ditemukan atau sudah dihapus.</p>
                <a href="/" style="color:#667eea;">← Kembali</a>
            </body>
            </html>
        `);
    }
    
    res.send(`<meta http-equiv="refresh" content="0;url=/?id=${id}">`);
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`🚀 Reo Pastebin v2 running on port ${PORT}`);
    console.log(`📝 Visit: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`✅ Bug delete fixed!`);
    console.log(`📛 Kolom nama file tersedia!`);
});
