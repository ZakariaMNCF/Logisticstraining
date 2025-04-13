const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Set up file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = `/tmp/uploads/${req.params.category}/${req.params.subcategory}`;
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// Serve static files
app.use('/uploads', express.static('/tmp/uploads'));

// Serve HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'SAP-Customer.html'));
});

// Upload endpoint
app.post('/upload/:category/:subcategory', upload.single('file'), (req, res) => {
    res.json({ success: true, file: req.file.originalname });
});

// List files endpoint
app.get('/files/:category/:subcategory', (req, res) => {
    const dir = `/tmp/uploads/${req.params.category}/${req.params.subcategory}`;
    if (!fs.existsSync(dir)) {
        return res.json({ success: true, files: [] });
    }
    fs.readdir(dir, (err, files) => {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true, files });
    });
});

// Delete endpoint
app.delete('/delete/:category/:subcategory/:filename', (req, res) => {
    const filePath = `/tmp/uploads/${req.params.category}/${req.params.subcategory}/${req.params.filename}`;
    fs.unlink(filePath, (err) => {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
