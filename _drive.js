const path = require('path');
const fs = require('fs');

let googleapis;
try {
  googleapis = require('googleapis').google;
} catch (e) {
  googleapis = null;
}

function sanitizeFolderId(rawId) {
  if (!rawId) return '1HFXx0QxTRWTP-NuilhB6GCqA5yLvh0AC';
  let str = String(rawId).trim().replace(/['"]/g, '');
  if (str.includes('/folders/')) {
    str = str.split('/folders/')[1].split('?')[0].split('/')[0];
  }
  return str.trim() || '1HFXx0QxTRWTP-NuilhB6GCqA5yLvh0AC';
}

const FOLDER_ID = sanitizeFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'service_account.json');

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
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
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

module.exports = {
  getDriveClient,
  fetchFolderFiles,
  FOLDER_ID,
  getMockFiles
};

