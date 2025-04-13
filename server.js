// Modified storage configuration
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
        // Simplified filename handling - keep original name
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        console.log(`File upload: ${sanitized}`);
        cb(null, sanitized); // Removed timestamp prefix
    }
});

// Enhanced static file serving
app.use('/uploads', express.static('/tmp/uploads', {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = {
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xls': 'application/vnd.ms-excel'
        }[ext];
        
        if (contentType) {
            res.set('Content-Type', contentType);
            res.set('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        }
    }
}));

// Modified upload endpoint
app.post('/upload/:category/:subcategory', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            console.warn('Upload attempt with no valid file');
            return res.status(400).json({
                success: false,
                error: 'No file uploaded or invalid file type',
                allowedTypes: ['PDF', 'MP4', 'MOV', 'DOC', 'DOCX', 'XLSX', 'XLS'],
                maxSize: '10MB'
            });
        }

        console.log(`Successful upload: ${req.file.filename}`);
        res.json({
            success: true,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            downloadUrl: `/uploads/${req.params.category}/${req.params.subcategory}/${req.file.filename}`,
            size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
            type: req.file.mimetype
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

// Enhanced list files endpoint
app.get('/files/:category/:subcategory', async (req, res) => {
    try {
        const dir = `/tmp/uploads/${req.params.category}/${req.params.subcategory}`;
        
        if (!fs.existsSync(dir)) {
            console.log(`Directory not found: ${dir}`);
            return res.json({
                success: true,
                files: [],
                count: 0,
                message: 'No files found'
            });
        }

        const files = await fs.promises.readdir(dir);
        const filesWithMeta = await Promise.all(
            files.map(async file => {
                const stat = await fs.promises.stat(`${dir}/${file}`);
                return {
                    fileName: file, // Simplified property name
                    fileUrl: `/uploads/${req.params.category}/${req.params.subcategory}/${file}`,
                    size: (stat.size / 1024).toFixed(2) + ' KB',
                    lastModified: stat.mtime.toISOString()
                };
            })
        );

        res.json({
            success: true,
            files: filesWithMeta,
            count: filesWithMeta.length
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
