require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        color TEXT NOT NULL
      );
    `);
    console.log("Jobs table is ready!");
  } catch (err) {
    console.error("Error initializing database:", err);
  }
};

initializeDatabase();

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const auth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);


app.get("/jobs", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM jobs ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.post("/jobs", async (req, res) => {
  const { name, color } = req.body;

  if (!name || !color) {
    return res.status(400).json({ error: "Job name and color are required" });
  }

  try {
    const countResult = await pool.query("SELECT COUNT(*) FROM jobs");
    const jobCount = parseInt(countResult.rows[0].count, 10);

    if (jobCount >= 10) {
      return res.status(400).json({ error: "You have reached the job limit (10 jobs max)." });
    }

    const existingJob = await pool.query("SELECT * FROM jobs WHERE LOWER(name) = LOWER($1)", [name]);
    if (existingJob.rows.length > 0) {
      return res.status(400).json({ error: "A job with this name already exists" });
    }

    const result = await pool.query(
      "INSERT INTO jobs (name, color) VALUES ($1, $2) RETURNING *",
      [name, color]
    );

    res.status(201).json(result.rows[0]);
    console.log(`New Job added: ${name}`);
  } catch (err) {
    console.error("Error adding job:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.delete("/jobs/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM jobs WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({ message: "Job deleted successfully" });
  } catch (err) {
    console.error("Error deleting job:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.post("/add-job-entry", async (req, res) => {
  try {
    const { jobName, data } = req.body;
    if (!jobName || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: "Invalid data format" });
    }

    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[jobName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: jobName, headerValues: Object.keys(data[0]) });
    }

    await sheet.addRows(data);
    res.status(200).json({ message: `Data added to sheet: ${jobName}` });
  } catch (error) {
    console.error("Error adding data to Google Sheets:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
