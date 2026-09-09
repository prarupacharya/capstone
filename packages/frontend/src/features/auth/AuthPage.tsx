import { useEffect, useState } from "react";
import { getCurrentUser, type CurrentUser } from "../../api/auth.js";
import { clearAccessToken, hasAccessToken } from "../../auth/session.js";
import { DashboardPage } from "../chat/DashboardPage";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

type AuthMode = "register" | "login";
type SessionStatus = "signed-out" | "checking" | "authenticated";

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("register");
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(() =>
    hasAccessToken() ? "checking" : "signed-out"
  );
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [probeVersion, setProbeVersion] = useState(0);

  useEffect(() => {
    if (!hasAccessToken()) {
      setSessionStatus("signed-out");
      setUser(null);
      return;
    }

    let active = true;
    setSessionStatus("checking");
    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setSessionStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        clearAccessToken();
        setUser(null);
        setSessionStatus("signed-out");
        setMode("login");
      });

    return () => {
      active = false;
    };
  }, [probeVersion]);

  if (sessionStatus === "checking") {
    return (
      <main className="auth-page">
        <header className="auth-page__header">
          <h1>LF-Chat</h1>
        </header>
        <output role="status">Checking your session...</output>
      </main>
    );
  }

  if (sessionStatus === "authenticated" && user) {
    return (
      <DashboardPage
        user={user}
        onLogout={() => {
          clearAccessToken();
          setUser(null);
          setSessionStatus("signed-out");
          setMode("login");
        }}
      />
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
          <LoginForm onAuthenticated={() => setProbeVersion((version) => version + 1)} />
        )}
      </div>
    </main>
  );
}
