const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration with logging
app.use(cors({
    origin: [
        'https://logisticstraining-mxoz.vercel.app',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight request handling
app.options('*', cors());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// File filter with better MIME type validation
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'video/mp4',
        'video/quicktime',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const allowedExtensions = ['.pdf', '.mp4', '.mov', '.doc', '.docx', '.xls', '.xlsx'];
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExt)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`), false);
    }
};

// Enhanced storage configuration - keeps original filename
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = `/tmp/uploads/${req.params.category}/${req.params.subcategory}`;
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
            cb(null, dir);
        } catch (err) {
            console.error(`Directory creation error: ${err}`);
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        // Keep the original filename but sanitize it
        const originalName = file.originalname;
        const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        console.log(`File upload: ${sanitized}`);
        cb(null, sanitized);
    }
});

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1 // Single file upload
    }
});

// Serve static files with enhanced caching
app.use('/uploads', express.static('/tmp/uploads', {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        const contentType = {
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }[ext];
        
        if (contentType) {
            res.set('Content-Type', contentType);
        }
    }
}));

// Route handlers with improved error handling

// Home route with version info
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'SAP-Customer.html'), {
        headers: {
            'Cache-Control': 'no-store',
            'X-API-Version': '1.0.0'
        }
    });
});

// Upload endpoint with detailed validation
app.post('/upload/:category/:subcategory', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            console.warn('Upload attempt with no valid file');
            return res.status(400).json({
                success: false,
                error: 'No file uploaded or invalid file type',
                allowedTypes: ['PDF', 'MP4', 'MOV', 'DOC', 'DOCX', 'XLS', 'XLSX'],
                maxSize: '10MB'
            });
        }

        console.log(`Successful upload: ${req.file.filename}`);
        res.json({
            success: true,
            file: req.file.originalname,
            storedName: req.file.filename,
            path: `/uploads/${req.params.category}/${req.params.subcategory}/${req.file.filename}`,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        console.error('Upload error:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Upload failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// List files endpoint with metadata
app.get('/files/:category/:subcategory', async (req, res) => {
    try {
        const dir = `/tmp/uploads/${req.params.category}/${req.params.subcategory}`;
        
        if (!fs.existsSync(dir)) {
            console.log(`Directory not found: ${dir}`);
            return res.json({
                success: true,
                files: [],
                count: 0,
                message: 'No files found for this category'
            });
        }

        const files = await fs.promises.readdir(dir);
        const filesWithMeta = await Promise.all(
            files.map(async file => {
                const stat = await fs.promises.stat(`${dir}/${file}`);
                return {
                    name: file,
                    originalName: file, // Now the stored name is the original name
                    size: stat.size,
                    modified: stat.mtime,
                    url: `/uploads/${req.params.category}/${req.params.subcategory}/${file}`
                };
            })
        );

        // Sort by modified time (newest first)
        filesWithMeta.sort((a, b) => b.modified - a.modified);

        res.json({
            success: true,
            files: filesWithMeta,
            count: filesWithMeta.length,
            directory: dir
        });
    } catch (error) {
        console.error('File list error:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Could not retrieve files',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Delete endpoint with additional checks
app.delete('/delete/:category/:subcategory/:filename', async (req, res) => {
    try {
        const filePath = `/tmp/uploads/${req.params.category}/${req.params.subcategory}/${req.params.filename}`;
        
        // Security checks
        if (filePath.includes('../') || !path.normalize(filePath).startsWith('/tmp/uploads')) {
            console.warn(`Potential path traversal attempt: ${filePath}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid file path'
            });
        }

        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}`);
            return res.status(404).json({
                success: false,
                error: 'File not found',
                path: filePath
            });
        }

        await fs.promises.unlink(filePath);
        console.log(`Deleted file: ${filePath}`);
        
        res.json({
            success: true,
            message: 'File deleted successfully',
            deletedFile: req.params.filename
        });
    } catch (error) {
        console.error('Delete error:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to delete file',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// The rest of your code remains the same...
// (health check, API docs, 404 handler, error handler, server startup)

// Enhanced health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        env: process.env.NODE_ENV || 'development',
        version: require('./package.json').version || 'unknown'
    };
    console.log('Health check:', health);
    res.json(health);
});

// API documentation endpoint
app.get('/api-docs', (req, res) => {
    res.json({
        endpoints: [
            {
                method: 'POST',
                path: '/upload/:category/:subcategory',
                description: 'Upload a file',
                parameters: {
                    category: 'String',
                    subcategory: 'String'
                },
                body: 'multipart/form-data with file'
            },
            {
                method: 'GET',
                path: '/files/:category/:subcategory',
                description: 'List all files'
            },
            {
                method: 'DELETE',
                path: '/delete/:category/:subcategory/:filename',
                description: 'Delete a file'
            }
        ]
    });
});

// Improved 404 handler
app.use((req, res) => {
    console.warn(`404: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        requested: `${req.method} ${req.path}`,
        availableEndpoints: [
            'POST /upload/:category/:subcategory',
            'GET /files/:category/:subcategory',
            'DELETE /delete/:category/:subcategory/:filename',
            'GET /health',
            'GET /api-docs'
        ]
    });
});

// Enhanced error handler
app.use((err, req, res, next) => {
    console.error('Server error:', {
        error: err.stack,
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body
    });
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        requestId: req.id,
        ...(process.env.NODE_ENV === 'development' && {
            details: err.message,
            stack: err.stack
        })
    });
});

// Server startup with more info
app.listen(port, () => {
    console.log(`
    Server started at ${new Date().toISOString()}
    Environment: ${process.env.NODE_ENV || 'development'}
    Listening on port: ${port}
    CORS allowed origins: 
      - https://logisticstraining-mxoz.vercel.app
      - http://localhost:3000
    Upload directory: /tmp/uploads
    Max file size: 10MB
    `);
});

// Handle uncaught exceptions
process.on('uncaughtException', err => {
    console.error('Uncaught Exception:', err.stack);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err.stack);
});
