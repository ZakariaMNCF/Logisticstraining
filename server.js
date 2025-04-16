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
        'https://zakariamncf.github.io/Logisticstraining/SAP-Customer.html', // Your GitHub Pages
        'https://logisticstraining-mxoz.vercel.app/', // Your Vercel frontend
        'http://localhost:3000', // Local development
        'http://localhost:5500' // Common local server port
    ],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Headers'
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Enhanced preflight request handling
app.options('*', cors());

// Middleware to parse JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware with more details
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
        headers: req.headers,
        query: req.query,
        body: req.body
    });
    next();
});

// File filter configuration (keep your existing one)
const fileFilter = (req, file, cb) => {
    // ... (your existing fileFilter implementation)
};

// Storage configuration with error handling
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = `/tmp/uploads/${req.params.category}/${req.params.subcategory}`;
        fs.mkdir(dir, { recursive: true }, (err) => {
            if (err) {
                console.error(`Directory creation error: ${err}`);
                return cb(err);
            }
            console.log(`Created directory: ${dir}`);
            cb(null, dir);
        });
    },
    filename: (req, file, cb) => {
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${sanitized}`);
    }
});

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024, // Increased to 25MB
        files: 1
    }
});

// Serve static files with CORS headers
app.use('/uploads', express.static('/tmp/uploads', {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Expose-Headers', 'Content-Disposition');
    }
}));

// Enhanced upload endpoint
app.post('/upload/:category/:subcategory', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded or invalid file type',
                details: req.fileValidationError || 'Unknown error'
            });
        }

        // Construct the public URL
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.params.category}/${req.params.subcategory}/${req.file.filename}`;

        res.status(201).json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                originalName: req.file.originalname,
                storedName: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                url: fileUrl,
                path: `/uploads/${req.params.category}/${req.params.subcategory}/${req.file.filename}`
            }
        });
    } catch (error) {
        console.error('Upload processing error:', error);
        res.status(500).json({
            success: false,
            error: 'File processing failed',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// ... (keep your existing /files, /delete, /health, and other endpoints)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', {
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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Allowed CORS origins:', [
        'https://zakariamncf.github.io/Logisticstraining/SAP-Customer.html',
        'https://logisticstraining-mxoz.vercel.app/',
        'http://localhost:3000',
        'http://localhost:5500'
    ]);
});
