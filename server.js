const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.text({ limit: '100mb' })); // Unlimited text
app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.static('public'));

// Konfigurasi upload file
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    fileFilter: (req, file, cb) => {
        // Terima semua file
        cb(null, true);
    }
});

// Folder untuk menyimpan paste
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Generate random ID
function generateId() {
    return crypto.randomBytes(6).toString('hex');
}

// Simpan paste ke file dengan metadata
function savePaste(id, content, filename = null) {
    const filePath = path.join(DATA_DIR, `${id}.txt`);
    const metaPath = path.join(DATA_DIR, `${id}.meta.json`);
    
    // Save content
    fs.writeFileSync(filePath, content, 'utf8');
    
    // Save metadata
    const metadata = {
        id: id,
        filename: filename || `paste-${id}.txt`,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        size: content.length,
        type: 'text'
    };
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    
    return metadata;
}

// Baca paste dari file
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

// Delete paste
function deletePaste(id) {
    const filePath = path.join(DATA_DIR, `${id}.txt`);
    const metaPath = path.join(DATA_DIR, `${id}.meta.json`);
    let deleted = false;
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
    }
    if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
    }
    return deleted;
}

// Get all pastes (for dashboard)
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

// Homepage - Reo Pastebin dengan Upload
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
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 {
                    color: #333;
                    margin-bottom: 5px;
                    font-size: 2.5em;
                }
                .subtitle {
                    color: #666;
                    margin-bottom: 20px;
                    font-size: 1.1em;
                }
                .toolbar {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 15px;
                    flex-wrap: wrap;
                    align-items: center;
                }
                .toolbar button {
                    padding: 8px 20px;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .btn-save {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .btn-save:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102,126,234,0.4); }
                .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-new { background: #28a745; color: white; }
                .btn-new:hover { background: #218838; }
                .btn-delete { background: #dc3545; color: white; }
                .btn-delete:hover { background: #c82333; }
                .btn-raw { background: #17a2b8; color: white; }
                .btn-raw:hover { background: #138496; }
                .btn-view { background: #ffc107; color: #333; }
                .btn-view:hover { background: #e0a800; }
                .btn-upload { background: #6f42c1; color: white; }
                .btn-upload:hover { background: #5a32a3; }
                .btn-download { background: #20c997; color: white; }
                .btn-download:hover { background: #1ba87e; }
                .btn-dashboard { background: #fd7e14; color: white; }
                .btn-dashboard:hover { background: #e06b0a; }
                .status {
                    font-size: 0.9em;
                    color: #666;
                    margin-left: auto;
                }
                .status.saved { color: #28a745; }
                .status.unsaved { color: #dc3545; }
                .editor-wrapper {
                    position: relative;
                }
                textarea {
                    width: 100%;
                    min-height: 400px;
                    padding: 20px;
                    font-size: 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    resize: vertical;
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                    line-height: 1.6;
                    transition: border-color 0.3s;
                }
                textarea:focus {
                    outline: none;
                    border-color: #667eea;
                }
                .upload-area {
                    border: 2px dashed #ddd;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    margin-bottom: 15px;
                    transition: all 0.3s;
                    background: #f8f9fa;
                }
                .upload-area:hover {
                    border-color: #667eea;
                    background: #f0f0ff;
                }
                .upload-area.dragover {
                    border-color: #667eea;
                    background: #e8e8ff;
                }
                .upload-area input[type="file"] {
                    display: none;
                }
                .upload-area label {
                    cursor: pointer;
                    color: #667eea;
                    font-weight: 600;
                }
                .upload-area label:hover {
                    text-decoration: underline;
                }
                .file-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: #e7f3ff;
                    border-radius: 8px;
                    margin-top: 10px;
                }
                .file-info .filename {
                    font-weight: 600;
                    color: #333;
                }
                .file-info .filesize {
                    color: #666;
                    font-size: 0.9em;
                }
                .file-info .remove-file {
                    cursor: pointer;
                    color: #dc3545;
                    font-weight: 600;
                    margin-left: auto;
                }
                .file-info .remove-file:hover {
                    text-decoration: underline;
                }
                .info-bar {
                    margin-top: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 10px;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 10px;
                }
                .paste-id {
                    font-family: monospace;
                    background: #e9ecef;
                    padding: 5px 12px;
                    border-radius: 5px;
                    font-size: 0.9em;
                }
                .paste-id a {
                    color: #667eea;
                    text-decoration: none;
                }
                .paste-id a:hover { text-decoration: underline; }
                .filename-display {
                    background: #d4edda;
                    padding: 5px 12px;
                    border-radius: 5px;
                    font-size: 0.9em;
                    color: #155724;
                }
                .auto-save-indicator {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9em;
                    color: #28a745;
                }
                .auto-save-indicator .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                }
                .dot.green { background: #28a745; }
                .dot.red { background: #dc3545; }
                .stats {
                    font-size: 0.85em;
                    color: #888;
                }
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    color: #aaa;
                    font-size: 0.8em;
                }
                .shortcuts {
                    font-size: 0.85em;
                    color: #888;
                    margin-top: 10px;
                }
                .shortcuts kbd {
                    background: #f0f0f0;
                    padding: 2px 8px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                    font-family: monospace;
                }
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    max-width: 400px;
                    text-align: center;
                }
                .modal-content button {
                    margin: 10px 5px;
                    padding: 8px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .modal-confirm { background: #dc3545; color: white; }
                .modal-cancel { background: #6c757d; color: white; }
                .progress-bar {
                    width: 100%;
                    height: 4px;
                    background: #e0e0e0;
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 10px;
                }
                .progress-bar .fill {
                    height: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    width: 0%;
                    transition: width 0.3s;
                }
                .char-count {
                    color: #666;
                    font-size: 0.85em;
                }
                @media (max-width: 768px) {
                    .container { padding: 15px; }
                    .toolbar button { font-size: 0.85em; padding: 6px 12px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📝 Reo Pastebin</h1>
                <p class="subtitle">Unlimited text with upload & auto-save</p>
                
                <div class="upload-area" id="uploadArea">
                    <div>
                        <label for="fileInput">📂 Upload file (drag & drop or click)</label>
                        <input type="file" id="fileInput" accept="*/*">
                        <div style="margin-top:10px;font-size:0.9em;color:#888;">
                            Support semua format file (max 100MB)
                        </div>
                    </div>
                    <div id="fileInfo" style="display:none;" class="file-info">
                        <span>📄</span>
                        <span class="filename" id="fileName">file.txt</span>
                        <span class="filesize" id="fileSize">0 KB</span>
                        <span class="remove-file" onclick="removeFile()">✕ Hapus</span>
                    </div>
                </div>
                
                <div class="toolbar">
                    <button class="btn-save" id="saveBtn" onclick="manualSave()">💾 Save</button>
                    <button class="btn-new" onclick="createNew()">➕ New</button>
                    <button class="btn-raw" onclick="viewRaw()">📄 Raw</button>
                    <button class="btn-view" onclick="viewPaste()">👁️ View</button>
                    <button class="btn-download" onclick="downloadFile()">⬇️ Download</button>
                    <button class="btn-delete" onclick="confirmDelete()">🗑️ Delete</button>
                    <button class="btn-dashboard" onclick="viewDashboard()">📊 Dashboard</button>
                    <span class="status" id="statusText">✅ Saved</span>
                </div>
                
                <div class="editor-wrapper">
                    <textarea id="editor" placeholder="Tulis atau paste teks kamu di sini... (unlimited)"></textarea>
                </div>
                
                <div class="info-bar">
                    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                        <span class="paste-id" id="pasteIdDisplay">
                            ID: <a href="#" id="pasteIdLink">belum dibuat</a>
                        </span>
                        <span class="filename-display" id="filenameDisplay">📄 unnamed</span>
                        <span class="char-count" id="charCount">0 karakter</span>
                    </div>
                    <div class="auto-save-indicator">
                        <span class="dot green" id="saveDot"></span>
                        <span id="saveStatus">Auto-save: ON</span>
                        <span style="color:#999;margin-left:10px;" id="lastSaveTime"></span>
                    </div>
                </div>
                
                <div class="progress-bar">
                    <div class="fill" id="progressFill"></div>
                </div>
                
                <div class="shortcuts">
                    💡 <kbd>Ctrl+S</kbd> Save &nbsp;|&nbsp; <kbd>Ctrl+Shift+N</kbd> New &nbsp;|&nbsp; 
                    <kbd>Ctrl+U</kbd> Upload file &nbsp;|&nbsp; <kbd>Ctrl+D</kbd> Download
                </div>
                
                <div class="footer">Reo Pastebin &bull; Unlimited karakter &bull; Auto-save setiap 5 detik</div>
            </div>

            <!-- Delete Modal -->
            <div class="modal" id="deleteModal">
                <div class="modal-content">
                    <h3>🗑️ Delete Paste?</h3>
                    <p>Are you sure you want to delete this paste? This action cannot be undone.</p>
                    <button class="modal-confirm" onclick="deletePaste()">Yes, Delete</button>
                    <button class="modal-cancel" onclick="closeModal()">Cancel</button>
                </div>
            </div>

            <script>
                let currentId = null;
                let currentFilename = null;
                let isDirty = false;
                let autoSaveTimer = null;
                let lastSavedContent = '';
                let uploadedFile = null;
                const baseUrl = window.location.origin;

                // Load dari localStorage
                function loadFromStorage() {
                    const savedId = localStorage.getItem('reo_paste_id');
                    const savedContent = localStorage.getItem('reo_paste_content');
                    const savedFilename = localStorage.getItem('reo_paste_filename');
                    
                    if (savedId && savedContent) {
                        currentId = savedId;
                        currentFilename = savedFilename || 'unnamed';
                        document.getElementById('editor').value = savedContent;
                        lastSavedContent = savedContent;
                        updatePasteInfo();
                        updateStatus('saved', 'Loaded from storage');
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
                        updateStatus('saved', 'Auto-saved');
                        updateCharCount();
                    }
                }

                // Manual save ke server
                async function manualSave() {
                    const content = document.getElementById('editor').value;
                    if (!content.trim()) {
                        alert('Cannot save empty content!');
                        return;
                    }

                    showProgress(50);

                    try {
                        const response = await fetch('/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                id: currentId, 
                                content: content,
                                filename: currentFilename || 'unnamed'
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                                saveToStorage(content, currentFilename);
                                updateStatus('saved', 'Manual save');
                                document.getElementById('saveBtn').disabled = true;
                                showProgress(100);
                                setTimeout(() => {
                                    document.getElementById('saveBtn').disabled = false;
                                    showProgress(0);
                                }, 1500);
                            }
                        } else {
                            throw new Error('Save failed');
                        }
                    } catch (error) {
                        console.error('Error saving:', error);
                        updateStatus('unsaved', 'Save failed!');
                        showProgress(0);
                    }
                }

                // Auto-save ke server
                async function autoSave() {
                    if (!currentId) return;

                    const content = document.getElementById('editor').value;
                    if (content === lastSavedContent) return;

                    if (!content.trim()) {
                        updateStatus('unsaved', 'Empty content');
                        return;
                    }

                    showProgress(30);

                    try {
                        const response = await fetch('/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                id: currentId, 
                                content: content,
                                filename: currentFilename || 'unnamed'
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                                saveToStorage(content, currentFilename);
                                updateStatus('saved', 'Auto-saved');
                                document.getElementById('lastSaveTime').textContent = 
                                    '🕐 ' + new Date().toLocaleTimeString();
                                showProgress(100);
                                setTimeout(() => showProgress(0), 500);
                            }
                        }
                    } catch (error) {
                        console.error('Auto-save error:', error);
                        updateStatus('unsaved', 'Auto-save failed');
                        showProgress(0);
                    }
                }

                // Upload file
                function handleFileUpload(file) {
                    if (!file) return;
                    
                    uploadedFile = file;
                    currentFilename = file.name;
                    
                    // Tampilkan info file
                    document.getElementById('fileInfo').style.display = 'flex';
                    document.getElementById('fileName').textContent = file.name;
                    document.getElementById('fileSize').textContent = formatFileSize(file.size);
                    
                    // Baca file
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const content = e.target.result;
                        document.getElementById('editor').value = content;
                        lastSavedContent = content;
                        updateCharCount();
                        updateStatus('unsaved', 'File loaded');
                        
                        // Auto-save setelah upload
                        if (currentId) {
                            setTimeout(autoSave, 1000);
                        }
                    };
                    reader.readAsText(file);
                }

                // Format file size
                function formatFileSize(bytes) {
                    if (bytes < 1024) return bytes + ' B';
                    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                }

                // Remove uploaded file
                function removeFile() {
                    uploadedFile = null;
                    document.getElementById('fileInfo').style.display = 'none';
                    document.getElementById('fileInput').value = '';
                    currentFilename = 'unnamed';
                    updateFilenameDisplay();
                }

                // Buat paste baru
                async function createNew() {
                    if (isDirty) {
                        if (!confirm('You have unsaved changes. Create new anyway?')) {
                            return;
                        }
                    }

                    const content = document.getElementById('editor').value;
                    if (!content.trim()) {
                        alert('Please write something first!');
                        return;
                    }

                    showProgress(50);

                    try {
                        const response = await fetch('/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                content: content,
                                filename: currentFilename || 'unnamed'
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                                currentId = data.id;
                                saveToStorage(content, currentFilename);
                                updatePasteInfo();
                                updateStatus('saved', 'Created new paste');
                                document.getElementById('lastSaveTime').textContent = 
                                    '🕐 ' + new Date().toLocaleTimeString();
                                showProgress(100);
                                setTimeout(() => showProgress(0), 500);
                                
                                window.history.pushState({}, '', '/' + currentId);
                            }
                        }
                    } catch (error) {
                        console.error('Error creating:', error);
                        alert('Failed to create paste!');
                        showProgress(0);
                    }
                }

                // Update info paste
                function updatePasteInfo() {
                    if (currentId) {
                        document.getElementById('pasteIdLink').textContent = currentId;
                        document.getElementById('pasteIdLink').href = '/' + currentId;
                        document.getElementById('pasteIdDisplay').style.display = 'inline';
                    } else {
                        document.getElementById('pasteIdLink').textContent = 'belum dibuat';
                        document.getElementById('pasteIdLink').href = '#';
                    }
                }

                // Update filename display
                function updateFilenameDisplay() {
                    const display = document.getElementById('filenameDisplay');
                    if (currentFilename && currentFilename !== 'unnamed') {
                        display.textContent = '📄 ' + currentFilename;
                        display.style.display = 'inline';
                    } else {
                        display.textContent = '📄 unnamed';
                    }
                }

                // Update char count
                function updateCharCount() {
                    const content = document.getElementById('editor').value;
                    const count = content.length;
                    document.getElementById('charCount').textContent = 
                        count.toLocaleString() + ' karakter';
                }

                // Update status
                function updateStatus(type, message) {
                    const statusText = document.getElementById('statusText');
                    const dot = document.getElementById('saveDot');
                    
                    if (type === 'saved') {
                        statusText.textContent = '✅ ' + message;
                        statusText.className = 'status saved';
                        dot.className = 'dot green';
                        isDirty = false;
                    } else {
                        statusText.textContent = '⚠️ ' + message;
                        statusText.className = 'status unsaved';
                        dot.className = 'dot red';
                        isDirty = true;
                    }
                }

                // Show progress
                function showProgress(percent) {
                    document.getElementById('progressFill').style.width = percent + '%';
                }

                // View raw
                function viewRaw() {
                    if (currentId) {
                        window.open(baseUrl + '/raw/' + currentId, '_blank');
                    } else {
                        alert('No paste to view!');
                    }
                }

                // View paste
                function viewPaste() {
                    if (currentId) {
                        window.open(baseUrl + '/' + currentId, '_blank');
                    } else {
                        alert('No paste to view!');
                    }
                }

                // Download file
                function downloadFile() {
                    const content = document.getElementById('editor').value;
                    if (!content.trim()) {
                        alert('No content to download!');
                        return;
                    }
                    
                    const filename = currentFilename || 'paste.txt';
                    const blob = new Blob([content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }

                // View dashboard
                function viewDashboard() {
                    window.open(baseUrl + '/dashboard', '_blank');
                }

                // Delete paste
                function confirmDelete() {
                    if (!currentId) {
                        alert('No paste to delete!');
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
                            localStorage.removeItem('reo_paste_id');
                            localStorage.removeItem('reo_paste_content');
                            localStorage.removeItem('reo_paste_filename');
                            currentId = null;
                            currentFilename = null;
                            lastSavedContent = '';
                            document.getElementById('editor').value = '';
                            updatePasteInfo();
                            updateStatus('saved', 'Deleted');
                            document.getElementById('lastSaveTime').textContent = '';
                            closeModal();
                            window.history.pushState({}, '', '/');
                            removeFile();
                            updateCharCount();
                            updateFilenameDisplay();
                        }
                    } catch (error) {
                        console.error('Error deleting:', error);
                        alert('Failed to delete paste!');
                    }
                }

                function closeModal() {
                    document.getElementById('deleteModal').style.display = 'none';
                }

                // Event listeners
                document.getElementById('deleteModal').addEventListener('click', function(e) {
                    if (e.target === this) closeModal();
                });

                document.getElementById('editor').addEventListener('input', function() {
                    const content = this.value;
                    if (content !== lastSavedContent) {
                        updateStatus('unsaved', 'Unsaved changes');
                        if (currentId) {
                            localStorage.setItem('reo_paste_content', content);
                        }
                    }
                    updateCharCount();
                });

                // File upload events
                document.getElementById('fileInput').addEventListener('change', function(e) {
                    if (this.files && this.files[0]) {
                        handleFileUpload(this.files[0]);
                    }
                });

                // Drag and drop
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
                                        document.getElementById('editor').value = data.content;
                                        lastSavedContent = data.content;
                                        saveToStorage(data.content, currentFilename);
                                        updatePasteInfo();
                                        updateStatus('saved', 'Loaded from server');
                                        updateFilenameDisplay();
                                        updateCharCount();
                                    }
                                })
                                .catch(() => {
                                    if (!loadFromStorage()) {
                                        const content = document.getElementById('editor').value;
                                        if (content.trim()) {
                                            createNew();
                                        }
                                    }
                                });
                            return;
                        }
                    }

                    if (!loadFromStorage()) {
                        updatePasteInfo();
                        updateStatus('saved', 'Ready');
                        updateFilenameDisplay();
                        updateCharCount();
                    }
                });

                // Auto-save interval
                setInterval(autoSave, 5000);

                // Save before unload
                window.addEventListener('beforeunload', function() {
                    if (isDirty && currentId) {
                        const content = document.getElementById('editor').value;
                        localStorage.setItem('reo_paste_content', content);
                        navigator.sendBeacon('/update', JSON.stringify({
                            id: currentId,
                            content: content,
                            filename: currentFilename || 'unnamed'
                        }));
                    }
                });

                console.log('📝 Reo Pastebin loaded!');
                console.log('💾 Unlimited text & auto-save');
                console.log('📂 Upload file support');
                console.log('⌨️  Ctrl+S save, Ctrl+Shift+N new, Ctrl+U upload, Ctrl+D download');
            </script>
        </body>
        </html>
    `);
});

// Dashboard - Lihat semua paste
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
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: #f5f5f5;
                    padding: 20px;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                }
                h1 { color: #333; margin-bottom: 20px; }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .btn-home {
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    text-decoration: none;
                }
                .btn-home:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(102,126,234,0.4);
                }
                .stats {
                    color: #666;
                }
                .paste-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                }
                .paste-card {
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    padding: 20px;
                    transition: all 0.3s;
                }
                .paste-card:hover {
                    box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                    transform: translateY(-2px);
                }
                .paste-card .id {
                    font-family: monospace;
                    color: #667eea;
                    font-weight: 600;
                }
                .paste-card .filename {
                    color: #333;
                    font-weight: 600;
                    margin: 10px 0;
                }
                .paste-card .meta {
                    color: #666;
                    font-size: 0.85em;
                }
                .paste-card .size {
                    color: #888;
                    font-size: 0.8em;
                }
                .paste-card .actions {
                    margin-top: 15px;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .paste-card .actions a {
                    padding: 5px 12px;
                    border-radius: 5px;
                    text-decoration: none;
                    font-size: 0.85em;
                    font-weight: 600;
                }
                .action-view { background: #e7f3ff; color: #667eea; }
                .action-raw { background: #f0f0f0; color: #333; }
                .action-edit { background: #d4edda; color: #155724; }
                .action-view:hover, .action-raw:hover, .action-edit:hover {
                    opacity: 0.8;
                }
                .empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #888;
                }
                .empty .icon { font-size: 60px; margin-bottom: 20px; }
                .empty h3 { color: #333; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div>
                        <h1>📊 Dashboard</h1>
                        <div class="stats">${pastes.length} paste${pastes.length !== 1 ? 's' : ''} total</div>
                    </div>
                    <a href="/" class="btn-home">🏠 Back to Editor</a>
                </div>
                
                <div class="paste-grid">
                    ${pastes.length === 0 ? `
                        <div class="empty" style="grid-column: 1/-1;">
                            <div class="icon">📭</div>
                            <h3>No pastes yet</h3>
                            <p>Create your first paste by going to the editor!</p>
                        </div>
                    ` : pastes.map(paste => `
                        <div class="paste-card">
                            <div class="id">#${paste.id}</div>
                            <div class="filename">📄 ${paste.filename || 'unnamed'}</div>
                            <div class="meta">Created: ${new Date(paste.created).toLocaleString()}</div>
                            <div class="meta">Updated: ${new Date(paste.updated).toLocaleString()}</div>
                            <div class="size">Size: ${(paste.size || 0).toLocaleString()} characters</div>
                            <div class="actions">
                                <a href="/${paste.id}" class="action-view">👁️ View</a>
                                <a href="/raw/${paste.id}" class="action-raw">📄 Raw</a>
                                <a href="/?id=${paste.id}" class="action-edit">✏️ Edit</a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </body>
        </html>
    `);
});

// API: Create paste
app.post('/create', (req, res) => {
    const { content, filename } = req.body;
    if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, error: 'Content cannot be empty' });
    }
    
    const id = generateId();
    const metadata = savePaste(id, content, filename || 'unnamed');
    
    res.json({ success: true, id: id, metadata: metadata });
});

// API: Get paste
app.get('/get/:id', (req, res) => {
    const id = req.params.id;
    const result = getPaste(id);
    
    if (!result) {
        return res.status(404).json({ success: false, error: 'Paste not found' });
    }
    
    res.json({ success: true, content: result.content, metadata: result.metadata });
});

// API: Update paste
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

// API: Delete paste
app.delete('/delete/:id', (req, res) => {
    const id = req.params.id;
    const deleted = deletePaste(id);
    
    if (!deleted) {
        return res.status(404).json({ success: false, error: 'Paste not found' });
    }
    
    res.json({ success: true });
});

// View paste
app.get('/:id', (req, res) => {
    const id = req.params.id;
    const result = getPaste(id);
    
    if (!result) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Not Found - Reo Pastebin</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h2>❌ Paste Not Found</h2>
                <p>The paste you're looking for doesn't exist or has been deleted.</p>
                <a href="/" style="color: #667eea;">← Back to Home</a>
            </body>
            </html>
        `);
    }
    
    // Redirect ke editor
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta http-equiv="refresh" content="0;url=/?id=${id}">
            <title>Redirecting to ${id}</title>
        </head>
        <body>
            <p>Redirecting to paste editor...</p>
            <a href="/?id=${id}">Click here if not redirected</a>
        </body>
        </html>
    `);
});

// RAW paste
app.get('/raw/:id', (req, res) => {
    const id = req.params.id;
    const result = getPaste(id);
    
    if (!result) {
        return res.status(404).send('Paste not found');
    }
    
    // Set header untuk download
    const filename = result.metadata?.filename || `paste-${id}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(result.content);
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Reo Pastebin running on port ${PORT}`);
    console.log(`📝 Visit: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`💾 Data stored in: ${DATA_DIR}`);
    console.log(`📂 Upload folder: ${UPLOAD_DIR}`);
    console.log(`✨ Features: Unlimited text, Upload file, Auto-save, Edit, Dashboard`);
});
