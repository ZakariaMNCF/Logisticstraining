require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS - Add your exact frontend URLs
app.use(cors({
  origin: [
    'https://zakariamncf.github.io',
    'https://logisticstraining.vercel.app',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp'); // Vercel only allows /tmp for writes
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// API Endpoints
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({ 
    success: true,
    filename: req.file.filename,
    url: `/api/uploads/${req.file.filename}`
  });
});

app.get('/api/files', (req, res) => {
  const fs = require('fs');
  const directoryPath = '/tmp';
  
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to scan files' });
    }
    
    const fileList = files.map(file => ({
      name: file,
      url: `/api/uploads/${file}`,
      size: fs.statSync(path.join(directoryPath, file)).size
    }));
    
    res.json({ files: fileList });
  });
});

app.delete('/api/delete/:filename', (req, res) => {
  const fs = require('fs');
  const filePath = path.join('/tmp', req.params.filename);
  
  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete file' });
    }
    res.json({ success: true });
  });
});

// Static files - Only for Vercel
app.use('/api/uploads', express.static('/tmp'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Start server - Only for local testing
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
