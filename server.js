const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("uploads"));
app.use(express.json());

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    let originalName = file.originalname;
    let filePath = path.join("uploads", originalName);

    // If file exists, append timestamp
    if (fs.existsSync(filePath)) {
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      originalName = `${baseName}-${Date.now()}${ext}`;
    }

    cb(null, originalName);
  },
});

const upload = multer({ storage });

// Upload File
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ message: "File uploaded successfully", filename: req.file.filename });
});

// List Files
app.get("/files", (req, res) => {
  fs.readdir("uploads", (err, files) => {
    if (err) return res.status(500).json({ error: "Failed to read directory" });

    // Sort files by newest first
    files.sort((a, b) => {
      const aTime = fs.statSync(path.join("uploads", a)).mtime.getTime();
      const bTime = fs.statSync(path.join("uploads", b)).mtime.getTime();
      return bTime - aTime;
    });

    res.json(files);
  });
});

// Download File
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  res.download(filePath);
});

// Delete File
app.delete("/delete/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to delete file" });
    }
    res.json({ message: "File deleted successfully" });
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// Fake User Credentials (Move to Database Later)
const USERS = [{ username: "baba", password: "baba69" }];

// Login API
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  
  if (user) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

setInterval(() => {
    https.get("https://storagebackend.onrender.com");
}, 5 * 60 * 1000); // Ping every 5 minutes

