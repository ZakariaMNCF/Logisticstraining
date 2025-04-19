require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();

// MongoDB Connection
const uri = process.env.MONGODB_URI || "mongodb+srv://MOUNSIF:Zaki210300@@cluster0.v3i952t.mongodb.net/fileUploadDB?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  }
});

let db;

async function connectDB() {
  if (!db) {
    try {
      await client.connect();
      db = client.db("fileUploadDB");
      await db.collection('files').createIndex({ uploadDate: -1 });
      console.log("MongoDB connected");
    } catch (err) {
      console.error("MongoDB connection error:", err);
      throw err;
    }
  }
  return db;
}

// Middleware
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', db: db ? 'connected' : 'disconnected' });
});

app.get('/api/files', async (req, res) => {
  try {
    const db = await connectDB();
    const files = await db.collection('files').find().toArray();
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database operation failed" });
  }
});

// Static files
app.use(express.static(path.join(__dirname)));

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Vercel handler
module.exports = app;

// Local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
