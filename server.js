require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const path = require('path');

const app = express();

// MongoDB Connection - Using environment variable
const uri = process.env.MONGODB_URI || "mongodb+srv://MOUNSIF:Zaki210300@@cluster0.v3i952t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
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
    db = client.db("fileUploadDB"); // Explicitly specify database name
    console.log("Connected to MongoDB");
    await db.collection('files').createIndex({ uploadDate: -1 });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Don't exit process in serverless environment
  }
}

// Enhanced CORS configuration
const allowedOrigins = [
  'https://zakariamncf.github.io',
  'https://logisticstraining.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Pre-flight requests
app.options('*', cors());

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
    allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'), false;
  }
});

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    if (!db) await connectDB();
    next();
  } catch (err) {
    console.error("Database connection failed:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// API Endpoints with enhanced error handling
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!db) {
      throw new Error('Database not connected');
    }

    const fileDoc = {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date(),
      buffer: req.file.buffer
    };

    const result = await db.collection('files').insertOne(fileDoc);
    
    res.status(201).json({
      success: true,
      filename: fileDoc.filename,
      size: fileDoc.size,
      fileId: result.insertedId,
      uploadDate: fileDoc.uploadDate
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ 
      error: 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.get('/api/files', async (req, res) => {
  try {
    if (!db) {
      throw new Error('Database not connected');
    }

    const files = await db.collection('files')
      .find({})
      .project({ buffer: 0 })
      .sort({ uploadDate: -1 })
      .toArray();
    
    res.json(files);
  } catch (err) {
    console.error("Files error:", err);
    res.status(500).json({ 
      error: 'Failed to get files',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Other endpoints remain the same as your original code...

// Vercel serverless compatibility
if (process.env.VERCEL) {
  // Export for Vercel serverless
  module.exports = app;
} else {
  // Local development
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, async () => {
    await connectDB();
    console.log(`Server running on port ${PORT}`);
  });

  process.on('SIGINT', async () => {
    await client.close();
    process.exit();
  });
}
