const { fetchFolderFiles } = require('./_drive');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const result = await fetchFolderFiles();
    res.status(200).json({
      success: true,
      count: result.files.length,
      isMock: result.isMock,
      data: result.files
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

