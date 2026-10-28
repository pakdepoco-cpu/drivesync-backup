const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

let googleapis;
try {
  googleapis = require('googleapis').google;
} catch (e) {
  googleapis = null;
}

const app = express();
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1HFXx0QxTRWTP-NuilhB6GCqA5yLvh0AC';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'service_account.json');

app.use(cors());
app.use(express.json());

// Explicit routes for root and frontend files on Vercel
app.get('/', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, '..', 'index.html'),
    path.join(process.cwd(), 'index.html'),
    path.join(__dirname, 'index.html')
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
    path.join(__dirname, '..', 'app.js'),
    path.join(process.cwd(), 'app.js'),
    path.join(__dirname, 'app.js')
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
    path.join(__dirname, '..', 'style.css'),
    path.join(process.cwd(), 'style.css'),
    path.join(__dirname, 'style.css')
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

// Initialize Google Drive Client
function getDriveClient() {
  if (!googleapis) return null;

  try {
    let credentials = null;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      } catch (e) {
        try {
          credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'));
        } catch (err) {
          console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
        }
      }
    }

    // Fix escaped newlines in private_key (common issue in Vercel environment variables)
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

// Realistic mock data fallback
function getMockFiles() {
  const now = new Date();
  return [
    {
      id: 'mock-1',
      name: 'database-backup-production-2026-10-28.sql.gz',
      mimeType: 'application/gzip',
      size: '241591910',
      createdTime: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      modifiedTime: new Date(now.getTime() - 1000 * 60 * 40).toISOString(),
      webViewLink: 'https://drive.google.com',
      webContentLink: 'https://drive.google.com',
      isDemo: true
    },
    {
      id: 'mock-2',
      name: 'system-audit-log-october.pdf',
      mimeType: 'application/pdf',
      size: '4259840',
      createdTime: new Date(now.getTime() - 1000 * 60 * 180).toISOString(),
      modifiedTime: new Date(now.getTime() - 1000 * 60 * 175).toISOString(),
      webViewLink: 'https://drive.google.com',
      webContentLink: 'https://drive.google.com',
      isDemo: true
    }
  ];
}

// Fetch files from Google Drive
async function fetchFolderFiles() {
  const drive = getDriveClient();
  const folderId = FOLDER_ID;

  if (!drive || !folderId) {
    return {
      files: getMockFiles(),
      isMock: true,
      message: 'Service Account atau Folder ID belum terhubung di Environment Variables'
    };
  }

  try {
    const query = `'${folderId}' in parents and trashed = false`;
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, thumbnailLink, iconLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 100
    });

    return {
      files: response.data.files || [],
      isMock: false,
      folderId: folderId
    };
  } catch (error) {
    console.error('Error fetching Google Drive files:', error.message);
    return {
      files: getMockFiles(),
      isMock: true,
      error: error.message
    };
  }
}

// API Endpoints
app.get('/api/status', (req, res) => {
  const drive = getDriveClient();
  res.json({
    connected: Boolean(drive && FOLDER_ID),
    hasCredentials: Boolean(drive),
    folderIdConfigured: Boolean(FOLDER_ID),
    folderId: FOLDER_ID ? `${FOLDER_ID.substring(0, 5)}...` : null,
    environment: process.env.VERCEL ? 'Vercel Serverless' : 'Local Node Server'
  });
});

app.get('/api/files', async (req, res) => {
  try {
    const result = await fetchFolderFiles();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, files: getMockFiles(), isMock: true });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    const result = await fetchFolderFiles();
    res.json({
      success: true,
      count: result.files.length,
      isMock: result.isMock,
      data: result.files
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// Export handler for Vercel
module.exports = app;

