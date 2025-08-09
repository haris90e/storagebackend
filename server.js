const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
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

// ===== Upload file =====
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileStream = new stream.PassThrough();
  fileStream.end(req.file.buffer);

  // Store with original filename + MIME type
  const uploadStream = gfsBucket.openUploadStream(req.file.originalname, {
    contentType: req.file.mimetype
  });

  const fileId = uploadStream.id; // Get ObjectId before upload finishes

  fileStream.pipe(uploadStream)
    .on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "Error uploading file" });
    })
    .on("finish", () => {
      res.json({
        message: "File uploaded successfully",
        id: fileId,
        filename: req.file.originalname
      });
    });
});

// ===== List files =====
app.get("/files", async (req, res) => {
  try {
    const files = await gfsBucket.find({}).sort({ uploadDate: -1 }).toArray();
    res.json(files.map(f => ({
      id: f._id,
      filename: f.filename
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to list files" });
  }
});

// ===== Download file by ID =====
app.get("/download/:id", async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    const files = await gfsBucket.find({ _id: fileId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = files[0];

    // Set correct headers
    res.set({
      "Content-Type": file.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.filename}"`
    });

    gfsBucket.openDownloadStream(fileId)
      .on("error", () => res.status(404).json({ error: "File not found" }))
      .pipe(res);

  } catch (err) {
    res.status(400).json({ error: "Invalid file ID" });
  }
});

// ===== Delete file by ID =====
app.delete("/delete/:id", async (req, res) => {
  try {
    const fileId = new ObjectId(req.params.id);
    await gfsBucket.delete(fileId);
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
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
  })
  .catch(err => console.error("❌ MongoDB Connection Error:", err));
