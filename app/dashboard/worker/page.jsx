'use client'

import { useState, useEffect } from 'react'
import { LogOut, Play, Clock, Camera, Factory, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

/* ─── static data (unchanged) ─────────────────────────────────────── */
const activeStages = [
  { id: 1, stageName: 'Stage 2 — Printing', orderId: 'ORD-0045', status: 'pending' },
  { id: 2, stageName: 'Stage 3 — Cutting',  orderId: 'ORD-0044', status: 'in_progress' },
]

const wasteReasons = ['Damaged material', 'Machine error', 'Operator error', 'Other']
const defectTypes  = ['Printing defect', 'Cutting defect', 'Material tear', 'Size variation', 'Color mismatch', 'Other']

const statusConfig = {
  pending:     { label: 'Pending',     cls: 'badge-pending' },
  in_progress: { label: 'In Progress', cls: 'badge-inprogress' },
  completed:   { label: 'Completed',   cls: 'badge-completed' },
}

/* ─── component ────────────────────────────────────────────────────── */
export default function WorkerMobileDashboard() {
  const [isCheckedIn, setIsCheckedIn]     = useState(false)
  const [checkInTime, setCheckInTime]     = useState(null)
  const [activeStageId, setActiveStageId] = useState(null)
  const [timerSeconds, setTimerSeconds]   = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  const [outputQty,     setOutputQty]     = useState('')
  const [wasteReason,   setWasteReason]   = useState('')
  const [rejectedQty,   setRejectedQty]   = useState('')
  const [defectType,    setDefectType]    = useState('')
  const [notes,         setNotes]         = useState('')
  const [photoUploaded, setPhotoUploaded] = useState(false)

  useEffect(() => {
    let interval = null
    if (isTimerRunning) interval = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [isTimerRunning])

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`

  const handleCheckIn  = () => { setIsCheckedIn(true);  setCheckInTime(new Date()) }
  const handleCheckOut = () => { setIsCheckedIn(false); setCheckInTime(null) }

  const handleStartStage = (id) => {
    setActiveStageId(id); setTimerSeconds(0); setIsTimerRunning(true)
    setOutputQty(''); setWasteReason(''); setRejectedQty(''); setDefectType(''); setNotes(''); setPhotoUploaded(false)
  }

  const handleSubmitStage = () => {
    setIsTimerRunning(false); setActiveStageId(null); setTimerSeconds(0)
  }

  const isFormValid   = outputQty && wasteReason && rejectedQty && defectType
  const activeStageData = activeStages.find(s => s.id === activeStageId)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .wd-root {
          min-height: 100vh;
          background: #f0f4f1;
          font-family: 'DM Sans', sans-serif;
          display: flex; flex-direction: column; align-items: center;
        }

        .wd-shell {
          width: 100%; max-width: 480px;
          min-height: 100vh;
          background: #f0f4f1;
          display: flex; flex-direction: column;
          position: relative;
        }

        /* ── HEADER ── */
        .wd-header {
          background: linear-gradient(135deg, #1e3a5f 0%, #14532d 100%);
          padding: 0 16px;
          position: sticky; top: 0; z-index: 50;
        }
        .wd-header-inner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 0;
        }
        .wd-logo { display: flex; align-items: center; gap: 9px; }
        .wd-logo-icon {
          width: 34px; height: 34px; border-radius: 9px;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.22);
          display: flex; align-items: center; justify-content: center;
        }
        .wd-logo-name {
          font-family: 'DM Serif Display', serif;
          font-size: 18px; color: #fff; letter-spacing: -0.02em;
        }
        .wd-logo-name span { color: #86efac; }
        .wd-right { display: flex; align-items: center; gap: 10px; }
        .wd-username { font-size: 13px; color: rgba(255,255,255,0.75); font-weight: 500; }
        .wd-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: 1.5px solid rgba(255,255,255,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #fff;
        }
        .wd-logout {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 9px;
          width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: rgba(255,255,255,0.85);
          transition: background 0.2s;
        }
        .wd-logout:hover { background: rgba(255,255,255,0.2); }

        /* wave */
        .wd-wave {
          background: linear-gradient(135deg, #1e3a5f 0%, #14532d 100%);
          line-height: 0;
        }
        .wd-wave svg { display: block; }

        /* ── MAIN ── */
        .wd-main {
          flex: 1;
          padding: 20px 16px 40px;
          display: flex; flex-direction: column; gap: 20px;
        }

        /* ── SECTION HEADER ── */
        .sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .sec-title { font-family: 'DM Serif Display', serif; font-size: 19px; color: #0f1a12; }
        .sec-count {
          background: #14532d; color: #bbf7d0;
          font-size: 11px; font-weight: 700;
          border-radius: 20px; padding: 2px 8px;
        }

        /* ── STAGE CARD ── */
        .stage-card {
          background: #fff;
          border-radius: 18px;
          border: 1px solid #e2ede4;
          padding: 16px;
          box-shadow: 0 2px 12px rgba(20,83,45,0.05);
          transition: box-shadow 0.2s, transform 0.15s;
          animation: fadeUp 0.3s ease both;
        }
        .stage-card:nth-child(1) { animation-delay: 0.05s; }
        .stage-card:nth-child(2) { animation-delay: 0.12s; }
        .stage-card:hover { box-shadow: 0 6px 20px rgba(20,83,45,0.1); transform: translateY(-1px); }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .stage-card-top {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 12px;
        }
        .stage-name { font-size: 15px; font-weight: 600; color: #0f1a12; margin-bottom: 3px; }
        .stage-order { font-size: 12px; color: #9bb5a0; }

        .badge {
          padding: 4px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600; white-space: nowrap; flex-shrink: 0;
        }
        .badge-pending     { background: #f1f5f9; color: #64748b; }
        .badge-inprogress  { background: #dbeafe; color: #1d4ed8; }
        .badge-completed   { background: #dcfce7; color: #15803d; }

        .start-btn {
          width: 100%; height: 46px;
          border-radius: 12px; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 14.5px; font-weight: 600; color: #fff;
          background: linear-gradient(135deg, #1e3a5f, #0f2642);
          box-shadow: 0 4px 14px rgba(30,58,95,0.28);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity 0.2s, transform 0.15s;
        }
        .start-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* ── ACTIVE STAGE FORM ── */
        .active-form-card {
          background: #fff;
          border-radius: 20px;
          border: 2px solid #22c55e;
          box-shadow: 0 4px 24px rgba(34,197,94,0.12);
          overflow: hidden;
          animation: slideDown 0.22s ease;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .active-form-header {
          background: linear-gradient(135deg, #1e3a5f 0%, #14532d 100%);
          padding: 16px 18px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .active-form-title {
          font-family: 'DM Serif Display', serif;
          font-size: 17px; color: #fff;
        }
        .active-form-order { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 2px; }

        .timer-pill {
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 30px;
          padding: 8px 14px;
        }
        .timer-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80;
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        .timer-value {
          font-family: 'DM Serif Display', serif;
          font-size: 18px; color: #fff; letter-spacing: 0.05em;
        }

        .active-form-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }

        /* readonly input */
        .readonly-input {
          width: 100%;
          height: 46px;
          background: #f0f4f1;
          border: 1.5px solid #d4e8d8;
          border-radius: 12px;
          padding: 0 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14.5px; color: #4b7060;
          font-weight: 600;
          cursor: not-allowed;
        }

        /* form fields */
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-label {
          font-size: 12px; font-weight: 600; color: #1f2b22;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .form-label .req { color: #22c55e; }

        .form-input, .form-select, .form-textarea {
          width: 100%;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #0f1a12;
          background: #f8fdf9;
          border: 1.5px solid #d4e8d8;
          border-radius: 12px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .form-input   { height: 46px; padding: 0 14px; }
        .form-select  { height: 46px; padding: 0 14px; appearance: none; cursor: pointer; }
        .form-textarea { padding: 12px 14px; resize: none; }
        .form-input::placeholder, .form-textarea::placeholder { color: #9bb5a0; }
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          border-color: #22c55e;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
        }

        .select-wrap { position: relative; }
        .select-chevron {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          pointer-events: none; color: #9bb5a0; font-size: 13px;
        }

        /* two-col grid for qty inputs */
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        /* photo / capture rows */
        .photo-btn {
          width: 100%; height: 46px;
          border-radius: 12px;
          border: 1.5px dashed #d4e8d8;
          background: #f8fdf9; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 500; color: #4b7060;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: border-color 0.2s, background 0.2s;
        }
        .photo-btn:hover { border-color: #22c55e; background: #f0fdf4; }
        .photo-success {
          display: flex; align-items: center; gap: 8px;
          height: 46px; padding: 0 14px;
          border-radius: 12px;
          border: 1.5px solid #bbf7d0;
          background: #f0fdf4;
          font-size: 14px; font-weight: 500; color: #15803d;
        }

        /* section divider */
        .form-divider {
          display: flex; align-items: center; gap: 10px; margin: 2px 0;
        }
        .form-divider-line { flex: 1; height: 1px; background: #e2ede4; }
        .form-divider-label { font-size: 11px; font-weight: 700; color: #9bb5a0; letter-spacing: 0.08em; text-transform: uppercase; }

        /* submit */
        .submit-btn {
          width: 100%; height: 50px;
          border-radius: 12px; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 600; color: #fff;
          background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
          box-shadow: 0 4px 18px rgba(34,197,94,0.35);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(34,197,94,0.45); }
        .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── ATTENDANCE CARD ── */
        .attendance-card {
          background: #fff;
          border-radius: 18px;
          border: 1px solid #e2ede4;
          padding: 18px;
          box-shadow: 0 2px 12px rgba(20,83,45,0.05);
        }
        .checkin-row {
          display: flex; align-items: center; justify-content: space-between;
          background: #f0f4f1; border-radius: 12px;
          padding: 12px 14px; margin-bottom: 14px;
        }
        .checkin-label { font-size: 12px; color: #9bb5a0; margin-bottom: 2px; }
        .checkin-time  { font-family: 'DM Serif Display', serif; font-size: 18px; color: #14532d; }
        .checkin-dot   { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e; animation: pulse 1.4s ease-in-out infinite; }

        .checkin-btn {
          width: 100%; height: 54px;
          border-radius: 14px; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px; font-weight: 700; color: #fff;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .checkin-btn-in {
          background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
          box-shadow: 0 4px 18px rgba(34,197,94,0.35);
        }
        .checkin-btn-out {
          background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
          box-shadow: 0 4px 18px rgba(239,68,68,0.3);
        }
        .checkin-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* ── SUMMARY STRIP ── */
        .summary-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .summary-tile {
          background: #fff; border-radius: 14px;
          border: 1px solid #e2ede4;
          padding: 14px 16px;
          box-shadow: 0 2px 8px rgba(20,83,45,0.04);
        }
        .summary-value {
          font-family: 'DM Serif Display', serif;
          font-size: 24px; color: #14532d; line-height: 1; margin-bottom: 4px;
        }
        .summary-label { font-size: 11px; color: #9bb5a0; font-weight: 500; }
      `}</style>

      <div className="wd-root">
        <div className="wd-shell">

          {/* ── HEADER ── */}
          <header className="wd-header">
            <div className="wd-header-inner">
              <div className="wd-logo">
                <div className="wd-logo-icon">
                  <Factory size={17} color="white" />
                </div>
                <span className="wd-logo-name">Paper<span>Pro</span></span>
              </div>
              <div className="wd-right">
                <span className="wd-username">Mike Wilson</span>
                <div className="wd-avatar">MW</div>
                <button className="wd-logout" aria-label="Log out">
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          </header>
          <div className="wd-wave">
            <svg viewBox="0 0 480 20" preserveAspectRatio="none" width="100%" height="20">
              <path d="M0,0 Q240,20 480,0 L480,20 L0,20 Z" fill="#f0f4f1"/>
            </svg>
          </div>

          {/* ── MAIN ── */}
          <main className="wd-main">

            {/* summary strip */}
            <div className="summary-strip">
              <div className="summary-tile">
                <div className="summary-value">2</div>
                <div className="summary-label">Active Stages</div>
              </div>
              <div className="summary-tile">
                <div className="summary-value">{isCheckedIn ? '✓' : '—'}</div>
                <div className="summary-label">Checked {isCheckedIn ? 'In' : 'Out'}</div>
              </div>
            </div>

            {/* ── ACTIVE STAGE FORM ── */}
            {activeStageId && activeStageData && (
              <div className="active-form-card">
                {/* form header */}
                <div className="active-form-header">
                  <div>
                    <div className="active-form-title">{activeStageData.stageName}</div>
                    <div className="active-form-order">Order: {activeStageData.orderId}</div>
                  </div>
                  <div className="timer-pill">
                    <div className="timer-dot" />
                    <span className="timer-value">{formatTime(timerSeconds)}</span>
                  </div>
                </div>

                <div className="active-form-body">
                  {/* quantities row */}
                  <div className="two-col">
                    <div className="form-field">
                      <label className="form-label">Input Qty</label>
                      <input className="readonly-input" value="1,500" readOnly />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Output Qty <span className="req">*</span></label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="0"
                        value={outputQty}
                        onChange={e => setOutputQty(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* waste */}
                  <div className="form-field">
                    <label className="form-label">Waste Reason <span className="req">*</span></label>
                    <div className="select-wrap">
                      <select className="form-select" value={wasteReason} onChange={e => setWasteReason(e.target.value)}>
                        <option value="">Select reason…</option>
                        {wasteReasons.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className="select-chevron">▾</span>
                    </div>
                  </div>

                  {/* divider */}
                  <div className="form-divider">
                    <div className="form-divider-line" />
                    <span className="form-divider-label">QC Check</span>
                    <div className="form-divider-line" />
                  </div>

                  {/* QC row */}
                  <div className="two-col">
                    <div className="form-field">
                      <label className="form-label">Rejected Qty <span className="req">*</span></label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="0"
                        value={rejectedQty}
                        onChange={e => setRejectedQty(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Defect Type <span className="req">*</span></label>
                      <div className="select-wrap">
                        <select className="form-select" value={defectType} onChange={e => setDefectType(e.target.value)}>
                          <option value="">Select…</option>
                          {defectTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="select-chevron">▾</span>
                      </div>
                    </div>
                  </div>

                  {/* notes */}
                  <div className="form-field">
                    <label className="form-label">Notes <span style={{color:'#9bb5a0',fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      placeholder="Any additional remarks…"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* photo */}
                  <div className="form-field">
                    <label className="form-label">Photo</label>
                    {photoUploaded ? (
                      <div className="photo-success">
                        <CheckCircle2 size={16} color="#15803d" />
                        Photo uploaded successfully
                      </div>
                    ) : (
                      <button className="photo-btn" onClick={() => setPhotoUploaded(true)}>
                        <Camera size={16} />
                        Upload Photo
                      </button>
                    )}
                  </div>

                  {/* submit */}
                  <button className="submit-btn" disabled={!isFormValid} onClick={handleSubmitStage}>
                    Submit Stage
                  </button>
                </div>
              </div>
            )}

            {/* ── STAGE LIST ── */}
            {!activeStageId && (
              <section>
                <div className="sec-head">
                  <span className="sec-title">My Active Stages</span>
                  <span className="sec-count">{activeStages.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeStages.map(stage => (
                    <div key={stage.id} className="stage-card">
                      <div className="stage-card-top">
                        <div>
                          <div className="stage-name">{stage.stageName}</div>
                          <div className="stage-order">Order: {stage.orderId}</div>
                        </div>
                        <span className={`badge ${statusConfig[stage.status].cls}`}>
                          {statusConfig[stage.status].label}
                        </span>
                      </div>
                      <button className="start-btn" onClick={() => handleStartStage(stage.id)}>
                        <Play size={15} fill="white" />
                        Start Stage
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── ATTENDANCE ── */}
            <section>
              <div className="sec-head">
                <span className="sec-title">Attendance</span>
              </div>
              <div className="attendance-card">
                {isCheckedIn && (
                  <div className="checkin-row">
                    <div>
                      <div className="checkin-label">Checked in at</div>
                      <div className="checkin-time">
                        {checkInTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="checkin-dot" />
                  </div>
                )}
                <button
                  className={`checkin-btn ${isCheckedIn ? 'checkin-btn-out' : 'checkin-btn-in'}`}
                  onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                >
                  {isCheckedIn ? 'Check Out' : 'Check In'}
                </button>
              </div>
            </section>

          </main>
        </div>
      </div>
    </>
  )
}
