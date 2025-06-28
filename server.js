const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Express app setup
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.static("uploads"));
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb+srv://baba:baba@cloud.fh7nvvv.mongodb.net/?retryWrites=true&w=majority&appName=cloud", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

// File Schema
const fileSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  size: Number,
  uploadDate: { type: Date, default: Date.now },
});
const File = mongoose.model("File", fileSchema);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    let originalName = file.originalname;
    let filePath = path.join("uploads", originalName);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      originalName = `${baseName}-${Date.now()}${ext}`;
    }

    cb(null, originalName);
  },
});
const upload = multer({ storage });

// Upload file
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const newFile = new File({
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
    });
    await newFile.save();

    res.json({ message: "File uploaded successfully", filename: req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// List files
app.get("/files", async (req, res) => {
  try {
    const files = await File.find().sort({ uploadDate: -1 });
    res.json(files.map(file => file.filename));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch file list" });
  }
});

// Download file
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  res.download(filePath);
});

// Delete file
app.delete("/delete/:filename", async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);

  try {
    fs.unlinkSync(filePath);
    await File.deleteOne({ filename });
    res.json({ message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
