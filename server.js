require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();

// MongoDB Connection Setup
const uri = process.env.MONGO_URI || "mongodb+srv://MOUNSIF:Zaki210300@@cluster0.v3i952t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
async function connectDB() {
  try {
    await client.connect();
    db = client.db("fileUploadDB");
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
connectDB();

// Enable CORS
app.use(cors({
  origin: [
    'https://zakariamncf.github.io',
    'https://logisticstraining.vercel.app'
  ],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// Middleware
app.use(express.json());

// File upload setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// API Endpoints
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Store file metadata in MongoDB
    const fileMetadata = {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date(),
      buffer: req.file.buffer, // Storing file buffer directly in MongoDB
      isPublic: true
    };

    const result = await db.collection('files').insertOne(fileMetadata);
    
    res.json({
      success: true,
      filename: req.file.originalname,
      size: req.file.size,
      fileId: result.insertedId
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Get all files
app.get('/api/files', async (req, res) => {
  try {
    const files = await db.collection('files')
      .find({ isPublic: true })
      .project({ buffer: 0 }) // Exclude the binary data from listing
      .sort({ uploadDate: -1 })
      .toArray();
    
    res.json(files);
  } catch (err) {
    console.error("Files list error:", err);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

// Download file
app.get('/api/files/:id', async (req, res) => {
  try {
    const file = await db.collection('files').findOne({ 
      _id: new require('mongodb').ObjectId(req.params.id) 
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.size
    });

    res.send(file.buffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete file
app.delete('/api/files/:id', async (req, res) => {
  try {
    const result = await db.collection('files').deleteOne({ 
      _id: new require('mongodb').ObjectId(req.params.id) 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    dbStatus: client.topology.isConnected() ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
