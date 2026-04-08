# Automated Cleaned Corporate RecordsData Pipeline: MERN Stack with Python Ingestion

## Project Structure

```
filesure/
|
├── python_ingestion/
│   └── ingest.py                  # Part 1 — Python data cleaning + MongoDB ingestion
    └── company_records.csv        # Sample data (80 records)
├── backend/
│   ├── server.js                  # Part 2 — Express API entry point
│   ├── routes.js                  # API route handlers
│   ├── Company.js                 # Mongoose schema (like JPA Entity)
│   ├── db.js                      # MongoDB connection
│   ├── .env                       # Environment variables
│   └── package.json
└── frontend/
    └── src/
        └── App.tsx                # Part 3 — Frontend (Typescript)
        └── App.css           
```

---

## Prerequisites 
- Node.js  
- Python  
- MongoDB running locally    

```

---

## Setup & Run

### Step 1 — Python Ingestion (Part 1)

``` 
pip install pymongo pandas

cd python_ingestion
ingest.py
```

**Expected output:**
```
✅ Ingestion Output: Connected to MongoDB
Read 80 rows 
Cleaned 80 documents
Inserted 80 documents into MongoDB

Ingestion Summary:
   Total records inserted  : 80
   Missing CIN             : 5
   Missing secondary key   : 0
   Missing company name    : 0
   Missing status          : 0
   Missing state           : 0
   Missing director 1      : 0
   Missing director 2      : 14
   Capital = 0 (missing)   : 0
   Missing incorporation   : 22
   Missing filing date     : 11
   Invalid emails          : 8
```

### Step 2 — Start API (Part 2)

```
cd backend
npm install
node server.js
```

**Expected output:**
```
✅ MongoDB Connected: localhost
🚀 FileSure API running on http://localhost:5000
```

### Step 3 — Open Frontend (Part 3)

npm run dev
Frontend running on http://localhost:5173/

---

## API Endpoints

🚀 FileSure API running on http://localhost:5000
📋 Endpoints:
   GET /health
   GET /companies
   GET /companies?status=Active&state=Maharashtra
   GET /companies/summary
   GET /companies/:id

### Example Responses

**GET /companies?status=Active&state=Maharashtra&page=1&limit=5**
**GET http://localhost:5000/companies?status=Active&state=Maharashtra&page=1&limit=5**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 5,
    "totalPages": 1
  }
}
```

**GET /companies/summary**
**http://localhost:5000/companies/summary**
```json
{
    "success": true,
    "data": {
        "by_status": [
            {
                "status": "Active",
                "count": 40
            },
            {
                "status": "Under Liquidation",
                "count": 15
            },
            {
                "status": "Strike Off",
                "count": 13
            },
            {
                "status": "Dormant",
                "count": 6
            },
            {
                "status": "Struck Off",
                "count": 6
            }
        ],
        "data_quality": {
            "total_records": 80,
            "invalid_emails": 8,
            "missing_cin": 5
        }
    }
}
```

---

## Data Cleaning Decisions

| Issue | How Handled |
|-------|-------------|
| Mixed date formats (DD-MM-YYYY vs YYYY/MM/DD) | Tried both formats, stored as DD-MM-YYYY |
| Inconsistent status casing (active/ACTIVE/Active) | Normalized to Title Case mapping |
| Special character in paid_up_capital | Stripped before parsing |
| Commas in numbers (1,200,000) | Stripped before parsing |
| Invalid emails | Flagged with `Unknown` — NOT dropped |
| Missing CIN | Flagged with `Unknown` — NOT dropped |
| Blank director_2 | Stored as `Unknown` — acceptable, director_2 is optional |

## MongoDB Schema Design

```json
        {
            "_id": "69d61ae11a862f3b8c273e65",
            "cin": "U74999GJ2010PTC858490",
            "secondary_key": "Allied Systems Pvt Ltd|26-04-2015",
            "company_name": "Allied Systems Pvt Ltd",
            "status": "Dormant",
            "state": "Gujarat",
            "director_1": "Anil Banerjee",
            "director_2": "Jyoti Rao",
            "incorporation_date": "26-04-2015",
            "last_filing_date": "07-02-2024",
            "paid_up_capital": 5000000,
            "email_raw": "info@company.co.in",
            "email_validated": "info@company.co.in",
            "ingested_at": "2026-04-08T09:07:45.585599"
        } 

```

## Indexes Created

- `status` — for filtering by company status
- `state` — for filtering by state
- `secondary_key` — for unique identifier lookups
- `(status, state)` — compound index for combined filters
