import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError("Invalid email or password. Please try again.");
      setPassword("");
    } else {
      onLogin();
    }
  }

  return (
    <div className="page">
      {/* Background rings */}
      <div className="bg-grid" />
      <div className="rings">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`ring ring-${i}`} />
        ))}
      </div>

      <div className="page-inner">
        {/* Logo */}
        <div className="logo-wrap">
          <div className="logo-mark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="#22D3EE" />
              <circle cx="12" cy="12" r="8" stroke="#22D3EE" strokeWidth="1.5" fill="none" opacity="0.4" />
              <circle cx="12" cy="12" r="11.5" stroke="#22D3EE" strokeWidth="1" fill="none" opacity="0.15" />
            </svg>
          </div>
          <div className="logo-name">SiteWatch</div>
          <div className="logo-org">CRIL Infrastructure Monitor</div>
        </div>

        {/* Live status pill */}
        <div className="status-strip">
          <div className="strip-dot" />
          <span>All systems operational</span>
        </div>

        {/* Card */}
        <div className="card">
          {error && (
            <div className="error-alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" stroke="#F43F5E" strokeWidth="1.5" />
                <path d="M8 5v3.5M8 11h.01" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <h1 className="card-heading">Sign in</h1>
          <p className="card-sub">Access restricted to authorized personnel only.</p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="field">
              <label className="field-label" htmlFor="email">Email address</label>
              <div className="field-wrap">
                <span className="field-icon">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <rect x="1" y="3" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M1 5l6.5 4L14 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="email"
                  className="field-input"
                  type="email"
                  placeholder="you@cyble.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <div className="field-wrap">
                <span className="field-icon">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <rect x="3" y="6" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="password"
                  className={`field-input${showPw ? "" : ""} has-toggle`}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" opacity="0.3"/>
                      <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/>
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div className="forgot-row">
              <a href="#" className="forgot-link">Forgot password?</a>
            </div>

            <button className="btn-signin" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" />
                  Signing in…
                </>
              ) : "Sign in"}
            </button>
          </form>

          <div className="secure-row">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L2 2.5V6c0 2.5 1.8 4.5 4 5 2.2-.5 4-2.5 4-5V2.5L6 1z" stroke="#55536A" strokeWidth="1.1" fill="none"/>
              <path d="M4 6l1.5 1.5 2.5-2.5" stroke="#55536A" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Secured · TLS 1.3 · Internal access only
          </div>
        </div>
      </div>

      <footer className="footer">
        CRIL &middot; Cyble Research &amp; Intelligence Labs &middot; Internal use only
      </footer>
    </div>
  );
}
