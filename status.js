const { getDriveClient, FOLDER_ID } = require('./_drive');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const drive = getDriveClient();
  res.status(200).json({
    connected: Boolean(drive && FOLDER_ID),
    hasCredentials: Boolean(drive),
    folderIdConfigured: Boolean(FOLDER_ID),
    folderId: FOLDER_ID ? `${FOLDER_ID.substring(0, 5)}...` : null
  });
};

