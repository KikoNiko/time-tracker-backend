const sqlite3 = require("sqlite3").verbose();

// Open (or create) the SQLite database
const db = new sqlite3.Database("./jobs.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// Create the Jobs table if it doesn't exist
db.run(
  `CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL
  )`
);

module.exports = db;
