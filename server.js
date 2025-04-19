require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require('path');
const morgan = require('morgan');

const app = express();

// MongoDB Connection Setup
const uri = process.env.MONGO_URI || "mongodb+srv://MOUNSIF:Zaki210300@cluster0.v3i952t.mongodb.net/fileUploadDB?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let dbClient;

// Connect to MongoDB
async function connectDB() {
  try {
    console.log('Connecting to MongoDB...');
    dbClient = await client.connect();
    db = dbClient.db();
    console.log("Connected to MongoDB successfully");
    
    // Verify connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    // Create indexes if they don't exist
    await db.collection('files').createIndex({ uploadDate: -1 });
    console.log("Database indexes created");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

// Middleware
app.use(morgan('dev'));
app.use(express.json());

// Enhanced CORS configuration
const allowedOrigins = [
  'https://zakariamncf.github.io',
  'https://logisticstraining.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
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

// File upload setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG are allowed.'), false);
    }
  }
});

// Database connection middleware
app.use(async (req, res, next) => {
  if (!db) {
    try {
      await connectDB();
    } catch (err) {
      return res.status(503).json({ 
        error: 'Database not available',
        details: err.message
      });
    }
  }
  next();
});

// API Endpoints

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = client.topology.isConnected() ? 'connected' : 'disconnected';
    const collections = await db.listCollections().toArray();
    
    res.json({ 
      status: 'OK',
      environment: process.env.NODE_ENV || 'development',
      dbStatus,
      collections: collections.map(c => c.name)
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'ERROR',
      error: err.message 
    });
  }
});

// Upload file endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded',
      details: 'Please select a file to upload'
    });
  }

  try {
    const fileMetadata = {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date(),
      buffer: req.file.buffer,
      isPublic: true
    };

    const result = await db.collection('files').insertOne(fileMetadata);
    
    res.json({
      success: true,
      filename: fileMetadata.filename,
      size: fileMetadata.size,
      fileId: result.insertedId,
      uploadDate: fileMetadata.uploadDate
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ 
      error: 'Failed to save file',
      details: err.message
    });
  }
});

// Get files list endpoint
app.get('/api/files', async (req, res) => {
  try {
    const files = await db.collection('files')
      .find({ isPublic: true })
      .project({ buffer: 0 }) // Exclude binary data
      .sort({ uploadDate: -1 })
      .toArray();
    
    res.json(files);
  } catch (err) {
    console.error("Files list error:", err);
    res.status(500).json({ 
      error: 'Failed to retrieve files',
      details: err.message
    });
  }
});

// Download file endpoint
app.get('/api/files/:id', async (req, res) => {
  try {
    let fileId;
    try {
      fileId = new require('mongodb').ObjectId(req.params.id);
    } catch (err) {
      return res.status(400).json({ 
        error: 'Invalid file ID format',
        details: 'File ID must be a valid MongoDB ObjectId'
      });
    }

    const file = await db.collection('files').findOne({ _id: fileId });

    if (!file) {
      return res.status(404).json({ 
        error: 'File not found',
        details: 'The requested file does not exist'
      });
    }

    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
      'Content-Length': file.size
    });

    res.send(file.buffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ 
      error: 'Failed to download file',
      details: err.message
    });
  }
});

// Delete file endpoint
app.delete('/api/files/:id', async (req, res) => {
  try {
    let fileId;
    try {
      fileId = new require('mongodb').ObjectId(req.params.id);
    } catch (err) {
      return res.status(400).json({ 
        error: 'Invalid file ID format',
        details: 'File ID must be a valid MongoDB ObjectId'
      });
    }

    const result = await db.collection('files').deleteOne({ _id: fileId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        error: 'File not found',
        details: 'The file you tried to delete does not exist'
      });
    }

    res.json({ 
      success: true,
      message: 'File deleted successfully'
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ 
      error: 'Failed to delete file',
      details: err.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ 
      error: 'File upload error',
      details: err.message
    });
  } else if (err) {
    console.error(err.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  try {
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});
