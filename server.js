const db = require("./database");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { registerUser, findUserByEmail } = require("./database");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const jwtSecret = process.env.JWT_SECRET;

// User Registration
app.post("/register", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  registerUser(email, password, (err, newUser) => {
    if (err) {
      return res.status(400).json({ error: "User already exists" });
    }
    res.status(201).json({ message: "User registered successfully", user: newUser });
  });
});

// User Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  findUserByEmail(email, async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, { expiresIn: "24h" });

    res.json({ token, userId: user.id });
  });
});

// Middleware to Protect Routes
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "Access denied" });

  jwt.verify(token.split(" ")[1], jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

app.post("/tracker", authenticateToken, (req, res) => {
  res.json({ message: `User ${req.user.email} Welcome!` });
});

// Google Sheets Setup
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT); // Load credentials from .env

const auth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);

// Get all jobs
app.get("/jobs", (req, res) => {
  db.all("SELECT * FROM jobs", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Add a new job (max 10 jobs)
app.post("/jobs", (req, res) => {
  const { name, color } = req.body;

  if (!name || !color) {
    return res.status(400).json({ error: "Job name and color are required" });
  }

  db.get("SELECT COUNT(*) AS count FROM jobs", [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (row.count >= 10) {
      return res.status(400).json({ error: "You have reached the job limit (10 jobs max)." });
    }

    db.get("SELECT * FROM jobs WHERE LOWER(name) = LOWER(?)", [name], (err, existingJob) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (existingJob) {
        return res.status(400).json({ error: "A job with this name already exists" });
      }

      db.run(
        "INSERT INTO jobs (name, color) VALUES (?, ?)",
        [name, color],
        function (err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          res.status(201).json({ id: this.lastID, name, color });
          console.log(`New Job added: ${name}`);
        }
      );
    });
  });
});


// Delete a job
app.delete("/jobs/:id", (req, res) => {
  const jobId = req.params.id;
  db.run("DELETE FROM jobs WHERE id = ?", jobId, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: "Job deleted successfully" });
    }
  });
});


app.post("/add-job-entry", async (req, res) => {
  try {
    const { jobName, data } = req.body; // Get job name and data from request
    if (!jobName || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: "Invalid data format" });
    }

    await doc.loadInfo(); // Load spreadsheet metadata

    let sheet = doc.sheetsByTitle[jobName]; // Check if the sheet exists
    if (!sheet) {
      sheet = await doc.addSheet({ title: jobName, headerValues: Object.keys(data[0]) });
    }

    await sheet.addRows(data); // Append data to the correct sheet
    res.status(200).json({ message: `Data added to sheet: ${jobName}` });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
