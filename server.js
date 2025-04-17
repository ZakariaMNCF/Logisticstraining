require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Configuration CORS
app.use(cors({
  origin: ['https://zakariamncf.github.io', 'https://logisticstraining-mxoz.vercel.app'],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// Middleware
app.use(express.json());

// Configuration du stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = '/tmp/uploads';
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// Endpoint pour uploader un fichier
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

// Endpoint pour lister les fichiers
app.get('/api/files', (req, res) => {
  fs.readdir('/tmp/uploads', (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to scan files' });
    }
    res.json({
      files: files.map(file => ({
        name: file,
        url: `/api/uploads/${file}`
      }))
    });
  });
});

// Endpoint pour supprimer un fichier
app.delete('/api/delete/:filename', (req, res) => {
  const filePath = path.join('/tmp/uploads', req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete file' });
    }
    res.json({ success: true });
  });
});

// Servir les fichiers uploadés
app.use('/api/uploads', express.static('/tmp/uploads'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
