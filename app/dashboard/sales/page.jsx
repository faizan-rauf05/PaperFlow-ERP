'use client'

import { useState } from 'react'
import { 
  LogOut, 
  MapPin, 
  Camera,
  Clock,
  Plus,
  X,
  FileText,
  CheckCircle2,
  TrendingUp,
  Loader2
} from 'lucide-react'

/* ─── static data (unchanged) ─────────────────────────────────────── */
const recentVisits = [
  { id: 1, customer: 'MegaMart Retail',   time: 'Today, 10:30 AM',    outcome: 'deal',       notes: 'Closed bulk order for 50,000 bags' },
  { id: 2, customer: 'Green Grocers Ltd', time: 'Today, 9:15 AM',     outcome: 'followup',   notes: 'Interested in eco-friendly line' },
  { id: 3, customer: 'Fashion Hub Store', time: 'Yesterday, 4:00 PM', outcome: 'noresponse', notes: 'Manager not available' },
]

const quotations = [
  { id: 'QT-2024-045', customer: 'Premium Retailers Co', amount: 185000, status: 'pending'  },
  { id: 'QT-2024-044', customer: 'EcoStore Chain',        amount:  92500, status: 'approved' },
]

const customers = [
  { id: 1, name: 'MegaMart Retail' },
  { id: 2, name: 'Green Grocers Ltd' },
  { id: 3, name: 'Fashion Hub Store' },
  { id: 4, name: 'Premium Retailers Co' },
  { id: 5, name: 'EcoStore Chain' },
  { id: 6, name: 'QuickShop Express' },
]

const outcomeConfig = {
  deal:       { label: 'Deal',        cls: 'badge-deal' },
  followup:   { label: 'Follow-up',   cls: 'badge-followup' },
  noresponse: { label: 'No Response', cls: 'badge-noresponse' },
  other:      { label: 'Other',       cls: 'badge-other' },
}

const quoteStatusConfig = {
  pending:  { label: 'Pending',  cls: 'qs-pending'  },
  approved: { label: 'Approved', cls: 'qs-approved' },
  rejected: { label: 'Rejected', cls: 'qs-rejected' },
  draft:    { label: 'Draft',    cls: 'qs-draft'    },
}

