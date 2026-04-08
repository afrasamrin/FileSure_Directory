/**
 * routes.js — All API endpoints
 * Updated to reflect flat email schema (email_raw, email_validated)
 * and secondary_key field replacing cin_valid
 */

import express from 'express';
import Company from './Company.js';  
const router = express.Router();
// ─────────────────────────────────────────────
// GET /companies
// All companies with pagination + optional filters
// Query: ?status=Active&state=Maharashtra&page=1&limit=10
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status, state, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = { $regex: new RegExp(`^${status}$`, "i") };
    if (state)  filter.state  = { $regex: new RegExp(`^${state}$`,  "i") };

    const pageNum  = parseInt(page);
    const limitNum = parseInt(limit);
    const skip     = (pageNum - 1) * limitNum;

    const [companies, total] = await Promise.all([
      Company.find(filter).skip(skip).limit(limitNum).lean(),
      Company.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: companies,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch companies", details: error.message });
  }
});


// ─────────────────────────────────────────────
// GET /companies/summary
// MUST be defined before /:id — otherwise "summary"
// gets treated as a MongoDB _id parameter
// ─────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const [byStatus, total, invalidEmails, missingCin] = await Promise.all([
      Company.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),
      Company.countDocuments({}),
      // Invalid emails: email_validated is "Unknown" (flat field, no nesting)
      Company.countDocuments({ email_validated: "Unknown" }),
      Company.countDocuments({ cin: "Unknown" }),
    ]);

    res.json({
      success: true,
      data: {
        by_status: byStatus.map(s => ({ status: s._id, count: s.count })),
        data_quality: {
          total_records:  total,
          invalid_emails: invalidEmails,
          missing_cin:    missingCin,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch summary", details: error.message });
  }
});


// ─────────────────────────────────────────────
// GET /companies/:id
// Single company by MongoDB _id
// ─────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) {
      return res.status(404).json({ success: false, error: "Company not found" });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, error: "Invalid company ID format" });
    }
    res.status(500).json({ success: false, error: "Failed to fetch company", details: error.message });
  }
});

export default router;
