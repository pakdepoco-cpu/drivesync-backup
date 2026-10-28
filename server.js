const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let googleapis;
try {
  googleapis = require('googleapis').google;
} catch (e) {
  googleapis = null;
}

const app = express();
const PORT = process.env.PORT || 3000;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'service_account.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Explicit routes for Vercel Serverless environment
app.get('/', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, 'index.html'),
    path.join(process.cwd(), 'index.html')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
    return res.type('html').send(html);
  } catch (e) {
    res.status(404).send('index.html not found');
  }
});

app.get('/app.js', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, 'app.js'),
    path.join(process.cwd(), 'app.js')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  try {
    const js = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');
    return res.type('application/javascript').send(js);
  } catch (e) {
    res.status(404).send('app.js not found');
  }
});

app.get('/style.css', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, 'style.css'),
    path.join(process.cwd(), 'style.css')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  try {
    const css = fs.readFileSync(path.join(process.cwd(), 'style.css'), 'utf8');
    return res.type('text/css').send(css);
  } catch (e) {
    res.status(404).send('style.css not found');
  }
});

// Cache state
let lastSyncTime = null;
let cachedFiles = [];
let syncErrors = null;

// Initialize Google Drive Client using Service Account
function getDriveClient() {
  if (!googleapis) return null;

  try {
    let credentials = null;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      } catch (e) {
        credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'));
      }
    }

    if (credentials && credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const authConfig = {
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    };

    if (credentials) {
      authConfig.credentials = credentials;
    } else if (fs.existsSync(CREDENTIALS_PATH)) {
      authConfig.keyFile = CREDENTIALS_PATH;
    } else {
      return null;
    }

    const auth = new googleapis.auth.GoogleAuth(authConfig);
    return googleapis.drive({ version: 'v3', auth });
  } catch (err) {
    console.error('Error initializing Google Auth:', err.message);
    return null;
  }
}

// Generate realistic mock data when running in demo/offline mode
function getMockFiles() {
  const now = new Date();
  return [
    {
      id: 'mock-1',
      name: 'database-backup-production-2026-10-28.sql.gz',
      mimeType: 'application/gzip',
      size: '241591910', // ~230 MB
      createdTime: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      modifiedTime: new Date(now.getTime() - 1000 * 60 * 40).toISOString(),
      webViewLink: 'https://drive.google.com',
      webContentLink: 'https://drive.google.com',
      thumbnailLink: null,
      isDemo: true
    },
    {
      id: 'mock-2',
      name: 'system-audit-log-october.pdf',
      mimeType: 'application/pdf',
      size: '4259840', // ~4.1 MB
      createdTime: new Date(now.getTime() - 1000 * 60 * 180).toISOString(),
      modifiedTime: new Date(now.getTime() - 1000 * 60 * 175).toISOString(),
      webViewLink: 'https://drive.google.com',
      webContentLink: 'https://drive.google.com',
      thumbnailLink: null,
      isDemo: true
    },
    {
      id: 'mock-3',
      name: 'user_uploaded_assets_backup.zip',
      mimeType: 'application/zip',
      size: '524288000', // ~500 MB
      createdTime: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      modifiedTime: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      webViewLink: 'https://drive.google.com',
      webContentLink: 'https://drive.google.com',
      thumbnailLink: null,
      isDemo: true
    },
    {
      id: 'mock-4',
      name: 'server_architecture_diagram.png',
      mimeType: 'image/png',
      size: '1843200', // ~1.75 MB
      createdTime: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      modifiedTime: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      webViewLink: 'https://drive.google.com',
      webContentLink: 'https://drive.google.com',
      thumbnailLink: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80',
      isDemo: true
    },
    {
      id: 'mock-5',
      name: 'finance_summary_q3_report.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: '892416', // ~871 KB
      createdTime: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      modifiedTime: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      webViewLink: 'https://drive.google.com',
      webContentLink: 'https://drive.google.com',
      thumbnailLink: null,
      isDemo: true
    }
  ];
}

// Fetch Google Drive folder files
async function fetchFolderFiles() {
  const drive = getDriveClient();
  if (!drive || !FOLDER_ID) {
    cachedFiles = getMockFiles();
    lastSyncTime = new Date().toISOString();
    return {
      files: cachedFiles,
      isMock: true,
      message: !FOLDER_ID ? 'GOOGLE_DRIVE_FOLDER_ID belum diatur' : 'File credentials Service Account tidak ditemukan'
    };
  }

  try {
    const query = `'${FOLDER_ID}' in parents and trashed = false`;
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, thumbnailLink, iconLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 100
    });

    cachedFiles = response.data.files || [];
    lastSyncTime = new Date().toISOString();
    syncErrors = null;
    return {
      files: cachedFiles,
      isMock: false,
      folderId: FOLDER_ID
    };
  } catch (error) {
    console.error('Error fetching Google Drive files:', error.message);
    syncErrors = error.message;
    return {
      files: cachedFiles.length ? cachedFiles : getMockFiles(),
      isMock: true,
      error: error.message
    };
  }
}

// Routes
app.get('/api/status', (req, res) => {
  const hasCredentials = fs.existsSync(CREDENTIALS_PATH);
  res.json({
    connected: Boolean(hasCredentials && FOLDER_ID),
    hasCredentials,
    folderIdConfigured: Boolean(FOLDER_ID),
    folderId: FOLDER_ID ? `${FOLDER_ID.substring(0, 5)}...${FOLDER_ID.substring(FOLDER_ID.length - 4)}` : null,
    lastSyncTime,
    totalFiles: cachedFiles.length,
    syncErrors
  });
});

app.get('/api/files', async (req, res) => {
  const result = await fetchFolderFiles();
  res.json(result);
});

app.post('/api/sync', async (req, res) => {
  const result = await fetchFolderFiles();
  res.json({
    success: true,
    syncTime: lastSyncTime,
    count: result.files.length,
    isMock: result.isMock,
    data: result.files
  });
});

app.get('/api/pdf', async (req, res) => {
  const fileId = req.query.id;
  if (!fileId) return res.status(400).send('Missing file id');
  const drive = getDriveClient();
  if (!drive) return res.redirect(`https://drive.google.com/file/d/${fileId}/preview`);
  try {
    const fileRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    fileRes.data.pipe(res);
  } catch (err) {
    res.redirect(`https://drive.google.com/file/d/${fileId}/preview`);
  }
});

// Periodic background auto-sync (only on long-running node servers, disabled on Vercel Serverless)
if (!process.env.VERCEL) {
  const syncInterval = parseInt(process.env.SYNC_INTERVAL_SECONDS || '60', 10) * 1000;
  setInterval(() => {
    fetchFolderFiles().catch((err) => console.error('Periodic sync error:', err.message));
  }, Math.max(syncInterval, 15000));

  // Initial fetch on boot
  fetchFolderFiles();
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 DriveSync Backup Webapp aktif di port ${PORT}`);
    console.log(`🌐 Buka di browser: http://localhost:${PORT}`);
    console.log(`📁 Target Google Drive Folder ID: ${FOLDER_ID || '(Belum diset, running in Demo Mode)'}`);
    console.log(`===================================================`);
  });
}

module.exports = app;

