const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

// Set up storage engine for multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const category = req.params.category;
        const subcategory = req.params.subcategory;
        const dir = `./uploads/${category}/${subcategory}`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'SAP-Customer.html'));
});

// Upload endpoint
app.post('/upload/:category/:subcategory', upload.single('file'), (req, res) => {
    res.json({ success: true, file: req.file.originalname });
});

// List files endpoint
app.get('/files/:category/:subcategory', (req, res) => {
    const category = req.params.category;
    const subcategory = req.params.subcategory;
    const dir = `./uploads/${category}/${subcategory}`;
    fs.readdir(dir, (err, files) => {
        if (err) {
            return res.json({ success: false, error: err.message });
        }
        res.json({ success: true, files });
    });
});

// Delete file endpoint
app.delete('/delete/:category/:subcategory/:filename', (req, res) => {
    const category = req.params.category;
    const subcategory = req.params.subcategory;
    const filename = req.params.filename;
    const filePath = `./uploads/${category}/${subcategory}/${filename}`;
    fs.unlink(filePath, (err) => {
        if (err) {
            return res.json({ success: false, error: err.message });
        }
        res.json({ success: true });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});