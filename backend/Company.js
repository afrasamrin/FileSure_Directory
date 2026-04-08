import { Schema, model } from "mongoose";

/**
 * Company Schema
 *
 * Changes made:
 * 1. Removed cin_valid column — not needed
 * 2. Added secondary_key field (company_name + incorporation_date combined)
 *    → acts as a secondary primary key when CIN is missing
 * 3. Flattened email — removed nested object, now two separate flat columns:
 *    - email_raw:       original email as-is from CSV
 *    - email_validated: cleaned valid email OR "Unknown" if invalid
 */

const CompanySchema = new Schema(
  {
    // ── Primary Identifier ──
    cin: { type: String, default: "Unknown" },

    // ── Secondary Key ──
    // Combination of company_name + incorporation_date
    // Uniquely identifies a company when CIN is missing
    // Format: "Bharat Fintech Pvt Ltd|15-03-2019"
    secondary_key: { type: String, default: "Unknown" },

    // ── Company Info ──
    company_name:      { type: String, default: "Unknown" },
    status:            { type: String, default: "Unknown" }, // "Active" / "Strike Off" / "Under Liq." / "Unknown"
    state:             { type: String, default: "Unknown" },
    director_1:        { type: String, default: "Unknown" },
    director_2:        { type: String, default: "Unknown" },
    incorporation_date:{ type: String, default: "Unknown" },
    last_filing_date:  { type: String, default: "Unknown" },

    // ── Financials ──
    paid_up_capital: { type: Number, default: 0 },

    // ── Email — two flat columns, no nesting ──
    // email_raw:       exactly what came from the CSV
    // email_validated: valid email value, OR "Unknown" if email failed validation
    email_raw:       { type: String, default: "Unknown" },
    email_validated: { type: String, default: "Unknown" },

    // ── Audit ──
    ingested_at: { type: String },
  },
  {
    timestamps: false,
    collection: "companies",
  }
);

export default model("Company", CompanySchema);
