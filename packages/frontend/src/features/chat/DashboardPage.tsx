import type { CurrentUser } from "../../api/auth.js";

type DashboardPageProps = { readonly user: CurrentUser; readonly onLogout: () => void };

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <h1>Welcome to LF-Chat</h1>
      </header>
      <section className="auth-card auth-card--session" aria-labelledby="dashboard-heading">
        <h2 id="dashboard-heading">{user.email}</h2>
        <button className="auth-secondary-button" type="button" onClick={onLogout}>
          Log out
        </button>
      </section>
    </main>
  );
}
