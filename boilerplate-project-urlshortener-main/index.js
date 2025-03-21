"use strict";

var express = require("express");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var dns = require("dns").promises; // Use Promise-based DNS lookup
require("dotenv").config();
var cors = require("cors");

var app = express();

// Basic Configuration
var port = process.env.PORT || 3000;

// Enable CORS (Fixes "Failed to fetch" issue)
app.use(cors({ origin: "*" }));

// Parse URL-encoded and JSON data
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve frontend
app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGOLAB_URI || "mongodb://localhost:27017/urlshortener", {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Define Schema & Model
var urlMappingSchema = new mongoose.Schema({
  original_url: String,
  short_url: Number
});
var UrlMapping = mongoose.model("UrlMapping", urlMappingSchema);

// Helper Function: Validate URL Format
function isValidUrl(url) {
  const urlRegex = /^(https?:\/\/)(www\.)?([\w-]+\.)+[\w]{2,}\/?/;
  return urlRegex.test(url);
}

// ✅ POST: Shorten URL
app.post("/api/shorturl", async function (req, res) {
  var url = req.body.url;

  // 1️⃣ Validate URL format before checking with DNS
  if (!isValidUrl(url)) {
    return res.json({ error: "invalid url" });
  }

  // 2️⃣ Extract domain name for DNS lookup
  var domain = url.replace(/(^\w+:|^)\/\//, "").split("/")[0];

  try {
    // 3️⃣ Perform DNS lookup (now using Promises)
    await dns.lookup(domain);

    // 4️⃣ Check if URL already exists in the database
    let existingUrl = await UrlMapping.findOne({ original_url: url });

    if (existingUrl) {
      return res.json({ original_url: url, short_url: existingUrl.short_url });
    } else {
      // 5️⃣ Generate a new short URL (numeric & incrementing)
      let count = await UrlMapping.countDocuments();
      let newShortUrl = count + 1;

      let newUrlMapping = new UrlMapping({
        original_url: url,
        short_url: newShortUrl
      });

      await newUrlMapping.save();

      return res.json({ original_url: url, short_url: newShortUrl });
    }
  } catch (err) {
    return res.json({ error: "invalid url" });
  }
});

// ✅ GET: Redirect Short URL
app.get("/api/shorturl/:shortUrl", async function (req, res) {
  var shortUrl = parseInt(req.params.shortUrl);

  try {
    let doc = await UrlMapping.findOne({ short_url: shortUrl });

    if (!doc) {
      return res.json({ error: "invalid url" });
    } else {
      return res.redirect(doc.original_url);
    }
  } catch (err) {
    return res.json({ error: "invalid url" });
  }
});

// Start Server
app.listen(port, function () {
  console.log("🚀 Server running on port " + port);
});
