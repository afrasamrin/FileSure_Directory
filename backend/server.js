import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDb from './db.js'; 
import companyRoutes from './routes.js';

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
 
dotenv.config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const runIngestion = () => {
  return new Promise((resolve, reject) => {
    console.log("⏳ Starting Data Ingestion...");
     
    const scriptPath = path.join(__dirname, '../python_ingestion/ingest.py');

    exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Ingestion Script Error: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.warn(`⚠️ Ingestion Warnings: ${stderr}`);
      }
      console.log(`✅ Ingestion Output: ${stdout}`);
      resolve();
    });
  });
};

app.get('/', (req, res) => {
  res.send('First route is working!');
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "FileSure API is running",
    timestamp: new Date().toISOString()
  });
});

app.use("/companies", companyRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    details: err.message,
  });
});

 

// app.listen(5000,() => {
//   console.log('Server is running on port 5000');
// });

// In your startServer function:
const startServer = async () => {
  try {
    
    await connectDb();
    
    // Run ingestion on every server restart
    await runIngestion();  
    app.listen(PORT, () => {
    console.log(`🚀 FileSure API running on http://localhost:${PORT}`);
    console.log(`📋 Endpoints:`);
    console.log(`   GET /health`);
    console.log(`   GET /companies`);
    console.log(`   GET /companies?status=Active&state=Maharashtra`);
    console.log(`   GET /companies/summary`);
    console.log(`   GET /companies/:id`);
  });
  } catch (err) {
    console.error("💥 Failed to start server:", err);
    process.exit(1);
  }
};

startServer();

