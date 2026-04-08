/**
 * routes.js — All API endpoints
 * Updated to reflect flat email schema (email_raw, email_validated)
 * and secondary_key field replacing cin_valid
 *
 * Index usage:
 *  status_state_idx  → GET / with both status + state filters
 *  status_idx        → GET / with status-only filter; /summary $group
 *  state_idx         → GET / with state-only filter
 *  secondary_key_idx → (available for future /:secondary_key lookup route)
 *  _id (auto)        → GET /:id
 */

import express from 'express';
import Company from './Company.js';
const router = express.Router();

// Shared collation — matches the collation on all three indexes (case-insensitive, English locale).
// Must be identical to the collation used when the indexes were created, otherwise MongoDB
// will ignore the index and fall back to a collection scan.
const CI_COLLATION = { locale: "en", strength: 2 };


// ─────────────────────────────────────────────
// GET /companies
// All companies with pagination + optional filters
// Query: ?status=Active&state=Maharashtra&page=1&limit=10
//
// Index routing:
//   status + state  → status_state_idx  (compound, most selective)
//   status only     → status_idx
//   state only      → state_idx
//   no filter       → status_state_idx used as a safe default for ordered scan;
//                     swap to a natural-order hint if insertion order matters more
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status, state, page = 1, limit = 10 } = req.query;

    // Build an exact-match filter (no regex).
    // The collation on the index + query handles case-insensitivity,
    // so "active", "Active", and "ACTIVE" all resolve correctly.
    const filter = {};
    if (status) filter.status = status;
    if (state)  filter.state  = state;

    const pageNum  = parseInt(page);
    const limitNum = parseInt(limit);
    const skip     = (pageNum - 1) * limitNum;

    // Pick the tightest index for the active filter combination.
    const hint = (status && state) ? "status_state_idx"
               : status            ? "status_idx"
               : state             ? "state_idx"
               :                    "status_state_idx"; // full scan ordered by status → state

    const [companies, total] = await Promise.all([
      Company.find(filter)
        .collation(CI_COLLATION)  // must match index collation for index to be used
        .hint(hint)
        .skip(skip)
        .limit(limitNum)
        .lean(),

      // countDocuments also needs the collation + hint to avoid a separate full scan
      Company.countDocuments(filter)
        .collation(CI_COLLATION)
        .hint(hint),
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
//
// Index routing:
//   $group  by status → status_idx     (tight single-field index, no state overhead)
//   count   by status → status_idx     (same)
//   total count       → _id (fast countDocuments with no filter)
//   email_validated   → collection scan (no index on this field — acceptable for
//                        an infrequent summary call; add an index if this becomes slow)
// ─────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const [byStatus, total, invalidEmails, missingCin] = await Promise.all([

      // hint() on aggregate uses the index for the $group scan
      Company.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]).hint("status_idx"),    // drives the collection scan through the status index

      Company.countDocuments({}), // no filter → MongoDB uses _id index internally

      // email_validated and cin have no dedicated index — acceptable for a summary endpoint.
      // If these counts become slow, add: { email_validated: 1 } and { cin: 1 } indexes.
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
//
// Index routing: _id (automatic, no hint needed)
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