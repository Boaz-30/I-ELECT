import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginStudent } from '../../services/authService'

export default function StudentLogin() {
  const navigate = useNavigate()
  const [studentId,    setStudentId]    = useState('')
  const [password,     setPassword]     = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!/^\d{10}$/.test(studentId)) {
      setError('Student ID must be exactly 10 digits.')
      return
    }
    if (!password) {
      setError('Password is required.')
      return
    }

    setLoading(true)
    const result = await loginStudent({ studentId, password })
    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Login failed. Please try again.')
      return
    }
    navigate('/dashboard')
  }

  return (
    <div style={s.page}>
      <style>{css}</style>

      {/* Background blobs */}
      <div style={s.blob1} />
      <div style={s.blob2} />
      <div style={s.grid}  />

      {/* Split layout */}
      <div style={s.wrap}>
        {/* ── Left panel (decorative, hidden on mobile via CSS) ── */}
        <div className="sl-left" style={s.left}>
          <div style={s.leftInner}>
            <div style={s.logoRow}>
              <div style={s.logoIcon}><GradCap /></div>
              <span style={s.logoText}>UniVote</span>
            </div>
            <h1 style={s.heroTitle}>Your vote.<br/>Your voice.<br/>Your campus.</h1>
            <p  style={s.heroPara}>
              The official University of Ghana secure student election platform.
              Participate in free, fair, and transparent elections.
            </p>
            <ul style={s.feats}>
              {['One secure vote per position',
                'Anonymous and encrypted ballots',
                'Real-time certified results',
                'Protected by Row-Level Security'].map(f => (
                <li key={f} style={s.feat}><span style={s.tick}>✓</span>{f}</li>
              ))}
            </ul>
            {/* Admin portal link */}
            <button className="sl-admin-link" style={s.adminLink} onClick={() => navigate('/admin/login')}>
              Are you an Election Officer? → Admin Portal
            </button>
          </div>
        </div>

        {/* ── Right panel (form) ── */}
        <div style={s.right}>
          <div style={s.card}>
            <div style={s.cardHead}>
              {/* Mobile-only logo */}
              <div className="sl-mobile-logo" style={s.mobileLogo}>
                <div style={s.logoIcon}><GradCap /></div>
                <span style={s.logoText}>UniVote</span>
              </div>
              <h2 style={s.formTitle}>Student Login</h2>
              <p  style={s.formSub}>Enter your student credentials to access voting</p>
            </div>

            {error && (
              <div style={s.errBox}>
                <ErrIcon />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={s.form}>
              {/* Student ID */}
              <div style={s.field}>
                <label style={s.label} htmlFor="sid">Student ID</label>
                <div style={s.iWrap}>
                  <UserIcon style={s.iIcon} />
                  <input
                    id="sid"
                    className="sl-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={studentId}
                    onChange={e => setStudentId(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit Student ID"
                    style={s.input}
                    disabled={loading}
                    autoComplete="username"
                  />
                  {studentId.length > 0 && (
                    <span style={{ ...s.counter, color: studentId.length === 10 ? '#059669' : '#9ca3af' }}>
                      {studentId.length}/10
                    </span>
                  )}
                </div>
              </div>

              {/* Password */}
              <div style={s.field}>
                <label style={s.label} htmlFor="spw">Password</label>
                <div style={s.iWrap}>
                  <LockIcon style={s.iIcon} />
                  <input
                    id="spw"
                    className="sl-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={{ ...s.input, paddingRight: '46px' }}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button type="button" className="sl-eye" onClick={() => setShowPassword(v => !v)} style={s.eye} tabIndex={-1}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button type="submit" className="sl-btn" disabled={loading}
                style={{ ...s.btn, ...(loading ? s.btnBusy : {}) }}>
                {loading
                  ? <><Spinner />Authenticating…</>
                  : <>Sign In to Vote <ArrowIcon /></>}
              </button>
            </form>

            <div style={s.divider}><span style={s.divLine}/><span style={s.divText}>New student?</span><span style={s.divLine}/></div>

            <button className="sl-signup" onClick={() => navigate('/signup')} style={s.signupBtn}>
              Create a student account
            </button>

            <p style={s.secNote}><ShieldIcon /> Secured with 256-bit encryption · All votes are anonymous</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── tiny SVG icons ── */
const GradCap  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 12v5c3 3 9 3 12 0v-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const UserIcon = ({style}) => <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const LockIcon = ({style}) => <svg style={style} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const EyeIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeOffIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const ErrIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const ArrowIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const ShieldIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{display:'inline',marginRight:4,verticalAlign:'middle'}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const Spinner  = () => <span style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'sl-spin 0.7s linear infinite',display:'inline-block',marginRight:8,flexShrink:0}}/>

const css = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
@keyframes sl-spin  { to { transform: rotate(360deg); } }
@keyframes sl-up    { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
.sl-input { color-scheme: dark; }
.sl-input::placeholder { color: rgba(255,255,255,0.3); }
.sl-input:focus { outline:none; border-color:#1a56db !important; box-shadow:0 0 0 3px rgba(26,86,219,0.18) !important; }
.sl-btn   { display:flex; align-items:center; justify-content:center; gap:8px; }
.sl-btn:hover:not(:disabled) { filter:brightness(1.12); transform:translateY(-1px); }
.sl-btn:active:not(:disabled){ transform:translateY(0); }
.sl-eye:hover { color:#93c5fd !important; }
.sl-signup:hover { border-color:rgba(255,255,255,0.4) !important; color:#fff !important; }
.sl-admin-link:hover { background:rgba(255,255,255,0.12) !important; }
@media (max-width:860px) { .sl-left { display:none !important; } }
@media (min-width:861px) { .sl-mobile-logo { display:none !important; } }
`

const s = {
  page:  { minHeight:'100vh', fontFamily:"'Sora',sans-serif", background:'#0f172a', display:'flex', alignItems:'stretch', position:'relative', overflow:'hidden' },
  blob1: { position:'fixed', top:'-15%', left:'-8%', width:'55%', height:'65%', background:'radial-gradient(ellipse,rgba(99,102,241,0.18) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' },
  blob2: { position:'fixed', bottom:'-18%', right:'-6%', width:'50%', height:'58%', background:'radial-gradient(ellipse,rgba(16,185,129,0.1) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' },
  grid:  { position:'fixed', inset:0, backgroundImage:'radial-gradient(circle at 1px 1px,rgba(99,102,241,0.07) 1px,transparent 0)', backgroundSize:'30px 30px', pointerEvents:'none' },
  wrap:  { display:'flex', width:'100%', minHeight:'100vh', position:'relative', zIndex:1 },

  left:  { flex:1, padding:'3rem 3rem 3rem 4rem', display:'flex', alignItems:'center', justifyContent:'flex-start' },
  leftInner: { maxWidth:'440px', animation:'sl-up 0.6s ease both' },
  logoRow: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'2.5rem' },
  logoIcon: { width:'38px', height:'38px', background:'linear-gradient(135deg,#1a56db,#6366f1)', borderRadius:'11px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(26,86,219,0.4)', flexShrink:0 },
  logoText: { fontSize:'1.4rem', fontWeight:'800', color:'#fff', letterSpacing:'-0.02em' },
  heroTitle: { fontSize:'clamp(2rem,4vw,3.2rem)', fontWeight:'800', lineHeight:1.07, color:'#fff', margin:'0 0 1.25rem', letterSpacing:'-0.03em' },
  heroPara:  { fontSize:'1rem', color:'rgba(255,255,255,0.6)', lineHeight:1.65, margin:'0 0 2rem', fontWeight:'400' },
  feats: { listStyle:'none', padding:0, margin:'0 0 2rem', display:'flex', flexDirection:'column', gap:'0.7rem' },
  feat:  { display:'flex', alignItems:'center', gap:'10px', color:'rgba(255,255,255,0.72)', fontSize:'0.9rem', fontWeight:'500' },
  tick:  { color:'#34d399', fontWeight:'700', flexShrink:0 },
  adminLink: { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', color:'rgba(255,255,255,0.6)', padding:'9px 14px', fontSize:'0.82rem', fontWeight:'600', cursor:'pointer', fontFamily:"'Sora',sans-serif", transition:'background 0.15s', textAlign:'left' },

  right: { width:'100%', maxWidth:'460px', marginLeft:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', background:'rgba(255,255,255,0.03)', backdropFilter:'blur(20px)', borderLeft:'1px solid rgba(255,255,255,0.07)' },
  card:  { width:'100%', maxWidth:'390px', display:'flex', flexDirection:'column', gap:'1.25rem', animation:'sl-up 0.5s ease both' },
  cardHead: { display:'flex', flexDirection:'column', gap:'4px' },
  mobileLogo: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'0.75rem' },
  formTitle: { margin:0, fontSize:'1.65rem', fontWeight:'800', color:'#fff', letterSpacing:'-0.02em' },
  formSub:   { margin:0, color:'rgba(255,255,255,0.45)', fontSize:'0.85rem' },

  errBox: { display:'flex', alignItems:'flex-start', gap:'9px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'11px 14px', color:'#991b1b', fontSize:'0.82rem', fontWeight:'600' },

  form:  { display:'flex', flexDirection:'column', gap:'1rem' },
  field: { display:'flex', flexDirection:'column', gap:'5px' },
  label: { color:'rgba(255,255,255,0.7)', fontSize:'0.8rem', fontWeight:'600', letterSpacing:'0.02em' },
  iWrap: { position:'relative', display:'flex', alignItems:'center' },
  iIcon: { position:'absolute', left:'13px', zIndex:1 },
  input: { width:'100%', height:'46px', paddingLeft:'40px', paddingRight:'14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.13)', borderRadius:'11px', color:'#fff', fontSize:'0.9rem', fontFamily:"'Sora',sans-serif", transition:'border-color 0.15s,box-shadow 0.15s', boxSizing:'border-box' },
  counter: { position:'absolute', right:'13px', fontSize:'0.72rem', fontWeight:'600', fontVariantNumeric:'tabular-nums' },
  eye:   { position:'absolute', right:'12px', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', padding:'4px', transition:'color 0.15s' },

  btn:     { marginTop:'4px', height:'50px', background:'linear-gradient(135deg,#1a56db,#6366f1)', border:'none', borderRadius:'12px', color:'#fff', fontFamily:"'Sora',sans-serif", fontSize:'0.95rem', fontWeight:'700', cursor:'pointer', transition:'filter 0.15s,transform 0.12s', boxShadow:'0 4px 18px rgba(26,86,219,0.3)' },
  btnBusy: { opacity:0.72, cursor:'not-allowed' },

  divider:  { display:'flex', alignItems:'center', gap:'10px' },
  divLine:  { flex:1, height:'1px', background:'rgba(255,255,255,0.09)' },
  divText:  { color:'rgba(255,255,255,0.35)', fontSize:'0.75rem', whiteSpace:'nowrap' },

  signupBtn: { width:'100%', height:'46px', background:'transparent', border:'1px solid rgba(255,255,255,0.13)', borderRadius:'11px', color:'rgba(255,255,255,0.6)', fontFamily:"'Sora',sans-serif", fontSize:'0.88rem', fontWeight:'600', cursor:'pointer', transition:'border-color 0.15s,color 0.15s' },
  secNote:   { textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'0.72rem', fontWeight:'500', margin:0 },
}