require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();

// 1. Fix CORS permanently
app.use(cors({
  origin: [
    'https://zakariamncf.github.io',
    'https://logisticstraining.vercel.app'
  ],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// 2. Basic API endpoint that always works
app.get('/api', (req, res) => {
  res.json({ 
    status: 'API is working',
    endpoints: {
      upload: '/api/upload',
      files: '/api/files',
      delete: '/api/delete/:filename'
    }
  });
});

// 3. Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    server: 'running',
    time: new Date().toISOString()
  });
});

module.exports = app;
