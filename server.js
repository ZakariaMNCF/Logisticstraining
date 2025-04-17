require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const bucket = admin.storage().bucket();
const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://zakariamncf.github.io',
    'https://logisticstraining.vercel.app',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Disposition']
}));

// Middleware
app.use(express.json());

// File upload handler
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = uniqueSuffix + path.extname(req.file.originalname);
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype
      }
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

    res.json({
      success: true,
      filename: req.file.originalname,
      url: publicUrl
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List files endpoint
app.get('/api/files', async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    const fileList = await Promise.all(files.map(async file => {
      const [metadata] = await file.getMetadata();
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
      });

      return {
        name: metadata.name,
        url: url,
        size: parseInt(metadata.size),
        uploaded: metadata.timeCreated
      };
    }));

    res.json({ files: fileList });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to load files' });
  }
});

// Delete file endpoint
app.delete('/api/delete/:filename', async (req, res) => {
  try {
    const file = bucket.file(req.params.filename);
    await file.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', storage: 'Firebase' });
});

module.exports = app;
