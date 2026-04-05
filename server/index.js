require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const fingerprintRoutes = require("./routes/fingerprint");
const resourceRoutes = require("./routes/resources");
const pulseRoutes = require("./routes/pulse");
const importRoutes = require("./routes/import");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/fingerprint", fingerprintRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/pulse", pulseRoutes);
app.use("/api/import", importRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "TeachMap API" }));

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`TeachMap server running on http://localhost:${PORT}`);
});
