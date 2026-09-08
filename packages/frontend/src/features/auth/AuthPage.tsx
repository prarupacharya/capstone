import { useEffect, useState } from "react";
import { request } from "../../api/client.js";
import { clearAccessToken, hasAccessToken } from "../../auth/session.js";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type AuthMode = "register" | "login";

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("register");
  const [isAuthenticated, setIsAuthenticated] = useState(hasAccessToken);

  useEffect(() => {
    if (!isAuthenticated) return;

    void request("/auth/me", undefined, { authenticated: true }).catch(() => undefined);
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return (
      <main className="auth-page">
        <header className="auth-page__header">
          {/* <span className="eyebrow">Welcome to Capstone</span> */}
          <h1>LF-Chat</h1>
          {/* <p>Frontend application shell is ready.</p> */}
        </header>
        <section className="auth-card auth-card--session" aria-labelledby="session-heading">
          <p className="eyebrow">Authenticated</p>
          <h2 id="session-heading">You&apos;re signed in</h2>
          <output>Your session is active in this browser tab.</output>
          <button
            className="auth-secondary-button"
            type="button"
            onClick={() => {
              clearAccessToken();
              setIsAuthenticated(false);
              setMode("login");
            }}
          >
            Log out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        {/* <span className="eyebrow">Welcome to Capstone</span> */}
        <h1>LF-Chat</h1>
        {/* <p>Frontend application shell is ready.</p> */}
      </header>
      <div>
        <nav className="auth-nav" aria-label="Authentication">
          <button
            className={mode === "register" ? "auth-nav__active" : ""}
            type="button"
            onClick={() => setMode("register")}
          >
            Register
          </button>
          <button
            className={mode === "login" ? "auth-nav__active" : ""}
            type="button"
            onClick={() => setMode("login")}
          >
            Log in
          </button>
        </nav>
        {mode === "register" ? (
          <RegisterForm />
        ) : (
          <LoginForm onAuthenticated={() => setIsAuthenticated(true)} />
        )}
      </div>
    </main>
  );
}
