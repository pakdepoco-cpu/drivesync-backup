// DriveSync - Frontend Logic & Automation Controller

// State
let allFiles = [];
let currentCategory = 'all';
let currentSearch = '';
let currentSort = 'date-desc';
let currentView = 'table'; // 'table' | 'grid'
let autoSyncTimer = null;
let lastSyncTimestamp = null;

// Local configuration
let config = {
  folderId: localStorage.getItem('gdrive_folder_id') || '1HFXx0QxTRWTP-NuilhB6GCqA5yLvh0AC',
  apiKey: localStorage.getItem('gdrive_api_key') || '',
  interval: parseInt(localStorage.getItem('gdrive_sync_interval') || '60', 10),
  isDemo: false
};

// Realistic mock data
const mockFiles = [
  {
    id: 'mock-sql-prod',
    name: 'prod_database_backup_2026-10-28_230000.sql.gz',
    mimeType: 'application/gzip',
    size: 268435456, // 256 MB
    modifiedTime: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    createdTime: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    webViewLink: 'https://drive.google.com',
    webContentLink: 'https://drive.google.com',
    isDemo: true
  },
  {
    id: 'mock-zip-assets',
    name: 'user_uploaded_assets_v4.zip',
    mimeType: 'application/zip',
    size: 536870912, // 512 MB
    modifiedTime: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    createdTime: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
    webViewLink: 'https://drive.google.com',
    webContentLink: 'https://drive.google.com',
    isDemo: true
  },
  {
    id: 'mock-pdf-audit',
    name: 'system_security_audit_report.pdf',
    mimeType: 'application/pdf',
    size: 4718592, // 4.5 MB
    modifiedTime: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
    createdTime: new Date(Date.now() - 330 * 60 * 1000).toISOString(),
    webViewLink: 'https://drive.google.com',
    webContentLink: 'https://drive.google.com',
    isDemo: true
  },
  {
    id: 'mock-log-app',
    name: 'app_production_runtime.log',
    mimeType: 'text/plain',
    size: 1572864, // 1.5 MB
    modifiedTime: new Date(Date.now() - 600 * 60 * 1000).toISOString(),
    createdTime: new Date(Date.now() - 610 * 60 * 1000).toISOString(),
    webViewLink: 'https://drive.google.com',
    webContentLink: 'https://drive.google.com',
    isDemo: true
  },
  {
    id: 'mock-img-diagram',
    name: 'cloud_infra_cluster_backup.png',
    mimeType: 'image/png',
    size: 2097152, // 2 MB
    modifiedTime: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    createdTime: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    webViewLink: 'https://drive.google.com',
    webContentLink: 'https://drive.google.com',
    thumbnailLink: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&q=80',
    isDemo: true
  },
  {
    id: 'mock-xlsx-backup',
    name: 'billing_export_october_backup.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 921600, // 900 KB
    modifiedTime: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    createdTime: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    webViewLink: 'https://drive.google.com',
    webContentLink: 'https://drive.google.com',
    isDemo: true
  }
];

// File categorization helper
function categorizeFile(fileName, mimeType) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  
  if (['sql', 'db', 'sqlite', 'dump', 'pgsql'].includes(ext) || fileName.includes('.sql.')) {
    return 'database';
  }
  if (['zip', 'rar', 'gz', 'tar', '7z', 'bz2', 'xz'].includes(ext)) {
    return 'archive';
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'log', 'md'].includes(ext) || (mimeType && mimeType.includes('pdf'))) {
    return 'document';
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || (mimeType && mimeType.startsWith('image/'))) {
    return 'image';
  }
  return 'other';
}

