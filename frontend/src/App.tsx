import { useState, useEffect } from 'react';
import './App.css';

// ─────────────────────────────────────────────
// TYPES
// Matches the flat schema — no nested email object
// secondary_key added to Company interface
// ─────────────────────────────────────────────
interface SummaryData {
  by_status: { status: string; count: number }[];
  data_quality: {
    total_records: number;
    invalid_emails: number;
    missing_cin: number;
  };
}

interface Company {
  _id: string;
  cin:            string;
  secondary_key:  string;   // company_name|incorporation_date
  company_name:   string;
  status:         string;
  state:          string;
  director_1:     string;
  director_2:     string;
  paid_up_capital: number;
  incorporation_date: string;
  last_filing_date:   string;
  email_raw:       string;  // original email from CSV
  email_validated: string;  // valid email OR "Unknown"
}

interface Pagination {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ─────────────────────────────────────────────
// CONSTANTS
// Change API_URL here if your backend runs on a different port
// ─────────────────────────────────────────────
const API_URL = "http://localhost:5000";

// ─────────────────────────────────────────────
// STATUS BADGE HELPER
// Maps status string to CSS class
// Add more statuses here if needed
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    "Active":     "badge-active",
    "Strike Off": "badge-strike",
    "Struck Off": "badge-struck",
    "Dormant":   "badge-dormant",
    "Under Liquidation": "badge-liq",
    "Unknown":    "badge-unknown",
  };
  return (
    <span className={`badge ${cls[status] ?? "badge-unknown"}`}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
function App() {

  // ── State ──
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [summary,      setSummary]      = useState<SummaryData | null>(null);
  const [pagination,   setPagination]   = useState<Pagination | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [page,         setPage]         = useState(1);
  const [limit,        setLimit]        = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [stateFilter,  setStateFilter]  = useState("");

  // ── Fetch Summary once on mount ──
  useEffect(() => {
    fetch(`${API_URL}/companies/summary`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (json.success) setSummary(json.data);
      })
      .catch(err => console.error("Summary fetch failed:", err));
  }, []);

  // ── Fetch Companies ──
  // Runs on mount AND whenever page or limit changes
  // handleApplyFilters resets page to 1 and calls this manually
  const fetchCompanies = async (targetPage = page) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page:  targetPage.toString(),
      limit: limit.toString(),
      ...(statusFilter && { status: statusFilter }),
      ...(stateFilter  && { state:  stateFilter  }),
    });

    try {
      const res = await fetch(`${API_URL}/companies?${params}`);
      if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
      const json = await res.json();

      if (json.success) {
        setCompanies(json.data);
        setPagination(json.pagination);
      } else {
        throw new Error(json.error ?? "Unknown API error");
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load companies");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  // Runs automatically when page or limit changes
  useEffect(() => {
    fetchCompanies(page);
  }, [page, limit]);

  // Apply filters — resets to page 1
  const handleApplyFilters = () => {
    setPage(1);
    fetchCompanies(1);
  };

  // Reset all filters
  const handleReset = () => {
    setStatusFilter("");
    setStateFilter("");
    setPage(1);
    fetchCompanies(1);
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="dashboard-container">

      {/* Header */}
      <header className="main-header">
        <h1>FileSure</h1>
        <span className="subtitle"></span>
      </header>

      <div className="content">

        {/* ── Summary Cards ── */}
        <div className="summary-grid">
          {summary ? (
            <>
              {summary.by_status.map((s, i) => (
                <div key={i} className="card">
                  <div className="number">{s.count}</div>
                  <div className="label">{s.status}</div>
                </div>
              ))}
              <div className="card highlight-blue">
                <div className="number">{summary.data_quality.total_records}</div>
                <div className="label">Total Records</div>
              </div>
              <div className="card highlight-red">
                <div className="number">{summary.data_quality.invalid_emails}</div>
                <div className="label">Invalid Emails</div>
              </div>
              <div className="card highlight-orange">
                <div className="number">{summary.data_quality.missing_cin}</div>
                <div className="label">Missing CIN</div>
              </div>
            </>
          ) : (
            <div className="card"><div className="label">Loading summary...</div></div>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="filters-panel">
          <div className="filter-group">
            <label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Strike Off">Strike Off</option>
              <option value="Struck Off">Struck Off</option>
              <option value="Dormant">Dormant</option>
              <option value="Under Liquidation">Under Liquidation</option>
            </select>
          </div>

          <div className="filter-group">
            <label>State</label>
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              <option value="">All States</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Delhi">Delhi</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Rajasthan">Rajasthan</option>
              <option value="Andhra Pradesh">Andhra Pradesh</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Records per page</label>
            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <button className="btn-primary" onClick={handleApplyFilters}>Apply Filters</button>
          <button className="btn-primary"   onClick={handleReset}>Reset</button>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="error-banner">
            ⚠️ {error} — Make sure the backend is running on <code>{API_URL}</code>
          </div>
        )}

        {/* ── Table ── */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>CIN</th>
                <th>Secondary Key</th>
                <th>Company Name</th>
                <th>Status</th>
                <th>State</th>
                <th>Director 1</th>
                <th>Director 2</th>
                <th>Paid Up Capital</th>
                <th>Incorporation Date</th>
                <th>Last Filing</th>
                <th>Email (Raw)</th>
                <th>Email (Validated)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="state-msg">Fetching records...</td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={12} className="state-msg">No records found for selected filters.</td>
                </tr>
              ) : (
                companies.map(c => (
                  <tr key={c._id}>
                    {/* CIN — show "—" if Unknown */}
                    <td>{c.cin !== "Unknown" ? c.cin : <span className="unknown">—</span>}</td>

                    {/* Secondary key — shows company_name|incorporation_date */}
                    <td className="secondary-key">{c.secondary_key !== "Unknown" ? c.secondary_key : <span className="unknown">—</span>}</td>

                    <td><strong>{c.company_name}</strong></td>

                    <td><StatusBadge status={c.status} /></td>

                    <td>{c.state !== "Unknown" ? c.state : <span className="unknown">—</span>}</td>

                    <td>{c.director_1 !== "Unknown" ? c.director_1 : <span className="unknown">—</span>}</td>

                    <td>{c.director_2 !== "Unknown" ? c.director_2 : <span className="unknown">—</span>}</td>

                    {/* Capital — formatted in Indian number system */}
                    <td>
                      {c.paid_up_capital > 0
                        ? `₹${c.paid_up_capital.toLocaleString("en-IN")}`
                        : <span className="unknown">—</span>}
                    </td>

                    <td>{c.incorporation_date !== "Unknown" ? c.incorporation_date : <span className="unknown">—</span>}</td>
                    <td>{c.last_filing_date   !== "Unknown" ? c.last_filing_date   : <span className="unknown">—</span>}</td>

                    {/* email_raw — always shown as-is */}
                    <td className="email-raw">
                      {c.email_raw !== "Unknown" ? c.email_raw : <span className="unknown">—</span>}
                    </td>

                    {/* email_validated — valid email OR "Unknown" highlighted red */}
                    <td className={c.email_validated !== "Unknown" ? "email-valid" : "email-invalid"}>
                      {c.email_validated !== "Unknown" ? c.email_validated : "Unknown ⚠️"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* ── Pagination ── */}
          <div className="pagination">
            <span>
              {pagination
                ? `Showing ${companies.length} of ${pagination.total} records : Page ${pagination.page} of ${pagination.totalPages}`
                : "Loading..."}
            </span>
            <div className="page-controls">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <button
                disabled={!pagination || page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
