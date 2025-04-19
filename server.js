require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const path = require('path');

const app = express();

// MongoDB Connection
const uri = "mongodb+srv://MOUNSIF:Zaki210300@cluster0.v3i952t.mongodb.net/fileUploadDB?retryWrites=true&w=majority&appName=Cluster0";
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
    db = client.db();
    console.log("Connected to MongoDB");
    
    // Create index for faster queries
    await db.collection('files').createIndex({ uploadDate: -1 });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

// Middleware
app.use(cors({
  origin: ['https://zakariamncf.github.io', 'https://logisticstraining.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// File upload setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'), false);
  }
});

// Ensure DB connection before handling requests
app.use(async (req, res, next) => {
  if (!db) await connectDB();
  next();
});

// API Endpoints
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileDoc = {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date(),
      buffer: req.file.buffer
    };

    const result = await db.collection('files').insertOne(fileDoc);
    
    res.json({
      success: true,
      filename: fileDoc.filename,
      size: fileDoc.size,
      fileId: result.insertedId,
      uploadDate: fileDoc.uploadDate
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

app.get('/api/files', async (req, res) => {
  try {
    const files = await db.collection('files')
      .find({})
      .project({ buffer: 0 })
      .sort({ uploadDate: -1 })
      .toArray();
    
    res.json(files);
  } catch (err) {
    console.error("Files error:", err);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

app.get('/api/files/:id', async (req, res) => {
  try {
    const file = await db.collection('files').findOne({ 
      _id: new ObjectId(req.params.id) 
    });

    if (!file) return res.status(404).json({ error: 'File not found' });

    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.size
    });

    res.send(file.buffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.delete('/api/files/:id', async (req, res) => {
  try {
    const result = await db.collection('files').deleteOne({ 
      _id: new ObjectId(req.params.id) 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await client.close();
  process.exit();
});
