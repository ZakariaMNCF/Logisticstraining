require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase if in production
let bucket;
const isVercel = process.env.VERCEL === '1';

if (isVercel) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    bucket = admin.storage().bucket();
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://zakariamncf.github.io',
    'https://logisticstraining.vercel.app',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure storage based on environment
let storage;
if (isVercel && bucket) {
  // Firebase Storage configuration for Vercel
  storage = {
    _handleFile: (req, file, cb) => {
      const buffer = file.buffer;
      cb(null, {
        buffer,
        originalname: file.originalname
      });
    },
    _removeFile: (req, file, cb) => {
      cb(null);
    }
  };
} else {
  // Local filesystem storage for development
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
}

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (isVercel && bucket) {
      // Handle upload to Firebase Storage
      const blob = bucket.file(req.file.originalname);
      const blobStream = blob.createWriteStream();

      blobStream.on('error', err => {
        console.error('Firebase upload error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      });

      blobStream.on('finish', async () => {
        try {
          await blob.makePublic();
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
          
          res.json({ 
            success: true,
            filename: req.file.originalname,
            url: publicUrl
          });
        } catch (err) {
          console.error('Firebase makePublic error:', err);
          res.status(500).json({ error: 'Failed to make file public' });
        }
      });

      blobStream.end(req.file.buffer);
    } else {
      // Local filesystem response
      res.json({ 
        success: true,
        filename: req.file.filename,
        url: `/api/uploads/${req.file.filename}`
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File listing endpoint
app.get('/api/files', async (req, res) => {
  try {
    if (isVercel && bucket) {
      // List files from Firebase Storage
      const [files] = await bucket.getFiles();
      const fileList = await Promise.all(files.map(async file => {
        const [metadata] = await file.getMetadata();
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '03-09-2491' // Far future expiration
        });

        return {
          name: file.name,
          url: url,
          size: parseInt(metadata.size)
        };
      }));

      res.json({ files: fileList });
    } else {
      // List files from local filesystem
      const uploadDir = path.join(__dirname, 'uploads');
      fs.readdir(uploadDir, (err, files) => {
        if (err) {
          console.error('Error reading directory:', err);
          return res.status(500).json({ error: 'Error reading files' });
        }

        const fileList = files.map(file => {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          
          return {
            name: file,
            url: `/api/uploads/${file}`,
            size: stats.size
          };
        });

        res.json({ files: fileList });
      });
    }
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File deletion endpoint
app.delete('/api/delete/:filename', async (req, res) => {
  try {
    if (isVercel && bucket) {
      // Delete from Firebase Storage
      const file = bucket.file(req.params.filename);
      await file.delete();
      res.json({ success: true });
    } else {
      // Delete from local filesystem
      const filePath = path.join(__dirname, 'uploads', req.params.filename);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
          return res.status(500).json({ error: 'Error deleting file' });
        }
        res.json({ success: true });
      });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static files (local development only)
if (!isVercel) {
  app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    environment: isVercel ? 'Vercel' : 'Local',
    storage: isVercel ? 'Firebase' : 'Local filesystem'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
if (!isVercel) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${isVercel ? 'Vercel' : 'Local'}`);
    console.log(`Storage: ${isVercel ? 'Firebase' : 'Local filesystem'}`);
  });
}

// Export for Vercel
module.exports = app;
