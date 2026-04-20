const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

/**
 * Cerca il database in diverse posizioni comuni per evitare errori di path
 */
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

/**
 * Endpoint per il download del database
 */
router.get("/download-db", (req, res) => {
  const dbPath = findDatabasePath();
  
  // Controllo esistenza file
  if (!dbPath || !fs.existsSync(dbPath)) {
    console.error("❌ File database non trovato nelle posizioni cercate");
    return res.status(404).json({
      success: false,
      error: "File database non trovato",
      message: "Il database non esiste o non è accessibile nel filesystem del server"
    });
  }

  // Nome che l'utente vedrà al momento del salvataggio
  const downloadFilename = "gestionale.db";

  console.log(`📥 Download DB richiesto - Path sorgente: ${dbPath}`);

  // Header per forzare il download con il nome specificato
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename}"`);

  // Streaming del file per gestire correttamente la memoria del server
  const fileStream = fs.createReadStream(dbPath);

  fileStream.on("error", (err) => {
    console.error("❌ Errore durante lo streaming del DB:", err);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: "Errore durante il trasferimento del file" 
      });
    }
  });

  fileStream.pipe(res);
});

module.exports = router;