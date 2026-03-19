import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <main style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.brand}>
          <div style={styles.logo}>UV</div>
          <div>
            <p style={styles.brandTitle}>UniVote</p>
            <p style={styles.brandSub}>University Voting System</p>
          </div>
        </div>

        <h1 style={styles.title}>Secure, transparent student elections.</h1>
        <p style={styles.subtitle}>
          Manage elections, verify eligibility, and cast ballots in one trusted platform.
          Choose how you want to sign in below.
        </p>

        <div style={styles.ctaRow}>
          <Link to="/login" style={styles.primaryCta}>
            Student Sign In
          </Link>
          <Link to="/login?role=admin" style={styles.secondaryCta}>
            Admin Sign In
          </Link>
        </div>

        <p style={styles.helper}>
          New student?{' '}
          <Link to="/signup" style={styles.link}>
            Create an account
          </Link>
        </p>
      </div>

      <section style={styles.infoGrid}>
        <article style={styles.infoCard}>
          <h3 style={styles.cardTitle}>Trusted voting flow</h3>
          <p style={styles.cardText}>
            Each ballot is authenticated, encrypted, and auditable to maintain integrity.
          </p>
        </article>
        <article style={styles.infoCard}>
          <h3 style={styles.cardTitle}>Live monitoring</h3>
          <p style={styles.cardText}>
            Admins can track turnout and verify compliance while elections are active.
          </p>
        </article>
        <article style={styles.infoCard}>
          <h3 style={styles.cardTitle}>Instant results</h3>
          <p style={styles.cardText}>
            Final tallies are certified and published as soon as results are approved.
          </p>
        </article>
      </section>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, #e9f0ff 0%, #f7f9fc 45%, #eef2f7 100%)',
    color: '#0b234e',
    fontFamily: '"Public Sans", "Segoe UI", sans-serif',
    padding: '2.5rem 1.5rem 3rem',
    display: 'grid',
    gap: '2rem',
  },
  hero: {
    maxWidth: '980px',
    margin: '0 auto',
    display: 'grid',
    gap: '1.2rem',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },
  logo: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: '#08255d',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    letterSpacing: '0.06rem',
  },
  brandTitle: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 800,
    letterSpacing: '-0.02rem',
  },
  brandSub: {
    margin: 0,
    color: '#5b6f93',
    letterSpacing: '0.08rem',
    fontSize: '0.85rem',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 3.6rem)',
    lineHeight: 1.1,
    fontWeight: 900,
    color: '#081f4d',
  },
  subtitle: {
    margin: 0,
    fontSize: '1.15rem',
    color: '#4f648d',
    maxWidth: '680px',
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.8rem',
  },
  primaryCta: {
    background: '#08255d',
    color: '#fff',
    padding: '0.85rem 1.5rem',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: 700,
    boxShadow: '0 12px 24px rgba(8, 37, 93, 0.18)',
  },
  secondaryCta: {
    border: '1px solid #c3d0e3',
    background: '#fff',
    color: '#08255d',
    padding: '0.85rem 1.5rem',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: 700,
  },
  helper: {
    margin: 0,
    color: '#5b6f93',
  },
  link: {
    color: '#1d4ed8',
    textDecoration: 'none',
    fontWeight: 700,
  },
  infoGrid: {
    width: 'min(1100px, 100%)',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  },
  infoCard: {
    background: '#ffffff',
    border: '1px solid #d6dfed',
    borderRadius: '14px',
    padding: '1.2rem',
    boxShadow: '0 10px 20px rgba(8, 28, 64, 0.06)',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: '#08255d',
  },
  cardText: {
    margin: '0.6rem 0 0',
    color: '#4f648d',
    lineHeight: 1.5,
  },
}
