const { getDriveClient } = require('./_drive');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const fileId = req.query.id;
  if (!fileId) return res.status(400).send('Missing file id');

  const drive = getDriveClient();
  if (!drive) return res.redirect(`https://drive.google.com/file/d/${fileId}/preview`);

  try {
    const fileRes = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    fileRes.data.pipe(res);
  } catch (err) {
    res.redirect(`https://drive.google.com/file/d/${fileId}/preview`);
  }
};

