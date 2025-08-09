const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { MongoClient, GridFSBucket } = require("mongodb");
const stream = require("stream");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ===== MongoDB Connection =====
const mongoURI = "mongodb+srv://baba:baba@cluster0.6p0km71.mongodb.net/fileStorageDB?retryWrites=true&w=majority&appName=Cluster0&ssl=true&tlsAllowInvalidHostnames=true";
const dbName = "fileStorageDB";

let gfsBucket;
let db;

// Multer (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload file
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileStream = new stream.PassThrough();
  fileStream.end(req.file.buffer);

  const uploadStream = gfsBucket.openUploadStream(req.file.originalname);
  fileStream.pipe(uploadStream)
    .on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "Error uploading file" });
    })
    .on("finish", () => {
      res.json({ message: "File uploaded successfully", filename: req.file.originalname });
    });
});

// List files
app.get("/files", async (req, res) => {
  try {
    const files = await gfsBucket.find({}).sort({ uploadDate: -1 }).toArray();
    res.json(files.map(f => f.filename));
  } catch (err) {
    res.status(500).json({ error: "Failed to list files" });
  }
});

// Download file
app.get("/download/:filename", async (req, res) => {
  try {
    const file = await gfsBucket.find({ filename: req.params.filename }).toArray();
    if (!file || file.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }
    gfsBucket.openDownloadStreamByName(req.params.filename).pipe(res);
  } catch {
    res.status(400).json({ error: "Invalid file request" });
  }
});

// Delete file
app.delete("/delete/:filename", async (req, res) => {
  try {
    const file = await gfsBucket.find({ filename: req.params.filename }).toArray();
    if (!file || file.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }
    await gfsBucket.delete(file[0]._id);
    res.json({ message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// Connect to MongoDB FIRST, then start server
MongoClient.connect(mongoURI)
  .then(client => {
    db = client.db(dbName);
    gfsBucket = new GridFSBucket(db, { bucketName: "uploads" });
    console.log("✅ MongoDB connected");

    // Start server only after DB connection
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
  })
  .catch(err => console.error("❌ MongoDB Connection Error:", err));
