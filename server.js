require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware CORS
app.use(cors({
  origin: ['https://zakariamncf.github.io', 'https://logisticstraining.vercel.app'],
  methods: ['GET', 'POST', 'DELETE']
}));

// Configuration Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Routes API
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier uploadé' });
  res.json({ 
    success: true,
    filename: req.file.filename,
    url: `/api/uploads/${req.file.filename}`
  });
});

app.get('/api/files', (req, res) => {
  fs.readdir('./uploads', (err, files) => {
    if (err) return res.status(500).json({ error: 'Erreur de lecture' });
    res.json({ files: files.map(f => ({ name: f, url: `/api/uploads/${f}`)) });
  });
});

app.delete('/api/delete/:filename', (req, res) => {
  fs.unlink(`./uploads/${req.params.filename}`, (err) => {
    if (err) return res.status(500).json({ error: 'Erreur de suppression' });
    res.json({ success: true });
  });
});

// Servir les fichiers statiques
app.use('/api/uploads', express.static('uploads'));

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', server: 'actif' });
});

// Démarrer le serveur
app.listen(port, () => console.log(`Serveur démarré sur le port ${port}`));
