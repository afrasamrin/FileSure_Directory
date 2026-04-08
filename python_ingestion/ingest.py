"""
FileSure - Data Ingestion Script
Reads company_records.csv, cleans data, inserts into MongoDB

How to run:
    pip install pymongo pandas
    python ingest.py

CSV location: place company_records.csv in the SAME folder as this script.
"""

import pandas as pd
import re
import os
from datetime import datetime
from pymongo import MongoClient, ASCENDING

# ─────────────────────────────────────────────
# CSV PATH
# ─────────────────────────────────────────────
CSV_PATH = os.path.join(os.path.dirname(__file__), "company_records.csv")


# ─────────────────────────────────────────────
# 1. CONNECT TO MONGODB
# ─────────────────────────────────────────────
try:
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=3000)
    client.server_info()  # forces real connection attempt
    db = client["filesure"]
    collection = db["companies"]
    collection.drop()     # drop old data so re-runs are clean
    print("Connected to MongoDB")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    print("Make sure MongoDB is running: mongod (Mac/Linux) or start service on Windows")
    exit(1)


# ─────────────────────────────────────────────
# 2. HELPER FUNCTIONS
# ─────────────────────────────────────────────

def normalize_date(date_str):
    """
    Handles two messy date formats from CSV:
      DD-MM-YYYY  (e.g. 15-03-2019)
      YYYY/MM/DD  (e.g. 2019/03/15)
    Returns DD-MM-YYYY string, or "Unknown" if blank/invalid.
    """
    date_str = str(date_str).strip().replace('/', '-')
    if pd.isna(date_str) or str(date_str).strip() == "":
        return "Unknown" 
    formats = ["%d-%m-%Y", "%m-%d-%Y", "%Y-%m-%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime("%d-%m-%Y")
        except ValueError:
            continue
    return "Unknown"


def clean_capital(capital_str):
    """
    Removes ■, commas, and any non-digit characters.
    Returns int, or 0 if blank/unparseable.
    """
    if pd.isna(capital_str) or str(capital_str).strip() == "":
        return 0
    cleaned = re.sub(r'[^\d]', '', str(capital_str).strip())
    if cleaned == "":
        return 0
    try:
        return int(cleaned)
    except ValueError:
        return 0


def validate_email(email_str):
    """
    Returns two values:
      email_raw:       original value from CSV as-is (or "Unknown" if blank)
      email_validated: valid email if passes regex, else "Unknown"

    NO nested objects — two flat fields as requested.
    """
    if pd.isna(email_str) or str(email_str).strip() == "":
        return "Unknown", "Unknown"

    email = str(email_str).strip()
    email = str(email_str).replace(r'\s+', '')
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    is_valid = bool(re.match(pattern, email))
     

    email_raw       = email
    email_validated = email if is_valid else "Unknown"

    return email_raw, email_validated


def normalize_status(status_str):
    """
    Normalizes casing: "active"/"ACTIVE" → "Active", "strike off" → "Strike Off"
    """
    if pd.isna(status_str) or str(status_str).strip() == "":
        return "Unknown"
    status = str(status_str).strip().lower()
    mapping = {
        "active":     "Active",
        "strike off": "Strike Off",
        "under liq.": "Under Liquidation",
    }
    return mapping.get(status, str(status_str).strip().title())


def clean_string(value):
    """
    Strips whitespace, Title Cases, returns "Unknown" if empty.
    """
    if pd.isna(value) or str(value).strip() == "" or str(value).strip().lower() == "nan":
        return "Unknown"
    return str(value).strip().title()


def make_secondary_key(company_name, incorporation_date):
    """
    Creates a secondary key combining company_name + incorporation_date.
    Format: "Bharat Fintech Pvt Ltd|15-03-2019"
    Acts as a secondary primary key when CIN is missing.
    Returns "Unknown" if both fields are missing.
    """
    name = str(company_name).strip()
    date = str(incorporation_date).strip()
    if not name and not date:
        return "Unknown"
    return f"{name}|{date}"


# ─────────────────────────────────────────────
# 3. READ CSV
# ─────────────────────────────────────────────
try:
    df = pd.read_csv(
        CSV_PATH,
        keep_default_na=False,
        dtype=str
    )
    print(f"Read {len(df)} rows from: {CSV_PATH}")
except FileNotFoundError:
    print(f"CSV not found at: {CSV_PATH}")
    print("→ Copy company_records.csv into the same folder as ingest.py")
    exit(1)
except Exception as e:
    print(f"Failed to read CSV: {e}")
    exit(1)


# ─────────────────────────────────────────────
# 4. CLEAN & BUILD DOCUMENTS
# ─────────────────────────────────────────────
documents = []

 
for idx, row in df.iterrows():
    try:
        cin = str(row.get("cin", "")).strip()
        cin_clean = cin if (cin and cin.lower() != "nan") else "Unknown"

        company_name      = clean_string(row.get("company_name"))
        incorporation_date = normalize_date(row.get("incorporation_date"))
        email_raw, email_validated = validate_email(row.get("email"))

        doc = {
            # ── Identifiers ──
            "cin":           cin_clean,

            # Secondary key = company_name + incorporation_date
            # This is the secondary primary key when CIN is Unknown
            "secondary_key": make_secondary_key(company_name, incorporation_date),

            # ── Company Info ──
            "company_name":       company_name,
            "status":             normalize_status(row.get("status")),
            "state":              clean_string(row.get("state")),

            # ── Directors ──
            "director_1":         clean_string(row.get("director_1")),
            "director_2":         clean_string(row.get("director_2")),

            # ── Dates ──
            "incorporation_date": incorporation_date,
            "last_filing_date":   normalize_date(row.get("last_filing_date")),

            # ── Financials (0 if missing) ──
            "paid_up_capital":    clean_capital(row.get("paid_up_capital")),

            # ── Email — two flat columns, no nesting ──
            "email_raw":       email_raw,        # original value
            "email_validated": email_validated,  # valid email OR "Unknown"

            # ── Audit ──
            "ingested_at": datetime.utcnow().isoformat(),
        }
        documents.append(doc)

    except Exception as e:
        print(f"Skipped row {idx} due to error: {e}")
        continue

print(f"Cleaned {len(documents)} documents")


# ─────────────────────────────────────────────
# 5. INSERT INTO MONGODB
# ─────────────────────────────────────────────
try:
    if documents:
        result = collection.insert_many(documents)
        print(f"Inserted {len(result.inserted_ids)} documents into MongoDB")
except Exception as e:
    print(f"Insert failed: {e}")
    exit(1)


# ─────────────────────────────────────────────
# 6. CREATE INDEXES
# ─────────────────────────────────────────────
# CIN index SKIPPED as requested.
#
# secondary_key index → acts as secondary primary key
# status, state, combined → for API filter queries
# ─────────────────────────────────────────────
try:
    # Secondary key index — unique lookup when CIN is missing
    collection.create_index(
        [("secondary_key", ASCENDING)],
        name="secondary_key_idx"
    )
    collection.create_index([("status", ASCENDING)], name="status_idx")
    collection.create_index([("state",  ASCENDING)], name="state_idx")
    collection.create_index(
        [("status", ASCENDING), ("state", ASCENDING)],
        name="status_state_idx"
    )
    print("Indexes created:")
    print("   - secondary_key_idx  → secondary_key")
    print("   - status_idx         → status")
    print("   - state_idx          → state")
    print("   - status_state_idx   → (status + state)")
except Exception as e:
    print(f"Index creation warning: {e}")


# ─────────────────────────────────────────────
# 7. SUMMARY STATS
# ─────────────────────────────────────────────
try:
    total                 = collection.count_documents({})
    missing_cin           = collection.count_documents({"cin": "Unknown"})
    missing_secondary_key = collection.count_documents({"secondary_key": "Unknown"})
    missing_company       = collection.count_documents({"company_name": "Unknown"})
    missing_status        = collection.count_documents({"status": "Unknown"})
    missing_state         = collection.count_documents({"state": "Unknown"})
    missing_director_1    = collection.count_documents({"director_1": "Unknown"})
    missing_director_2    = collection.count_documents({"director_2": "Unknown"})
    missing_capital       = collection.count_documents({"paid_up_capital": 0})
    missing_incorporation = collection.count_documents({"incorporation_date": "Unknown"})
    missing_filing        = collection.count_documents({"last_filing_date": "Unknown"})
    invalid_email         = collection.count_documents({"email_validated": "Unknown"})

    print("\nIngestion Summary:")
    print(f"   Total records inserted  : {total}")
    print(f"   Missing CIN             : {missing_cin}")
    print(f"   Missing secondary key   : {missing_secondary_key}")
    print(f"   Missing company name    : {missing_company}")
    print(f"   Missing status          : {missing_status}")
    print(f"   Missing state           : {missing_state}")
    print(f"   Missing director 1      : {missing_director_1}")
    print(f"   Missing director 2      : {missing_director_2}")
    print(f"   Capital = 0 (missing)   : {missing_capital}")
    print(f"   Missing incorporation   : {missing_incorporation}")
    print(f"   Missing filing date     : {missing_filing}")
    print(f"   Invalid emails          : {invalid_email}")
    print("\nIngestion complete!")

except Exception as e:
    print(f"Summary stats error: {e}")