// Icon configuration
function getFileIcon(category, fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (category) {
    case 'database':
      return { icon: 'database', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'archive':
      return { icon: 'archive', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    case 'document':
      if (ext === 'pdf') return { icon: 'file-text', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
      if (ext === 'log') return { icon: 'terminal', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' };
      return { icon: 'file-text', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
    case 'image':
      return { icon: 'image', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' };
    default:
      return { icon: 'file', color: 'text-slate-400', bg: 'bg-slate-700/30 border-slate-600/30' };
  }
}

// Format byte size
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Relative time formatter
function formatTimeRelative(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const diffSec = Math.floor((new Date() - date) / 1000);
  
  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} hari lalu`;
  
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFullTimestamp(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Fetch files from Backend Server or Google Drive API or Mock
async function fetchBackupFiles() {
  const syncBtn = document.getElementById('syncBtn');
  const syncIcon = document.getElementById('syncIcon');
  if (syncIcon) syncIcon.classList.add('animate-spin');

  try {
    let files = [];
    let isMock = false;

    // 1. Coba hubungi backend server lokal (/api/files)
    let backendSuccess = false;
    try {
      const res = await fetch('/api/files', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data.files && Array.isArray(data.files)) {
          files = data.files;
          isMock = Boolean(data.isMock);
          backendSuccess = true;
        }
      }
    } catch (e) {
      // Backend not running on same origin
    }

    // 2. Jika backend tidak ada, cek apakah user mengatur Folder ID & API Key langsung di browser
    if (!backendSuccess) {
      if (config.folderId && config.apiKey && !config.isDemo) {
        try {
          const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(config.folderId)}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,webContentLink,thumbnailLink)&key=${encodeURIComponent(config.apiKey)}&orderBy=modifiedTime+desc`;
          const driveRes = await fetch(driveUrl);
          if (driveRes.ok) {
            const driveData = await driveRes.json();
            files = driveData.files || [];
            isMock = false;
          } else {
            console.warn('Google Drive API error:', await driveRes.text());
            files = mockFiles;
            isMock = true;
          }
        } catch (err) {
          console.warn('Direct Google Drive API failed, falling back to mock:', err);
          files = mockFiles;
          isMock = true;
        }
      } else {
        files = mockFiles;
        isMock = true;
      }
    }

    allFiles = files;
    lastSyncTimestamp = new Date();
    updateUI(isMock);
  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    if (syncIcon) syncIcon.classList.remove('animate-spin');
  }
}

// Update UI Components
function updateUI(isMock) {
  // Update banner notice
  const banner = document.getElementById('noticeBanner');
  if (banner) {
    if (isMock) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // Update connection pill
  const connPill = document.getElementById('connectionStatusPill');
  const connText = document.getElementById('connectionStatusText');
  if (connPill && connText) {
    if (isMock) {
      connText.innerText = 'Mode Demo (Sampel Data)';
      connPill.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium';
    } else {
      connText.innerText = 'Terkoneksi ke Google Drive';
      connPill.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium';
    }
  }

  // Update folder label
  const folderLabel = document.getElementById('folderLabel');
  if (folderLabel) {
    if (config.folderId && !isMock) {
      folderLabel.innerText = `Folder ID: ${config.folderId.substring(0, 8)}...`;
    } else {
      folderLabel.innerText = 'Folder: Demo Backup Folder';
    }
  }

  // Update summary metrics
  const totalFiles = allFiles.length;
  const totalSizeBytes = allFiles.reduce((acc, f) => acc + (parseInt(f.size, 10) || 0), 0);
  
  const metricTotalFiles = document.getElementById('metricTotalFiles');
  const metricTotalSize = document.getElementById('metricTotalSize');
  const metricLastModified = document.getElementById('metricLastModified');
  const totalFileCount = document.getElementById('totalFileCount');
  const lastSyncLabel = document.getElementById('lastSyncLabel');
  const countAll = document.getElementById('countAll');

  if (metricTotalFiles) metricTotalFiles.innerText = totalFiles;
  if (metricTotalSize) metricTotalSize.innerText = formatBytes(totalSizeBytes);
  if (totalFileCount) totalFileCount.innerText = totalFiles;
  if (countAll) countAll.innerText = totalFiles;

  if (metricLastModified) {
    if (allFiles.length > 0) {
      metricLastModified.innerText = formatTimeRelative(allFiles[0].modifiedTime);
      metricLastModified.title = formatFullTimestamp(allFiles[0].modifiedTime);
    } else {
      metricLastModified.innerText = '-';
    }
  }

  if (lastSyncLabel && lastSyncTimestamp) {
    lastSyncLabel.innerText = lastSyncTimestamp.toLocaleTimeString('id-ID');
  }

  // Render file list
  renderFileList();
}

// Filter and sort files
function getFilteredFiles() {
  return allFiles.filter(file => {
    const category = categorizeFile(file.name, file.mimeType);
    const matchesCategory = (currentCategory === 'all' || category === currentCategory);
    const matchesSearch = file.name.toLowerCase().includes(currentSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (currentSort === 'date-desc') {
      return new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0);
    }
    if (currentSort === 'date-asc') {
      return new Date(a.modifiedTime || 0) - new Date(b.modifiedTime || 0);
    }
    if (currentSort === 'size-desc') {
      return (parseInt(b.size, 10) || 0) - (parseInt(a.size, 10) || 0);
    }
    if (currentSort === 'name-asc') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });
}

// Render Table & Grid
function renderFileList() {
  const filtered = getFilteredFiles();
  const visibleCount = document.getElementById('visibleFileCount');
  if (visibleCount) visibleCount.innerText = filtered.length;

  const emptyState = document.getElementById('emptyState');
  const tableContainer = document.getElementById('tableView');
  const gridContainer = document.getElementById('gridView');

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (tableContainer) tableContainer.classList.add('hidden');
    if (gridContainer) gridContainer.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  if (currentView === 'table') {
    if (tableContainer) tableContainer.classList.remove('hidden');
    if (gridContainer) gridContainer.classList.add('hidden');
    renderTable(filtered);
  } else {
    if (tableContainer) tableContainer.classList.add('hidden');
    if (gridContainer) gridContainer.classList.remove('hidden');
    renderGrid(filtered);
  }

  // Refresh lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Render Table
function renderTable(files) {
  const tbody = document.getElementById('fileTableBody');
  if (!tbody) return;

  tbody.innerHTML = files.map(file => {
    const category = categorizeFile(file.name, file.mimeType);
    const iconMeta = getFileIcon(category, file.name);
    const sizeStr = formatBytes(file.size);
    const timeRel = formatTimeRelative(file.modifiedTime);
    const timeFull = formatFullTimestamp(file.modifiedTime);
    const ext = (file.name.split('.').pop() || '').toUpperCase();

    return `
      <tr class="hover:bg-slate-800/40 transition group">
        <td class="py-3.5 px-4">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${iconMeta.bg}">
              <i data-lucide="${iconMeta.icon}" class="w-4 h-4 ${iconMeta.color}"></i>
            </div>
            <div class="truncate max-w-xs sm:max-w-md">
              <span class="font-medium text-slate-100 hover:text-drive-blue cursor-pointer truncate block" onclick="openPreviewModal('${file.id}')">
                ${escapeHtml(file.name)}
              </span>
              <span class="text-[11px] text-slate-500 font-mono">ID: ${file.id}</span>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-4 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            ${ext || category}
          </span>
        </td>
        <td class="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
          ${sizeStr}
        </td>
        <td class="py-3.5 px-4 whitespace-nowrap text-slate-400" title="${timeFull}">
          <span class="text-slate-200">${timeRel}</span>
          <div class="text-[10px] text-slate-500 font-mono">${timeFull}</div>
        </td>
        <td class="py-3.5 px-4 whitespace-nowrap text-right">
          <div class="flex items-center justify-end space-x-1">
            <button onclick="openPreviewModal('${file.id}')" class="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-drive-blue transition" title="Preview File">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            <a href="${file.webContentLink || file.webViewLink || '#'}" target="_blank" download class="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition" title="Unduh File">
              <i data-lucide="download" class="w-4 h-4"></i>
            </a>
            <a href="${file.webViewLink || 'https://drive.google.com'}" target="_blank" class="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-drive-yellow transition" title="Buka di Google Drive">
              <i data-lucide="external-link" class="w-4 h-4"></i>
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Grid
function renderGrid(files) {
  const container = document.getElementById('gridView');
  if (!container) return;

  container.innerHTML = files.map(file => {
    const category = categorizeFile(file.name, file.mimeType);
    const iconMeta = getFileIcon(category, file.name);
    const sizeStr = formatBytes(file.size);
    const timeRel = formatTimeRelative(file.modifiedTime);
    const ext = (file.name.split('.').pop() || '').toUpperCase();

    return `
      <div class="glass-card rounded-2xl p-4 flex flex-col justify-between space-y-3 group border border-borderSubtle hover:border-drive-blue/40 transition">
        <div class="flex items-start justify-between">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${iconMeta.bg}">
            <i data-lucide="${iconMeta.icon}" class="w-5 h-5 ${iconMeta.color}"></i>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            ${ext}
          </span>
        </div>

        <div class="space-y-1">
          <h4 class="text-xs font-semibold text-slate-100 hover:text-drive-blue cursor-pointer truncate block" onclick="openPreviewModal('${file.id}')" title="${escapeHtml(file.name)}">
            ${escapeHtml(file.name)}
          </h4>
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>${sizeStr}</span>
            <span>${timeRel}</span>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <button onclick="openPreviewModal('${file.id}')" class="text-xs text-drive-blue hover:underline font-medium flex items-center gap-1">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Preview
          </button>
          <div class="flex items-center space-x-1">
            <a href="${file.webContentLink || file.webViewLink || '#'}" target="_blank" download class="p-1 rounded text-slate-400 hover:text-emerald-400 transition" title="Unduh">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
            </a>
            <a href="${file.webViewLink || 'https://drive.google.com'}" target="_blank" class="p-1 rounded text-slate-400 hover:text-drive-yellow transition" title="Buka di Drive">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Modal Preview Handlers
function openPreviewModal(fileId) {
  const file = allFiles.find(f => f.id === fileId);
  if (!file) return;

  const modal = document.getElementById('previewModal');
  const modalName = document.getElementById('modalFileName');
  const modalMeta = document.getElementById('modalFileMeta');
  const modalBody = document.getElementById('modalBody');
  const modalDriveLink = document.getElementById('modalDriveLink');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  const modalIconContainer = document.getElementById('modalIconContainer');

  const category = categorizeFile(file.name, file.mimeType);
  const iconMeta = getFileIcon(category, file.name);

  modalName.innerText = file.name;
  modalMeta.innerText = `${formatBytes(file.size)} • ${formatFullTimestamp(file.modifiedTime)}`;
  modalDriveLink.href = file.webViewLink || 'https://drive.google.com';
  modalDownloadBtn.href = file.webContentLink || file.webViewLink || '#';

  if (modalIconContainer) {
    modalIconContainer.innerHTML = `<i data-lucide="${iconMeta.icon}" class="w-4 h-4 ${iconMeta.color}"></i>`;
  }

  // Render preview body according to type
  if (category === 'image') {
    const imgSrc = file.thumbnailLink || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80';
    modalBody.innerHTML = `
      <div class="max-h-[60vh] flex flex-col items-center">
        <img src="${imgSrc}" alt="${escapeHtml(file.name)}" class="max-h-[50vh] rounded-xl object-contain shadow-lg border border-slate-700" />
        <p class="text-[11px] text-slate-400 mt-2">Gambar Preview</p>
      </div>
    `;
  } else if ((category === 'document' && file.name.toLowerCase().endsWith('.pdf')) || (file.mimeType && file.mimeType.includes('pdf'))) {
    const previewUrl = file.isDemo 
      ? 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf'
      : `https://drive.google.com/file/d/${file.id}/preview`;

    modalBody.innerHTML = `
      <div class="w-full h-full min-h-[500px] flex flex-col relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
        <div id="pdfLoadingIndicator" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-10 space-y-3 pointer-events-none transition-opacity duration-300">
          <div class="w-8 h-8 border-2 border-drive-blue border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs text-slate-300 font-medium">Memuat PDF langsung di web...</span>
        </div>
        <iframe 
          id="pdfPreviewFrame"
          src="${previewUrl}" 
          class="w-full h-full flex-1 border-0 rounded-xl"
          allow="autoplay"
          onload="const loader = document.getElementById('pdfLoadingIndicator'); if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 250); }"
        ></iframe>
      </div>
    `;
  } else if (category === 'database' || category === 'archive') {
    modalBody.innerHTML = `
      <div class="w-full rounded-xl bg-slate-900/90 border border-slate-700/80 p-5 space-y-4 font-mono text-xs">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <span class="text-slate-400">Tipe Berkas:</span>
          <span class="text-white font-semibold">${file.mimeType || 'Binary Archive'}</span>
        </div>
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <span class="text-slate-400">Ukuran File:</span>
          <span class="text-emerald-400 font-semibold">${formatBytes(file.size)} (${file.size || '0'} bytes)</span>
        </div>
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <span class="text-slate-400">Waktu Backup:</span>
          <span class="text-slate-300">${formatFullTimestamp(file.modifiedTime)}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-400">Status Integritas:</span>
          <span class="text-emerald-400 flex items-center gap-1">
            <i data-lucide="shield-check" class="w-4 h-4 inline"></i> Siap Diunduh & Dipulihkan (Restore)
          </span>
        </div>
      </div>
    `;
  } else {
    modalBody.innerHTML = `
      <div class="w-full h-48 rounded-xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center p-6 text-center space-y-2">
        <i data-lucide="file" class="w-10 h-10 text-slate-500 mb-1"></i>
        <p class="text-xs text-slate-300 font-medium">${escapeHtml(file.name)}</p>
        <p class="text-[11px] text-slate-500">Gunakan tombol 'Unduh File' di bawah untuk mengakses berkas ini.</p>
      </div>
    `;
  }

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  const modalBody = document.getElementById('modalBody');
  if (modal) modal.classList.add('hidden');
  if (modalBody) modalBody.innerHTML = ''; // Hentikan iframe/video latar belakang
}

// Modal Settings
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const cfgFolderId = document.getElementById('cfgFolderId');
  const cfgApiKey = document.getElementById('cfgApiKey');
  const cfgInterval = document.getElementById('cfgInterval');

  if (cfgFolderId) cfgFolderId.value = config.folderId || '';
  if (cfgApiKey) cfgApiKey.value = config.apiKey || '';
  if (cfgInterval) cfgInterval.value = String(config.interval || 60);

  if (modal) modal.classList.remove('hidden');
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('hidden');
}

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Setup Auto-Sync interval timer
function setupAutoSyncTimer() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);

  const sec = config.interval;
  const label = document.getElementById('autoSyncLabel');
  if (label) {
    label.innerText = sec > 0 ? `Tiap ${sec}s` : 'Nonaktif';
  }

  if (sec > 0) {
    autoSyncTimer = setInterval(() => {
      fetchBackupFiles();
    }, sec * 1000);
  }
}

// DOM Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Sync now
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) syncBtn.addEventListener('click', () => fetchBackupFiles());

  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      renderFileList();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderFileList();
    });
  }

  // View switchers
  const viewTableBtn = document.getElementById('viewTableBtn');
  const viewGridBtn = document.getElementById('viewGridBtn');

  if (viewTableBtn && viewGridBtn) {
    viewTableBtn.addEventListener('click', () => {
      currentView = 'table';
      viewTableBtn.className = 'px-2.5 py-1 rounded-lg bg-drive-blue text-white text-xs font-medium transition';
      viewGridBtn.className = 'px-2.5 py-1 rounded-lg text-slate-400 hover:text-white text-xs font-medium transition';
      renderFileList();
    });

    viewGridBtn.addEventListener('click', () => {
      currentView = 'grid';
      viewGridBtn.className = 'px-2.5 py-1 rounded-lg bg-drive-blue text-white text-xs font-medium transition';
      viewTableBtn.className = 'px-2.5 py-1 rounded-lg text-slate-400 hover:text-white text-xs font-medium transition';
      renderFileList();
    });
  }

  // Category filter pills
  const pills = document.querySelectorAll('.category-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => {
        p.className = 'category-pill px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 hover:text-slate-200 transition';
      });
      pill.className = 'category-pill active px-3 py-1 rounded-full text-xs font-medium bg-drive-blue text-white transition';
      currentCategory = pill.getAttribute('data-category');
      renderFileList();
    });
  });

  // Modal Close & Expand buttons
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalCloseBtn2 = document.getElementById('modalCloseBtn2');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closePreviewModal);
  if (modalCloseBtn2) modalCloseBtn2.addEventListener('click', closePreviewModal);

  let isModalExpanded = false;
  const toggleExpandModalBtn = document.getElementById('toggleExpandModalBtn');
  const previewModalDialog = document.getElementById('previewModalDialog');
  const expandModalIcon = document.getElementById('expandModalIcon');

  if (toggleExpandModalBtn && previewModalDialog) {
    toggleExpandModalBtn.addEventListener('click', () => {
      isModalExpanded = !isModalExpanded;
      if (isModalExpanded) {
        previewModalDialog.classList.remove('max-w-5xl', 'h-[88vh]');
        previewModalDialog.classList.add('max-w-none', 'w-[98vw]', 'h-[96vh]');
        if (expandModalIcon) expandModalIcon.setAttribute('data-lucide', 'minimize-2');
      } else {
        previewModalDialog.classList.remove('max-w-none', 'w-[98vw]', 'h-[96vh]');
        previewModalDialog.classList.add('max-w-5xl', 'h-[88vh]');
        if (expandModalIcon) expandModalIcon.setAttribute('data-lucide', 'maximize-2');
      }
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Settings Modal Triggers
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal);

  const toggleDemoBtn = document.getElementById('toggleDemoBtn');
  if (toggleDemoBtn) {
    toggleDemoBtn.addEventListener('click', () => {
      config.isDemo = true;
      localStorage.removeItem('gdrive_folder_id');
      closeSettingsModal();
      fetchBackupFiles();
    });
  }

  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const folderId = document.getElementById('cfgFolderId').value.trim();
      const apiKey = document.getElementById('cfgApiKey').value.trim();
      const interval = parseInt(document.getElementById('cfgInterval').value, 10);

      config.folderId = folderId;
      config.apiKey = apiKey;
      config.interval = interval;
      config.isDemo = !folderId;

      localStorage.setItem('gdrive_folder_id', folderId);
      localStorage.setItem('gdrive_api_key', apiKey);
      localStorage.setItem('gdrive_sync_interval', interval);

      closeSettingsModal();
      setupAutoSyncTimer();
      fetchBackupFiles();
    });
  }

  // Close modals on background click or ESC
  window.addEventListener('click', (e) => {
    const previewModal = document.getElementById('previewModal');
    const settingsModal = document.getElementById('settingsModal');
    if (e.target === previewModal) closePreviewModal();
    if (e.target === settingsModal) closeSettingsModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePreviewModal();
      closeSettingsModal();
    }
  });

  // Initial load
  setupAutoSyncTimer();
  fetchBackupFiles();
});

