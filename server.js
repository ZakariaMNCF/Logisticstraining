require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'https://zakariamncf.github.io',
    'https://zakariamncf.github.io/Logisticstraining/SAP-Customer.html',// Your GitHub Pages
    'https://logisticstraining-mxoz.vercel.app',// Your Vercel app
    'http://localhost:3000' // Local development
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 204,
  exposedHeaders: ['Content-Disposition']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight for all routes

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    headers: req.headers,
    body: req.body
  });
  next();
});

// File filter configuration
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const allowedExtensions = ['.pdf', '.mp4', '.mov', '.doc', '.docx'];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} are allowed.`), false);
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join('/tmp/uploads', req.params.category || 'general', req.params.subcategory || 'uploads');
    
    fs.mkdir(uploadDir, { recursive: true }, (err) => {
      if (err) {
        console.error('Directory creation error:', err);
        return cb(err);
      }
      cb(null, uploadDir);
    });
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 1
  }
});

// Serve static files with CORS
app.use('/uploads', express.static('/tmp/uploads', {
  setHeaders: (res, filePath) => {
    res.set('Access-Control-Allow-Origin', corsOptions.origin.join(', '));
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Set proper Content-Type based on file extension
    const ext = path.extname(filePath);
    const contentType = {
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }[ext.toLowerCase()];
    
    if (contentType) {
      res.set('Content-Type', contentType);
    }
  }
}));

// Upload endpoint
app.post('/upload/:category?/:subcategory?', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: req.fileValidationError || 'No file uploaded or invalid file type',
        allowedTypes: ['PDF', 'MP4', 'MOV', 'DOC', 'DOCX'],
        maxSize: '25MB'
      });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.path.split('/tmp/uploads/')[1]}`;

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
        downloadUrl: `${fileUrl}?download=true`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'File upload failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// File listing endpoint
app.get('/files/:category?/:subcategory?', async (req, res) => {
  try {
    const dirPath = path.join('/tmp/uploads', req.params.category || 'general', req.params.subcategory || 'uploads');
    
    if (!fs.existsSync(dirPath)) {
      return res.status(200).json({
        success: true,
        files: [],
        count: 0,
        message: 'No files found in this directory'
      });
    }

    const files = await fs.promises.readdir(dirPath);
    const filesWithMeta = await Promise.all(
      files.map(async file => {
        const filePath = path.join(dirPath, file);
        const stats = await fs.promises.stat(filePath);
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime,
          url: `${req.protocol}://${req.get('host')}/uploads/${path.relative('/tmp/uploads', filePath)}`,
          downloadUrl: `${req.protocol}://${req.get('host')}/uploads/${path.relative('/tmp/uploads', filePath)}?download=true`
        };
      })
    );

    res.json({
      success: true,
      files: filesWithMeta,
      count: filesWithMeta.length,
      directory: dirPath
    });
  } catch (error) {
    console.error('File list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve files',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'File Upload Service',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', {
    message: err.message,
    stack: err.stack,
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers
    }
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack
    })
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Allowed CORS origins:', corsOptions.origin);
  console.log('Upload directory:', '/tmp/uploads');
  console.log('Max file size:', '25MB');
});
