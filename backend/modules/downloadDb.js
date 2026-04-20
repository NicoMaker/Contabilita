const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Percorso corretto per gestionale.db (backend/db/gestionale.db)
// Attenzione: il file potrebbe essere in posizioni diverse
const DB_PATH = path.join(__dirname, '..', 'db', 'gestionale.db');
// Percorso alternativo se il DB è in backend/
// const DB_PATH = path.join(__dirname, '..', 'gestionale.db');

// Funzione per trovare il DB in più possibili posizioni
function findDatabasePath() {
  const possiblePaths = [
    path.join(__dirname, '..', 'db', 'gestionale.db'),
    path.join(__dirname, '..', 'gestionale.db'),
    path.join(__dirname, '..', '..', 'db', 'gestionale.db'),
    path.join(process.cwd(), 'db', 'gestionale.db'),
    path.join(process.cwd(), 'gestionale.db'),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`✅ Database trovato in: ${p}`);
      return p;
    }
  }
  return null;
}

router.get("/download-db", (req, res) => {
  const dbPath = findDatabasePath();
  
  if (!dbPath || !fs.existsSync(dbPath)) {
    console.error("❌ File database non trovato nelle posizioni cercate");
    return res.status(404).json({
      success: false,
      error: "File database non trovato",
      message: "Il database non esiste o non è accessibile"
    });
  }

  const downloadFilename = `gestionale_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.db`;

  console.log(`📥 Download DB richiesto - File: ${downloadFilename} - Path: ${dbPath}`);

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename}"`);

  const fileStream = fs.createReadStream(dbPath);
  fileStream.on("error", (err) => {
    console.error("❌ Errore lettura DB:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Errore durante la lettura del database" });
    }
  });
  fileStream.pipe(res);
});

module.exports = router;