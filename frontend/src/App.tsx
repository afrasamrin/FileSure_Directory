import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import './App.css';

// ─────────────────────────────────────────────
// TYPES
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
  cin: string;
  secondary_key: string;
  company_name: string;
  status: string;
  state: string;
  director_1: string;
  director_2: string;
  paid_up_capital: number;
  incorporation_date: string;
  last_filing_date: string;
  email_raw: string;
  email_validated: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const API_URL = "http://localhost:5000";

// ─────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    "Active":            "badge-active",
    "Strike Off":        "badge-strike",
    "Struck Off":        "badge-struck",
    "Dormant":           "badge-dormant",
    "Under Liquidation": "badge-liq",
    "Unknown":           "badge-unknown",
  };
  return (
    <span className={`badge ${cls[status] ?? "badge-unknown"}`}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────
// MODAL — GET /companies/:id
// ─────────────────────────────────────────────
function CompanyModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/companies/${companyId}`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => { if (json.success) setCompany(json.data); else throw new Error(json.error); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div
      className="modal-backdrop"
      onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-backdrop")) onClose(); }}
    >
      <div className="modal-box">
        <div className="modal-header">
          <h2>Company Detail</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {loading && <p className="state-msg">Loading...</p>}
        {error   && <p className="state-msg" style={{ color: "#dc2626" }}>Error: {error}</p>}
        {company && (
          <div className="modal-body">
            {([
              ["CIN",                company.cin !== "Unknown" ? company.cin : "—"],
              ["Secondary Key",      company.secondary_key !== "Unknown" ? company.secondary_key : "—"],
              ["Company Name",       company.company_name],
              ["Status",             company.status],
              ["State",              company.state !== "Unknown" ? company.state : "—"],
              ["Director 1",         company.director_1 !== "Unknown" ? company.director_1 : "—"],
              ["Director 2",         company.director_2 !== "Unknown" ? company.director_2 : "—"],
              ["Incorporation Date", company.incorporation_date !== "Unknown" ? company.incorporation_date : "—"],
              ["Last Filing Date",   company.last_filing_date !== "Unknown" ? company.last_filing_date : "—"],
              ["Paid Up Capital",    company.paid_up_capital > 0 ? `₹${company.paid_up_capital.toLocaleString("en-IN")}` : "—"],
              ["Email (Raw)",        company.email_raw !== "Unknown" ? company.email_raw : "—"],
              ["Email (Validated)",  company.email_validated !== "Unknown" ? company.email_validated : "Invalid ⚠️"],
            ] as [string, string][]).map(([label, value]) => (
              <div className="detail-row" key={label}>
                <span className="detail-label">{label}</span>
                <span className={`detail-value ${label === "Email (Validated)" && value === "Invalid ⚠️" ? "email-invalid" : ""}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// useSearchParams — reads & writes the browser URL query string
// When filters change → URL updates automatically
// When user pastes a URL → filters pre-populate automatically
// ─────────────────────────────────────────────
function App() {

  // useSearchParams reads from and writes to the browser URL
  // e.g. localhost:5173/companies?status=Active&state=Maharashtra&page=1&limit=10
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values FROM the URL (so pasting a URL works too)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [stateFilter,  setStateFilter]  = useState(searchParams.get("state")  || "");
  const [page,         setPage]         = useState(Number(searchParams.get("page"))  || 1);
  const [limit,        setLimit]        = useState(Number(searchParams.get("limit")) || 10);

  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [summary,    setSummary]    = useState<SummaryData | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Updates the browser URL bar whenever filters/pagination change ──
  // This is the key function — it writes to the URL
  const updateURL = (p: number, s: string, st: string, l: number) => {
    const params: Record<string, string> = {
      page:  p.toString(),
      limit: l.toString(),
    };
    // Only add to URL if filter has a value — keeps URL clean
    if (s)  params.status = s;
    if (st) params.state  = st;

    // setSearchParams updates the browser address bar
    // e.g. → localhost:5173/companies?status=Active&state=Maharashtra&page=1&limit=10
    setSearchParams(params);
  };

  // ── Fetch companies from backend ──
  const fetchCompanies = async (p: number, s: string, st: string, l: number) => {
    setLoading(true);
    setError(null);

    // Build backend API URL
    const params = new URLSearchParams({ page: p.toString(), limit: l.toString() });
    if (s)  params.append("status", s);
    if (st) params.append("state",  st);

    try {
      const res  = await fetch(`${API_URL}/companies?${params.toString()}`);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const json = await res.json();

      if (json.success) {
        setCompanies(json.data);
        setPagination(json.pagination);
      } else {
        throw new Error(json.error ?? "API error");
      }
    } catch (err: any) {
      setError(err.message);
      setCompanies([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch summary once on mount ──
  useEffect(() => {
    fetch(`${API_URL}/companies/summary`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(json => { if (json.success) setSummary(json.data); })
      .catch(err => console.error("Summary failed:", err));
  }, []);

  // ── Re-fetch whenever URL search params change ──
  // This means: when URL changes (by any method) → data updates
  // Covers: button clicks, browser back/forward, pasting a URL
  useEffect(() => {
    const p  = Number(searchParams.get("page"))  || 1;
    const l  = Number(searchParams.get("limit")) || 10;
    const s  = searchParams.get("status") || "";
    const st = searchParams.get("state")  || "";

    setPage(p);
    setLimit(l);
    setStatusFilter(s);
    setStateFilter(st);

    fetchCompanies(p, s, st, l);
  }, [searchParams]); // fires every time the URL changes

  // ── Apply Filters → update URL → triggers useEffect above ──
  const handleApplyFilters = () => {
    updateURL(1, statusFilter, stateFilter, limit);
  };

  // ── Reset → clear URL params ──
  const handleReset = () => {
    setStatusFilter("");
    setStateFilter("");
    setPage(1);
    setSearchParams({ page: "1", limit: limit.toString() });
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="dashboard-container">

      <header className="main-header">
        <h1>FileSure</h1>
        <span className="subtitle"></span>
      </header>

      <div className="content">

        {/* Summary Cards */}
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

        {/* Filters */}
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
            <label>Per page</label>
            <select value={limit} onChange={e => {
              const newLimit = Number(e.target.value);
              setLimit(newLimit);
              updateURL(1, statusFilter, stateFilter, newLimit);
            }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <button className="btn-primary" onClick={handleApplyFilters}>Apply Filters</button>
          <button className="btn-primary"   onClick={handleReset}>Reset</button>
        </div>

        {/* Error */}
        {error && (
          <div className="error-banner">
            ⚠️ {error} — Make sure backend is running on <code>{API_URL}</code>
          </div>
        )}

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>CIN</th>
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
                <tr><td colSpan={11} className="state-msg">Fetching records...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={11} className="state-msg">No records found.</td></tr>
              ) : (
                companies.map(c => (
                  <tr key={c._id} className="clickable-row" onClick={() => setSelectedId(c._id)} title="Click for details">
                    <td>{c.cin !== "Unknown" ? c.cin : <span className="unknown">—</span>}</td>
                    <td><strong>{c.company_name}</strong></td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{c.state !== "Unknown" ? c.state : <span className="unknown">—</span>}</td>
                    <td>{c.director_1 !== "Unknown" ? c.director_1 : <span className="unknown">—</span>}</td>
                    <td>{c.director_2 !== "Unknown" ? c.director_2 : <span className="unknown">—</span>}</td>
                    <td>{c.paid_up_capital}</td>
                    <td>{c.incorporation_date !== "Unknown" ? c.incorporation_date : <span className="unknown">—</span>}</td>
                    <td>{c.last_filing_date   !== "Unknown" ? c.last_filing_date   : <span className="unknown">—</span>}</td>
                    <td>{c.email_raw !== "Unknown" ? c.email_raw : <span className="unknown">—</span>}</td>
                    <td className={c.email_validated !== "Unknown" ? "email-valid" : "email-invalid"}>
                      {c.email_validated !== "Unknown" ? c.email_validated : "Unknown ⚠️"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination — updates URL on click */}
          <div className="pagination">
            <span>
              {pagination
                ? `Showing ${companies.length} of ${pagination.total} records — Page ${pagination.page} of ${pagination.totalPages}`
                : "Loading..."}
            </span>
            <div className="page-controls">
              <button
                disabled={page <= 1}
                onClick={() => updateURL(page - 1, statusFilter, stateFilter, limit)}
              >
                ← Prev
              </button>
              <button
                disabled={!pagination || page >= pagination.totalPages}
                onClick={() => updateURL(page + 1, statusFilter, stateFilter, limit)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Modal */}
      {selectedId && (
        <CompanyModal companyId={selectedId} onClose={() => setSelectedId(null)} />
      )}

    </div>
  );
}

export default App;
