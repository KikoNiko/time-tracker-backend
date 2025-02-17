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
// Function to append data to Google Sheets
async function addRowToSheet(data) {
    try {
      console.log("Received Data:", data); // Log the data before sending it
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0]; // First sheet
  
      await sheet.addRows(data);
      console.log("Data successfully added to Google Sheets! ✅");
    } catch (error) {
      console.error("Error adding row:", error);
    }
  }
  

// API Route to receive data
app.post("/add-job-entry", async (req, res) => {
  try {
    const jobData = req.body; // Data from frontend
    if (!Array.isArray(jobData) || jobData.length === 0) {
      return res.status(400).json({ message: "Invalid data format" });
    }

    await addRowToSheet(jobData);
    res.status(200).json({ message: "Data added successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
