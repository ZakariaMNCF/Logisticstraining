require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://zakariamncf.github.io',
    'https://logisticstraining.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true
}));

// MongoDB Connection
const uri = process.env.MONGODB_URI || "mongodb+srv://MOUNSIF:Zaki210300@@cluster0.v3i952t.mongodb.net/fileUploadDB?retryWrites=true&w=majority";
const client = new MongoClient(uri);

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("fileUploadDB");
    console.log("MongoDB connected");
    return true;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    return false;
  }
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads/sap/customer_contact'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// API Endpoints
app.get('/api/health', async (req, res) => {
  const dbStatus = await connectDB() ? 'connected' : 'disconnected';
  res.json({ status: 'OK', db: dbStatus });
});

app.get('/api/files', async (req, res) => {
  try {
    if (!await connectDB()) throw new Error('Database connection failed');
    const files = await db.collection('files').find().toArray();
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database operation failed" });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!await connectDB()) throw new Error('Database connection failed');

    const fileDoc = {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadDate: new Date()
    };

    await db.collection('files').insertOne(fileDoc);
    res.json({ success: true, file: fileDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Static files
app.use(express.static(path.join(__dirname)));

// Vercel handler
module.exports = app;

// Local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
