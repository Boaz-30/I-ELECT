import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
              <span className="text-sm font-bold">UNI</span>
            </div>
            <div>
              <p className="text-base font-semibold">University Online Voting System</p>
              <p className="text-xs text-slate-500">Secure Election Platform</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Secure Voting Powered by Supabase
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-12 md:px-8">
        <section className="text-center">
          <h1 className="text-3xl font-black text-slate-900 md:text-5xl">
            Vote Securely. Decide the Future.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            Welcome to the official university election portal. Students can securely vote for
            their preferred candidates in real time.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6"
              >
                <path d="M4 9a2 2 0 0 1 2-2h3V5a3 3 0 0 1 6 0v2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Zm7-4a1 1 0 0 0-1 1v2h4V6a1 1 0 0 0-1-1h-2Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold">Student Login</h2>
            <p className="mt-2 text-sm text-slate-600">
              Students can log in with their student ID and password to participate in
              university elections.
            </p>
            <button
              className="mt-6 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              onClick={() => navigate('/student-login')}
            >
              Enter Voting Portal
            </button>
          </div>

          <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6"
              >
                <path d="M4 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8.414a1 1 0 0 0-.293-.707l-4.414-4.414A1 1 0 0 0 15.586 3H4Zm1 2h9v4h4v11H5V5Zm10 1.414L17.586 9H15V6.414Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold">Admin Login</h2>
            <p className="mt-2 text-sm text-slate-600">
              Election officers and administrators can manage candidates, elections, and view
              voting analytics.
            </p>
            <button
              className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              onClick={() => navigate('/admin-login')}
            >
              Admin Dashboard Login
            </button>
          </div>
        </section>

        <p className="text-center text-sm text-slate-500">
          Voting is only available during the official election period.
        </p>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M12 1a7 7 0 0 0-7 7v4.382a1 1 0 0 1-.553.894l-1.447.724A1 1 0 0 0 2 15v5a2 2 0 0 0 2 2h6v-5.126a4 4 0 1 1 4 0V22h6a2 2 0 0 0 2-2v-5a1 1 0 0 0-.553-.894l-1.447-.724a1 1 0 0 1-.553-.894V8a7 7 0 0 0-7-7Z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold">Secure Voting</h3>
            <p className="mt-2 text-sm text-slate-600">
              All votes are securely stored and protected using modern authentication.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M4 4a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v13h2V7a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v10h2V9a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v8h2a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1V4Z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold">Live Election Monitoring</h3>
            <p className="mt-2 text-sm text-slate-600">
              Administrators can monitor election participation in real time.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a6 6 0 0 1 12 0v1H4v-1Zm13-2a5 5 0 0 1 5 5v1h-2v-1a3 3 0 0 0-3-3h-1.5a6.98 6.98 0 0 0-1.5-2H17Z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold">Student Verified Access</h3>
            <p className="mt-2 text-sm text-slate-600">
              Only approved university students can participate in elections.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="font-semibold">University Online Voting System</p>
            <p className="text-slate-300">Built for secure student elections</p>
          </div>
          <p className="text-slate-400">© {year} University Online Voting System</p>
        </div>
      </footer>
    </div>
  )
}
