import { RegisterForm } from "./RegisterForm";

export function AuthPage() {
  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <span className="eyebrow">Welcome to Capstone</span>
        <h1>Capstone</h1>
        <p>Frontend application shell is ready.</p>
      </header>
      <RegisterForm />
    </main>
  );
}
