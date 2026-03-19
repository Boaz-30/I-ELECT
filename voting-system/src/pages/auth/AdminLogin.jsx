import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUpStudent } from '../../services/authService'

function calcStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' }
  let s = 0
  if (pw.length >= 8)          s++
  if (/[A-Z]/.test(pw))        s++
  if (/[0-9]/.test(pw))        s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const map = [
    { score:1, label:'Weak',   color:'#dc2626' },
    { score:2, label:'Fair',   color:'#d97706' },
    { score:3, label:'Good',   color:'#059669' },
    { score:4, label:'Strong', color:'#1a56db' },
  ]
  return map.find(m => m.score >= s) ?? map[3]
}

export default function StudentSignup() {
  const navigate    = useNavigate()
  const mountedRef  = useRef(true)
  const timerRef    = useRef(null)

  const [studentId,       setStudentId]       = useState('')
  const [fullName,        setFullName]        = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState('')
  const [showPw,          setShowPw]          = useState(false)
  const [showCf,          setShowCf]          = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const strength = useMemo(() => calcStrength(password), [password])
  const pwMatch   = !confirmPassword || password === confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    // ── Client-side validation ──────────────────────────────────────
    if (!/^\d{10}$/.test(studentId)) {
      setError('Student ID must be exactly 10 digits.')
      return
    }
    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    // signUpStudent never throws — it returns { success, requiresConfirmation, message, error }
    const result = await signUpStudent({ studentId, fullName, password })
    if (!mountedRef.current) return

    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Signup failed. Please try again.')
      return
    }

    if (result.requiresConfirmation) {
      setSuccess(
        result.message ||
        'Account created! Check your email inbox and click the confirmation ' +
        'link to activate your account, then return here to log in.'
      )
      return
    }

    setSuccess(result.message || 'Account created successfully! Redirecting to login…')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) navigate('/login')
    }, 2000)
  }

  return (
    <div style={s.page}>
      <style>{css}</style>
      <div style={s.blob1} /><div style={s.blob2} /><div style={s.grid} />

      <div style={s.outer}>
        <div style={s.card}>
          {/* Header */}
          <div style={s.head}>
            <div style={s.logoRow}>
              <div style={s.logoIcon}><CapIcon /></div>
              <span style={s.logoText}>UniVote</span>
            </div>
            <h1 style={s.title}>Create Student Account</h1>
            <p  style={s.sub}>Register to participate in student elections</p>
          </div>

          {/* Messages */}
          {error   && <div style={s.errBox}><ErrIcon /><span>{error}</span></div>}
          {success && <div style={s.okBox}><OkIcon  /><span>{success}</span></div>}

          {/* Form */}
          <form style={s.form} onSubmit={handleSubmit}>

            {/* Student ID */}
            <div style={s.field}>
              <label style={s.label} htmlFor="reg-sid">Student ID</label>
              <div style={s.iWrap}>
                <IDIcon style={s.iIcon} />
                <input
                  id="reg-sid"
                  className="ss-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={studentId}
                  onChange={e => setStudentId(e.target.value.replace(/\D/g,''))}
                  placeholder="10-digit Student ID"
                  style={s.input}
                  disabled={loading || !!success}
                  autoComplete="username"
                />
                {studentId.length > 0 && (
                  <span style={{...s.ctr, color: studentId.length===10 ? '#059669' : '#9ca3af'}}>
                    {studentId.length}/10
                  </span>
                )}
              </div>
              <p style={s.hint}>Your login email will be <strong>{studentId || 'XXXXXXXXXX'}@st.ug.edu.gh</strong></p>
            </div>

            {/* Full name */}
            <div style={s.field}>
              <label style={s.label} htmlFor="reg-name">Full Name</label>
              <div style={s.iWrap}>
                <UserIcon style={s.iIcon} />
                <input
                  id="reg-name"
                  className="ss-input"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your full legal name"
                  style={s.input}
                  disabled={loading || !!success}
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Password */}
            <div style={s.field}>
              <label style={s.label} htmlFor="reg-pw">Password</label>
              <div style={s.iWrap}>
                <LockIcon style={s.iIcon} />
                <input
                  id="reg-pw"
                  className="ss-input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{...s.input, paddingRight:'44px'}}
                  disabled={loading || !!success}
                  autoComplete="new-password"
                />
                <button type="button" className="ss-eye" onClick={() => setShowPw(v=>!v)} style={s.eye} tabIndex={-1}>
                  {showPw ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div style={s.strRow}>
                  <div style={s.strBar}>
                    {[1,2,3,4].map(n => (
                      <div key={n} style={{...s.strSeg, background: n<=strength.score ? strength.color : 'rgba(255,255,255,0.1)'}}/>
                    ))}
                  </div>
                  <span style={{...s.strLabel, color: strength.color}}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div style={s.field}>
              <label style={s.label} htmlFor="reg-cf">Confirm Password</label>
              <div style={s.iWrap}>
                <ShieldIcon style={s.iIcon} />
                <input
                  id="reg-cf"
                  className="ss-input"
                  type={showCf ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  style={{
                    ...s.input, paddingRight:'44px',
                    borderColor: (!pwMatch && confirmPassword) ? '#dc2626' : undefined,
                  }}
                  disabled={loading || !!success}
                  autoComplete="new-password"
                />
                <button type="button" className="ss-eye" onClick={() => setShowCf(v=>!v)} style={s.eye} tabIndex={-1}>
                  {showCf ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
              {!pwMatch && confirmPassword && (
                <p style={s.mismatch}>Passwords don't match</p>
              )}
            </div>

            <button
              type="submit"
              className="ss-btn"
              disabled={loading || !!success}
              style={{...s.btn, ...((loading||success) ? s.btnOff : {})}}
            >
              {loading ? <><Spin />Creating account…</> : 'Create Account →'}
            </button>
          </form>

          {/* Footer */}
          <div style={s.foot}>
            <span style={s.footTxt}>Already have an account?</span>
            <button className="ss-link" onClick={() => navigate('/login')} style={s.footLink}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── icons ── */
const CapIcon   = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 12v5c3 3 9 3 12 0v-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IDIcon    = ({style}) => <svg style={style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
const UserIcon  = ({style}) => <svg style={style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const LockIcon  = ({style}) => <svg style={style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const ShieldIcon= ({style}) => <svg style={style} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const EyeOn     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeOff    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const ErrIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth="2" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const OkIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" style={{flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>
const Spin      = () => <span style={{width:13,height:13,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'ss-spin 0.7s linear infinite',display:'inline-block',marginRight:8,flexShrink:0}}/>

const css = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
@keyframes ss-spin { to { transform: rotate(360deg); } }
@keyframes ss-up   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
.ss-input { color-scheme: dark; }
.ss-input::placeholder { color: rgba(255,255,255,0.28); }
.ss-input:focus { outline:none; border-color:#1a56db !important; box-shadow:0 0 0 3px rgba(26,86,219,0.18) !important; }
.ss-btn   { display:flex; align-items:center; justify-content:center; gap:8px; }
.ss-btn:hover:not(:disabled) { filter:brightness(1.12); transform:translateY(-1px); }
.ss-eye:hover { color:#93c5fd !important; }
.ss-link:hover { color:#93c5fd !important; }
`

const s = {
  page:  { minHeight:'100vh', fontFamily:"'Sora',sans-serif", background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', position:'relative', overflow:'hidden' },
  blob1: { position:'fixed', top:'-15%', left:'-8%', width:'55%', height:'65%', background:'radial-gradient(ellipse,rgba(99,102,241,0.16) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' },
  blob2: { position:'fixed', bottom:'-18%', right:'-6%', width:'50%', height:'58%', background:'radial-gradient(ellipse,rgba(16,185,129,0.09) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' },
  grid:  { position:'fixed', inset:0, backgroundImage:'radial-gradient(circle at 1px 1px,rgba(99,102,241,0.06) 1px,transparent 0)', backgroundSize:'30px 30px', pointerEvents:'none' },
  outer: { position:'relative', zIndex:1, width:'100%', maxWidth:'450px', animation:'ss-up 0.5s ease both' },
  card:  { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'22px', padding:'2rem', backdropFilter:'blur(20px)', display:'flex', flexDirection:'column', gap:'1.35rem' },

  head:    { display:'flex', flexDirection:'column', gap:'4px' },
  logoRow: { display:'flex', alignItems:'center', gap:'9px', marginBottom:'0.6rem' },
  logoIcon:{ width:'34px', height:'34px', background:'linear-gradient(135deg,#1a56db,#6366f1)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(26,86,219,0.4)', flexShrink:0 },
  logoText:{ fontSize:'1.15rem', fontWeight:'800', color:'#fff', letterSpacing:'-0.02em' },
  title:   { margin:0, fontSize:'1.45rem', fontWeight:'800', color:'#fff', letterSpacing:'-0.02em' },
  sub:     { margin:0, color:'rgba(255,255,255,0.45)', fontSize:'0.82rem' },

  errBox:  { display:'flex', alignItems:'flex-start', gap:'8px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'10px 13px', color:'#991b1b', fontSize:'0.82rem', fontWeight:'600' },
  okBox:   { display:'flex', alignItems:'flex-start', gap:'8px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'10px 13px', color:'#15803d', fontSize:'0.82rem', fontWeight:'600' },

  form:    { display:'flex', flexDirection:'column', gap:'0.9rem' },
  field:   { display:'flex', flexDirection:'column', gap:'4px' },
  label:   { color:'rgba(255,255,255,0.68)', fontSize:'0.78rem', fontWeight:'600', letterSpacing:'0.02em' },
  iWrap:   { position:'relative', display:'flex', alignItems:'center' },
  iIcon:   { position:'absolute', left:'12px', zIndex:1 },
  input:   { width:'100%', height:'44px', paddingLeft:'38px', paddingRight:'14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'10px', color:'#fff', fontSize:'0.88rem', fontFamily:"'Sora',sans-serif", transition:'border-color 0.15s,box-shadow 0.15s', boxSizing:'border-box' },
  ctr:     { position:'absolute', right:'12px', fontSize:'0.7rem', fontWeight:'600', fontVariantNumeric:'tabular-nums' },
  eye:     { position:'absolute', right:'11px', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.32)', display:'flex', alignItems:'center', padding:'3px', transition:'color 0.15s' },
  hint:    { margin:'3px 0 0', color:'rgba(255,255,255,0.3)', fontSize:'0.71rem', fontWeight:'500' },

  strRow:  { display:'flex', alignItems:'center', gap:'8px', marginTop:'5px' },
  strBar:  { display:'flex', gap:'3px', flex:1 },
  strSeg:  { flex:1, height:'3px', borderRadius:'999px', transition:'background 0.2s' },
  strLabel:{ fontSize:'0.7rem', fontWeight:'700', minWidth:'38px' },

  mismatch:{ margin:'3px 0 0', color:'#f87171', fontSize:'0.72rem', fontWeight:'600' },

  btn:     { marginTop:'4px', height:'48px', background:'linear-gradient(135deg,#1a56db,#6366f1)', border:'none', borderRadius:'12px', color:'#fff', fontFamily:"'Sora',sans-serif", fontSize:'0.9rem', fontWeight:'700', cursor:'pointer', transition:'filter 0.15s,transform 0.12s', boxShadow:'0 4px 16px rgba(26,86,219,0.28)' },
  btnOff:  { opacity:0.65, cursor:'not-allowed' },

  foot:    { display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' },
  footTxt: { color:'rgba(255,255,255,0.38)', fontSize:'0.8rem' },
  footLink:{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', fontSize:'0.8rem', fontWeight:'700', cursor:'pointer', fontFamily:"'Sora',sans-serif", transition:'color 0.15s' },
}