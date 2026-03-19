import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../../components/admin/AdminShell'
import { useAuth } from '../../context/AuthContext'
import { createAdminAccount } from '../../services/authService'

function calcStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' }
  let s = 0
  if (pw.length >= 8)          s++
  if (/[A-Z]/.test(pw))        s++
  if (/[0-9]/.test(pw))        s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const lvls = [
    { score: 1, label: 'Weak',   color: '#dc2626' },
    { score: 2, label: 'Fair',   color: '#d97706' },
    { score: 3, label: 'Good',   color: '#059669' },
    { score: 4, label: 'Strong', color: '#1a56db' },
  ]
  return lvls.find(l => l.score >= s) ?? lvls[3]
}

export default function AdminSignup() {
  const navigate   = useNavigate()
  const { role }   = useAuth()
  const mountedRef = useRef(true)

  const [email,     setEmail]     = useState('')
  const [fullName,  setFullName]  = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [adminRole, setAdminRole] = useState('election_officer')
  const [showPw,    setShowPw]    = useState(false)
  const [showCf,    setShowCf]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  const strength = useMemo(() => calcStrength(password), [password])
  const pwMatch  = !confirm || password === confirm

  /* Only super_admins can reach this page */
  if (role !== 'super_admin') {
    return (
      <AdminShell title="Create Admin Account" subtitle="Restricted to Super Administrators">
        <div style={st.denied}>
          <span style={{ fontSize: '2.5rem' }}>🔒</span>
          <h2 style={st.deniedTitle}>Super Admin access required</h2>
          <p  style={st.deniedSub}>Only Super Administrators can create new admin accounts.</p>
          <button style={st.backBtn} onClick={() => navigate('/admin')}>← Back to Dashboard</button>
        </div>
      </AdminShell>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (!email.trim())          { setError('Email address is required.'); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address.'); return }
    if (!fullName.trim())       { setError('Full name is required.'); return }
    if (password.length < 8)    { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm)   { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const result = await createAdminAccount({
        email:    email.trim(),
        password,
        fullName: fullName.trim(),
        role:     adminRole,
      })

      if (!mountedRef.current) return

      if (!result.success) {
        setError(result.error)
      } else {
        setSuccess(result.message)
        setEmail(''); setFullName(''); setPassword(''); setConfirm('')
        setAdminRole('election_officer')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  return (
    <AdminShell title="Create Admin Account" subtitle="Grant election officer or super admin access">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .as-inp:focus   { outline:none;border-color:#1a56db!important;box-shadow:0 0 0 3px rgba(26,86,219,0.12)!important; }
        .as-sel:focus   { outline:none;border-color:#1a56db!important; }
        .as-btn:hover:not(:disabled) { filter:brightness(1.1);transform:translateY(-1px); }
        .as-eye:hover   { color:#1a56db!important; }
      `}</style>

      <div style={st.grid}>

        {/* ── Info panel ── */}
        <div style={st.infoCard}>
          <h3 style={st.cardTitle}>Admin Role Guide</h3>
          {[
            { icon:'🗳️', name:'Election Officer', desc:'Can create elections, manage positions, candidates, and view live results. Cannot create other admins.' },
            { icon:'⚙️', name:'Super Admin',      desc:'Full access including creating and revoking other admin accounts.' },
            { icon:'📧', name:'Login Method',     desc:'Admins log in at /admin/login using their email address — not a Student ID.' },
            { icon:'✉️', name:'Email Confirmation',desc:'If Supabase email confirmation is on, the admin must verify their email before first login.' },
          ].map(item => (
            <div key={item.name} style={st.infoRow}>
              <span style={st.infoEmoji}>{item.icon}</span>
              <div>
                <p style={st.infoName}>{item.name}</p>
                <p style={st.infoDesc}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Form ── */}
        <div style={st.formCard}>
          <h3 style={st.cardTitle}>New Admin Details</h3>

          {error   && <div style={st.errBox}><ErrIcon />{error}</div>}
          {success && <div style={st.okBox}><OkIcon  />{success}</div>}

          <form style={st.form} onSubmit={handleSubmit}>

            <Field label="Admin Email Address" hint="They will use this email at /admin/login">
              <Inp id="as-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com" disabled={loading} icon={<MailIco />} />
            </Field>

            <Field label="Full Name">
              <Inp id="as-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Full name" disabled={loading} icon={<UserIco />} />
            </Field>

            <Field label="Admin Role">
              <div style={st.iWrap}>
                <span style={st.iSlot}><ShieldIco /></span>
                <select className="as-sel" value={adminRole} onChange={e => setAdminRole(e.target.value)}
                  style={st.select} disabled={loading}>
                  <option value="election_officer">Election Officer</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </Field>

            <Field label="Temporary Password">
              <div style={st.iWrap}>
                <span style={st.iSlot}><LockIco /></span>
                <input className="as-inp" id="as-pw" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{ ...st.input, paddingRight:'44px' }}
                  disabled={loading} autoComplete="new-password" />
                <button type="button" className="as-eye" onClick={() => setShowPw(v=>!v)} style={st.eye} tabIndex={-1}>
                  {showPw ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
              {password && (
                <div style={st.strRow}>
                  <div style={st.strBar}>
                    {[1,2,3,4].map(n => (
                      <div key={n} style={{ ...st.strSeg, background: n<=strength.score ? strength.color : '#e5e7eb' }} />
                    ))}
                  </div>
                  <span style={{ ...st.strLbl, color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </Field>

            <Field label="Confirm Password">
              <div style={st.iWrap}>
                <span style={st.iSlot}><LockIco /></span>
                <input className="as-inp" id="as-cf" type={showCf ? 'text' : 'password'}
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  style={{ ...st.input, paddingRight:'44px', ...((!pwMatch&&confirm)?{borderColor:'#dc2626'}:{}) }}
                  disabled={loading} autoComplete="new-password" />
                <button type="button" className="as-eye" onClick={() => setShowCf(v=>!v)} style={st.eye} tabIndex={-1}>
                  {showCf ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
              {!pwMatch && confirm && <p style={st.mismatch}>Passwords don't match</p>}
            </Field>

            <div style={st.actions}>
              <button type="button" style={st.cancelBtn}
                onClick={() => navigate('/admin/manage-admins')} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="as-btn"
                disabled={loading}
                style={{ ...st.submitBtn, ...(loading ? st.submitOff : {}) }}>
                {loading ? <><Spin />Creating…</> : 'Create Admin Account →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminShell>
  )
}

/* tiny reusable sub-components */
function Field({ label, hint, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
      <label style={{ fontSize:'0.75rem', fontWeight:'700', color:'#374151', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</label>
      {children}
      {hint && <p style={{ margin:'2px 0 0', color:'#9ca3af', fontSize:'0.7rem' }}>{hint}</p>}
    </div>
  )
}
function Inp({ icon, ...props }) {
  return (
    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
      <span style={{ position:'absolute', left:'12px', zIndex:1 }}>{icon}</span>
      <input className="as-inp" style={{ width:'100%', height:'42px', paddingLeft:'38px', paddingRight:'14px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'10px', color:'#0f172a', fontSize:'0.875rem', fontFamily:"'Sora',sans-serif", transition:'border-color 0.15s,box-shadow 0.15s', boxSizing:'border-box' }} {...props} />
    </div>
  )
}

/* icons */
const sz = { width:15, height:15, viewBox:'0 0 24 24', fill:'none', stroke:'#9ca3af', strokeWidth:'2' }
const MailIco   = () => <svg {...sz}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
const UserIco   = () => <svg {...sz}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const ShieldIco = () => <svg {...sz}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const LockIco   = () => <svg {...sz}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const EyeOn     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeOff    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const ErrIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth="2" style={{flexShrink:0,marginRight:8}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const OkIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" style={{flexShrink:0,marginRight:8}}><polyline points="20 6 9 17 4 12"/></svg>
const Spin      = () => <span style={{width:13,height:13,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block',marginRight:8,flexShrink:0}}/>

const st = {
  denied:      { background:'#fff', border:'1px solid #e5e7eb', borderRadius:'16px', padding:'3rem', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' },
  deniedTitle: { margin:0, fontSize:'1.2rem', fontWeight:'800', color:'#0f172a' },
  deniedSub:   { margin:0, color:'#6b7280', fontSize:'0.9rem' },
  backBtn:     { background:'linear-gradient(135deg,#1a56db,#6366f1)', border:'none', borderRadius:'10px', color:'#fff', padding:'10px 20px', fontSize:'0.875rem', fontWeight:'700', cursor:'pointer', fontFamily:"'Sora',sans-serif" },

  grid:     { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'1.5rem', alignItems:'start' },
  infoCard: { background:'#fff', border:'1px solid #e5e7eb', borderRadius:'16px', padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' },
  formCard: { background:'#fff', border:'1px solid #e5e7eb', borderRadius:'16px', padding:'1.5rem' },
  cardTitle:{ margin:'0 0 0.75rem', fontSize:'1rem', fontWeight:'800', color:'#0f172a' },

  infoRow:  { display:'flex', gap:'12px', alignItems:'flex-start' },
  infoEmoji:{ fontSize:'1.2rem', flexShrink:0, marginTop:'2px' },
  infoName: { margin:'0 0 3px', fontSize:'0.875rem', fontWeight:'700', color:'#0f172a' },
  infoDesc: { margin:0, color:'#6b7280', fontSize:'0.78rem', lineHeight:1.5 },

  errBox:  { display:'flex', alignItems:'center', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'10px 14px', color:'#991b1b', fontSize:'0.82rem', fontWeight:'600', marginBottom:'1rem' },
  okBox:   { display:'flex', alignItems:'center', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'10px 14px', color:'#15803d', fontSize:'0.82rem', fontWeight:'600', marginBottom:'1rem' },

  form:    { display:'flex', flexDirection:'column', gap:'1rem' },
  iWrap:   { position:'relative', display:'flex', alignItems:'center' },
  iSlot:   { position:'absolute', left:'12px', zIndex:1 },
  input:   { width:'100%', height:'42px', paddingLeft:'38px', paddingRight:'14px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'10px', color:'#0f172a', fontSize:'0.875rem', fontFamily:"'Sora',sans-serif", transition:'border-color 0.15s,box-shadow 0.15s', boxSizing:'border-box' },
  select:  { width:'100%', height:'42px', paddingLeft:'38px', paddingRight:'14px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'10px', color:'#0f172a', fontSize:'0.875rem', fontFamily:"'Sora',sans-serif", cursor:'pointer', boxSizing:'border-box', appearance:'none' },
  eye:     { position:'absolute', right:'11px', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', display:'flex', alignItems:'center', padding:'3px', transition:'color 0.15s' },
  mismatch:{ margin:'3px 0 0', color:'#dc2626', fontSize:'0.72rem', fontWeight:'600' },

  strRow:  { display:'flex', alignItems:'center', gap:'8px', marginTop:'4px' },
  strBar:  { display:'flex', gap:'3px', flex:1 },
  strSeg:  { flex:1, height:'3px', borderRadius:'999px', transition:'background 0.2s' },
  strLbl:  { fontSize:'0.7rem', fontWeight:'700', minWidth:'38px' },

  actions:   { display:'flex', gap:'10px', marginTop:'4px' },
  cancelBtn: { flex:1, height:'44px', background:'#f3f4f6', border:'none', borderRadius:'10px', color:'#374151', fontFamily:"'Sora',sans-serif", fontSize:'0.875rem', fontWeight:'600', cursor:'pointer' },
  submitBtn: { flex:2, height:'44px', background:'linear-gradient(135deg,#1a56db,#6366f1)', border:'none', borderRadius:'10px', color:'#fff', fontFamily:"'Sora',sans-serif", fontSize:'0.875rem', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', transition:'filter 0.15s,transform 0.12s', boxShadow:'0 4px 14px rgba(26,86,219,0.25)' },
  submitOff: { opacity:0.65, cursor:'not-allowed' },
}