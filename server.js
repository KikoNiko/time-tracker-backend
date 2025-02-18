const db = require("./database");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

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

// Add a new job
app.post("/jobs", (req, res) => {
  const { name, color } = req.body;
  if (!name || !color) {
    return res.status(400).json({ error: "Job name and color are required" });
  }

  db.run(
    "INSERT INTO jobs (name, color) VALUES (?, ?)",
    [name, color],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(201).json({ id: this.lastID, name, color });
        console.log(`New Job added: ${name}`)
      }
    }
  );
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
