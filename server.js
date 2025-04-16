require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// 1. CORS Configuration - EXACT URLs
const allowedOrigins = [
    'https://zakariamncf.github.io', // Your exact GitHub Pages URL
    'https://logisticstraining-mxoz.vercel.app' // Your exact Vercel URL
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

// 2. Middleware
app.use(express.json());

// 3. File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = '/tmp/uploads';
        fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// 4. Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        res.json({
            success: true,
            filename: req.file.filename,
            url: `https://logisticstraining-mxoz.vercel.app/uploads/${req.file.filename}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// 5. Serve Uploaded Files
app.use('/uploads', express.static('/tmp/uploads'));

// 6. Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', server: 'running' });
});

// 7. Error Handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
