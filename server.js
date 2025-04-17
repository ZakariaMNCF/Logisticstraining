require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://zakariamncf.github.io', 
    'https://logisticstraining.vercel.app',
    'http://localhost:3000' // for local testing
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// API Routes
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
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).json({ error: 'Error reading files' });
    }
    
    const fileList = files.map(file => ({
      name: file,
      url: `/api/uploads/${file}`,
      size: fs.statSync(path.join(uploadDir, file)).size
    }));
    
    res.json({ files: fileList });
  });
});

app.delete('/api/delete/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      return res.status(500).json({ error: 'Error deleting file' });
    }
    res.json({ success: true });
  });
});

// Serve static files
app.use('/api/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    server: 'running',
    uploadDir: uploadDir,
    freeSpace: fs.statSync(uploadDir).size
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Upload directory: ${uploadDir}`);
});
