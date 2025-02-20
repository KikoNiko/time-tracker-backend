const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

// Open (or create) the SQLite database
const db = new sqlite3.Database("./jobs.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

db.run(
  `CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL
  )`
);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    google_sheets_id TEXT
  )
`);

const registerUser = async (email, password, callback) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (email, password) VALUES (?, ?)",
    [email, hashedPassword],
    function (err) {
      callback(err, { id: this?.lastID, email });
    }
  );
};

const findUserByEmail = (email, callback) => {
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    callback(err, user);
  });
};

module.exports = db;
