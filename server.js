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
        'https://logisticstraining-mxoz.vercel.app', // Your Vercel frontend
        'http://localhost:3000' // For local development
    ],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

// File filter for uploads
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'video/mp4', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF and MP4/MOV files are allowed.'), false);
    }
};

// Set up file storage with limits (10MB max)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = `/tmp/uploads/${req.params.category}/${req.params.subcategory}`;
        try {
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        // Sanitize filename and add timestamp
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}_${sanitized}`);
    }
});

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Serve static files with cache control
app.use('/uploads', express.static('/tmp/uploads', {
    maxAge: '1h', // Cache for 1 hour
    setHeaders: (res, path) => {
        if (path.endsWith('.pdf')) {
            res.set('Content-Type', 'application/pdf');
        } else if (path.endsWith('.mp4')) {
            res.set('Content-Type', 'video/mp4');
        } else if (path.endsWith('.mov')) {
            res.set('Content-Type', 'video/quicktime');
        }
    }
}));

// Serve HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'SAP-Customer.html'), {
        headers: {
            'Cache-Control': 'no-store' // Don't cache HTML
        }
    });
});

// Upload endpoint with enhanced error handling
app.post('/upload/:category/:subcategory', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded or invalid file type' 
            });
        }

        res.json({ 
            success: true, 
            file: req.file.originalname,
            path: `/uploads/${req.params.category}/${req.params.subcategory}/${req.file.filename}`
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error during upload' 
        });
    }
});

// List files endpoint with improved response
app.get('/files/:category/:subcategory', (req, res) => {
    try {
        const dir = `/tmp/uploads/${req.params.category}/${req.params.subcategory}`;
        
        if (!fs.existsSync(dir)) {
            return res.json({ 
                success: true, 
                files: [],
                count: 0
            });
        }

        fs.readdir(dir, (err, files) => {
            if (err) {
                console.error('List files error:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error reading directory' 
                });
            }

            // Sort by newest first
            const sortedFiles = files.sort((a, b) => {
                return fs.statSync(`${dir}/${b}`).mtime.getTime() - 
                       fs.statSync(`${dir}/${a}`).mtime.getTime();
            });

            res.json({ 
                success: true, 
                files: sortedFiles,
                count: sortedFiles.length
            });
        });
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

// Delete endpoint with validation
app.delete('/delete/:category/:subcategory/:filename', (req, res) => {
    try {
        const filePath = `/tmp/uploads/${req.params.category}/${req.params.subcategory}/${req.params.filename}`;
        
        // Security check - prevent directory traversal
        if (filePath.includes('../')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid file path' 
            });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'File not found' 
            });
        }

        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Delete error:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error deleting file' 
                });
            }
            res.json({ success: true });
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found' 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