/* ─── component ────────────────────────────────────────────────────── */
export default function SalesDashboard() {
  const [showVisitForm, setShowVisitForm]         = useState(false)
  const [location, setLocation]                   = useState(null)
  const [isCapturingLocation, setIsCapturingLocation] = useState(false)
  const [photoUploaded, setPhotoUploaded]         = useState(false)
  const [formData, setFormData]                   = useState({ customer: '', outcome: '', notes: '' })

  const handleCaptureLocation = () => {
    setIsCapturingLocation(true)
    setTimeout(() => {
      setLocation({ lat: '31.5204', lng: '74.3587' })
      setIsCapturingLocation(false)
    }, 1500)
  }

  const handlePhotoUpload  = () => setPhotoUploaded(true)

  const handleSubmit = () => {
    setShowVisitForm(false)
    setFormData({ customer: '', outcome: '', notes: '' })
    setLocation(null)
    setPhotoUploaded(false)
  }

  const isFormValid = formData.customer && formData.outcome

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sd-root {
          min-height: 100vh;
          background: #f0f4f1;
          font-family: 'DM Sans', sans-serif;
          color: #0f1a12;
        }

        /* ── HEADER ── */
        .sd-header {
          background: linear-gradient(135deg, #1e3a5f 0%, #14532d 100%);
          position: sticky; top: 0; z-index: 50;
          padding: 0 16px;
        }
        .sd-header-inner {
          max-width: 480px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 0;
        }
        .sd-avatar {
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: 2px solid rgba(255,255,255,0.25);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #fff;
          margin-right: 10px; flex-shrink: 0;
        }
        .sd-user-name { font-size: 15px; font-weight: 600; color: #fff; line-height: 1.2; }
        .sd-user-role { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 1px; }
        .sd-logout-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 10px;
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: rgba(255,255,255,0.85);
          transition: background 0.2s;
        }
        .sd-logout-btn:hover { background: rgba(255,255,255,0.2); }

        /* header bottom wave */
        .sd-header-wave {
          height: 20px; overflow: hidden; line-height: 0;
          background: linear-gradient(135deg, #1e3a5f 0%, #14532d 100%);
        }
        .sd-header-wave svg { display: block; }

        /* ── MAIN ── */
        .sd-main {
          max-width: 480px; margin: 0 auto;
          padding: 20px 16px 40px;
          display: flex; flex-direction: column; gap: 20px;
        }

        /* ── LOG VISIT BUTTON ── */
        .log-visit-btn {
          width: 100%;
          padding: 16px;
          border-radius: 16px;
          border: none; cursor: pointer;
          background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 18px rgba(34,197,94,0.35);
          transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
        }
        .log-visit-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(34,197,94,0.45); }
        .log-visit-btn:active { transform: translateY(0); }

        /* ── VISIT FORM CARD ── */
        .form-card {
          background: #fff;
          border-radius: 20px;
          border: 1.5px solid #d4e8d8;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(20,83,45,0.08);
          animation: slideDown 0.22s ease;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .form-card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 0;
        }
        .form-card-title {
          font-family: 'DM Serif Display', serif;
          font-size: 18px; color: #14532d;
        }
        .form-close-btn {
          background: #f0f4f1; border: none; border-radius: 8px;
          width: 30px; height: 30px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #6b7a6e; transition: background 0.2s, color 0.2s;
        }
        .form-close-btn:hover { background: #fee2e2; color: #dc2626; }

        .form-body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 14px; }

        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-label {
          font-size: 12px; font-weight: 600; color: #1f2b22;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .form-label span { color: #22c55e; }

        .form-select, .form-textarea {
          width: 100%;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #0f1a12;
          background: #f8fdf9;
          border: 1.5px solid #d4e8d8;
          border-radius: 12px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .form-select { height: 46px; padding: 0 14px; appearance: none; cursor: pointer; }
        .form-textarea { padding: 12px 14px; resize: none; }
        .form-select:focus, .form-textarea:focus {
          border-color: #22c55e;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
        }
        .form-select::placeholder, .form-textarea::placeholder { color: #9bb5a0; }

        .select-wrap { position: relative; }
        .select-chevron {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          pointer-events: none; color: #9bb5a0;
        }

        /* location / photo rows */
        .capture-row {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1.5px solid #d4e8d8;
          background: #f8fdf9;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          font-size: 14px; color: #4b7060; font-weight: 500;
        }
        .capture-row:hover { border-color: #22c55e; background: #f0fdf4; }
        .capture-row:disabled { opacity: 0.55; cursor: not-allowed; }
        .capture-success {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1.5px solid #bbf7d0;
          background: #f0fdf4;
          font-size: 14px; color: #15803d; font-weight: 500;
        }

        /* submit */
        .form-submit {
          width: 100%; height: 48px;
          border-radius: 12px; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 14.5px; font-weight: 600; color: #fff;
          background: linear-gradient(135deg, #1e3a5f, #0f2642);
          box-shadow: 0 4px 16px rgba(30,58,95,0.3);
          transition: opacity 0.2s, transform 0.15s;
        }
        .form-submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .form-submit:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── SECTION HEADER ── */
        .section-head {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 2px;
        }
        .section-title {
          font-family: 'DM Serif Display', serif;
          font-size: 19px; color: #0f1a12;
        }
        .section-count {
          background: #14532d; color: #bbf7d0;
          font-size: 11px; font-weight: 700;
          border-radius: 20px; padding: 2px 8px;
        }

        /* ── VISIT CARD ── */
        .visit-card {
          background: #fff;
          border-radius: 18px;
          border: 1px solid #e2ede4;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(20,83,45,0.05);
          transition: box-shadow 0.2s, transform 0.15s;
          animation: fadeUp 0.3s ease both;
        }
        .visit-card:hover { box-shadow: 0 6px 20px rgba(20,83,45,0.1); transform: translateY(-1px); }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .visit-card:nth-child(1) { animation-delay: 0.05s; }
        .visit-card:nth-child(2) { animation-delay: 0.1s; }
        .visit-card:nth-child(3) { animation-delay: 0.15s; }

        .visit-top {
          display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;
        }
        .visit-customer { font-size: 15px; font-weight: 600; color: #0f1a12; }
        .visit-time {
          display: flex; align-items: center; gap: 4px;
          font-size: 11.5px; color: #9bb5a0; margin-bottom: 8px;
        }
        .visit-notes { font-size: 13px; color: #4b7060; line-height: 1.5; }

        /* left accent bar */
        .visit-card-inner { display: flex; gap: 12px; }
        .visit-accent-bar {
          width: 3px; border-radius: 4px; flex-shrink: 0; align-self: stretch;
        }
        .accent-deal       { background: linear-gradient(to bottom, #22c55e, #15803d); }
        .accent-followup   { background: linear-gradient(to bottom, #f59e0b, #d97706); }
        .accent-noresponse { background: #cbd5e1; }
        .accent-other      { background: linear-gradient(to bottom, #3b82f6, #1d4ed8); }

        /* ── BADGES ── */
        .badge {
          padding: 4px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600; white-space: nowrap;
          flex-shrink: 0;
        }
        .badge-deal       { background: #dcfce7; color: #15803d; }
        .badge-followup   { background: #fef3c7; color: #b45309; }
        .badge-noresponse { background: #f1f5f9; color: #64748b; }
        .badge-other      { background: #dbeafe; color: #1d4ed8; }

        /* ── QUOTE CARD ── */
        .quote-card {
          background: #fff;
          border-radius: 18px;
          border: 1px solid #e2ede4;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(20,83,45,0.05);
          transition: box-shadow 0.2s, transform 0.15s;
          animation: fadeUp 0.3s ease both;
        }
        .quote-card:hover { box-shadow: 0 6px 20px rgba(20,83,45,0.1); transform: translateY(-1px); }
        .quote-card:nth-child(1) { animation-delay: 0.05s; }
        .quote-card:nth-child(2) { animation-delay: 0.1s; }

        .quote-top {
          display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px;
        }
        .quote-id { font-size: 11px; color: #9bb5a0; font-weight: 500; margin-bottom: 2px; }
        .quote-customer { font-size: 15px; font-weight: 600; color: #0f1a12; }
        .quote-bottom {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid #f0f4f1;
        }
        .quote-amount {
          font-family: 'DM Serif Display', serif;
          font-size: 20px; color: #14532d; line-height: 1;
        }
        .quote-currency { font-size: 11px; color: #9bb5a0; font-weight: 500; margin-bottom: 2px; }
        .quote-view-btn {
          display: flex; align-items: center; gap: 5px;
          background: #f0f4f1; border: none; border-radius: 10px;
          padding: 8px 14px; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500; color: #1e3a5f;
          transition: background 0.2s, color 0.2s;
        }
        .quote-view-btn:hover { background: #dbeafe; color: #1d4ed8; }

        .qs-pending  { background: #fef3c7; color: #b45309; }
        .qs-approved { background: #dcfce7; color: #15803d; }
        .qs-rejected { background: #fee2e2; color: #dc2626; }
        .qs-draft    { background: #f1f5f9; color: #64748b; }

        /* ── SUMMARY STRIP ── */
        .summary-strip {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 10px; margin-bottom: 4px;
        }
        .summary-tile {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e2ede4;
          padding: 14px 12px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(20,83,45,0.04);
        }
        .summary-value {
          font-family: 'DM Serif Display', serif;
          font-size: 22px; color: #14532d; line-height: 1;
          margin-bottom: 4px;
        }
        .summary-label { font-size: 11px; color: #9bb5a0; font-weight: 500; }
      `}</style>

      <div className="sd-root">

        {/* ── HEADER ── */}
        <header className="sd-header">
          <div className="sd-header-inner">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="sd-avatar">ED</div>
              <div>
                <div className="sd-user-name">Emily Davis</div>
                <div className="sd-user-role">Sales Representative</div>
              </div>
            </div>
            <button className="sd-logout-btn" aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        {/* wave */}
        <div className="sd-header-wave">
          <svg viewBox="0 0 480 20" preserveAspectRatio="none" width="100%" height="20">
            <path d="M0,0 Q240,20 480,0 L480,20 L0,20 Z" fill="#f0f4f1"/>
          </svg>
        </div>

        {/* ── MAIN ── */}
        <main className="sd-main">

          {/* summary strip */}
          <div className="summary-strip">
            <div className="summary-tile">
              <div className="summary-value">3</div>
              <div className="summary-label">Visits Today</div>
            </div>
            <div className="summary-tile">
              <div className="summary-value">1</div>
              <div className="summary-label">Deals Closed</div>
            </div>
            <div className="summary-tile">
              <div className="summary-value">2</div>
              <div className="summary-label">Quotations</div>
            </div>
          </div>

          {/* LOG VISIT BUTTON */}
          {!showVisitForm && (
            <button className="log-visit-btn" onClick={() => setShowVisitForm(true)}>
              <Plus size={18} />
              Log a Visit
            </button>
          )}

          {/* VISIT FORM */}
          {showVisitForm && (
            <div className="form-card">
              <div className="form-card-header">
                <span className="form-card-title">Log a Visit</span>
                <button className="form-close-btn" onClick={() => setShowVisitForm(false)}>
                  <X size={15} />
                </button>
              </div>

              <div className="form-body">
                {/* Customer */}
                <div className="form-field">
                  <label className="form-label">Customer <span>*</span></label>
                  <div className="select-wrap">
                    <select
                      className="form-select"
                      value={formData.customer}
                      onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    >
                      <option value="">Select customer…</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <span className="select-chevron">▾</span>
                  </div>
                </div>

                {/* Outcome */}
                <div className="form-field">
                  <label className="form-label">Outcome <span>*</span></label>
                  <div className="select-wrap">
                    <select
                      className="form-select"
                      value={formData.outcome}
                      onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                    >
                      <option value="">Select outcome…</option>
                      <option value="deal">Deal</option>
                      <option value="followup">Follow-up</option>
                      <option value="noresponse">No Response</option>
                      <option value="other">Other</option>
                    </select>
                    <span className="select-chevron">▾</span>
                  </div>
                </div>

                {/* Notes */}
                <div className="form-field">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Add visit notes…"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                {/* Location */}
                <div className="form-field">
                  <label className="form-label">Location</label>
                  {location ? (
                    <div className="capture-success">
                      <CheckCircle2 size={16} color="#15803d" />
                      Lat: {location.lat}, Lng: {location.lng}
                    </div>
                  ) : (
                    <button
                      className="capture-row"
                      onClick={handleCaptureLocation}
                      disabled={isCapturingLocation}
                    >
                      {isCapturingLocation
                        ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                        : <MapPin size={16} />}
                      {isCapturingLocation ? 'Capturing location…' : 'Capture Location'}
                    </button>
                  )}
                </div>

                {/* Photo */}
                <div className="form-field">
                  <label className="form-label">Photo</label>
                  {photoUploaded ? (
                    <div className="capture-success">
                      <CheckCircle2 size={16} color="#15803d" />
                      Photo uploaded successfully
                    </div>
                  ) : (
                    <button className="capture-row" onClick={handlePhotoUpload}>
                      <Camera size={16} />
                      Upload Photo
                    </button>
                  )}
                </div>

                {/* Submit */}
                <button
                  className="form-submit"
                  onClick={handleSubmit}
                  disabled={!isFormValid}
                >
                  Submit Visit
                </button>
              </div>
            </div>
          )}

          {/* RECENT VISITS */}
          <div>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <span className="section-title">Recent Visits</span>
              <span className="section-count">{recentVisits.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentVisits.map(visit => (
                <div key={visit.id} className="visit-card">
                  <div className="visit-card-inner">
                    <div className={`visit-accent-bar accent-${visit.outcome}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="visit-top">
                        <span className="visit-customer">{visit.customer}</span>
                        <span className={`badge ${outcomeConfig[visit.outcome].cls}`}>
                          {outcomeConfig[visit.outcome].label}
                        </span>
                      </div>
                      <div className="visit-time">
                        <Clock size={11} />
                        {visit.time}
                      </div>
                      <p className="visit-notes">{visit.notes}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MY QUOTATIONS */}
          <div>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <span className="section-title">My Quotations</span>
              <span className="section-count">{quotations.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {quotations.map(quote => (
                <div key={quote.id} className="quote-card">
                  <div className="quote-top">
                    <div>
                      <div className="quote-id">{quote.id}</div>
                      <div className="quote-customer">{quote.customer}</div>
                    </div>
                    <span className={`badge ${quoteStatusConfig[quote.status].cls}`}>
                      {quoteStatusConfig[quote.status].label}
                    </span>
                  </div>
                  <div className="quote-bottom">
                    <div>
                      <div className="quote-currency">PKR</div>
                      <div className="quote-amount">{quote.amount.toLocaleString()}</div>
                    </div>
                    <button className="quote-view-btn">
                      <FileText size={14} />
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
