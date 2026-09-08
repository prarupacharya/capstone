import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/api-error.js";
import { loginUser, type LoginResult, type RegistrationInput } from "../../api/auth.js";
import { clearAccessToken, saveAccessToken } from "../../auth/session.js";

export type LoginFormStatus = "ready" | "submitting" | "authenticated" | "error";

export interface LoginFormProps {
  readonly onLogin?: (input: RegistrationInput) => Promise<LoginResult>;
  readonly onAuthenticated?: () => void;
  readonly initialStatus?: LoginFormStatus;
  readonly initialMessage?: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.messages.length) return error.messages.join(". ");
  return "Login could not be completed. Please try again.";
}

export function LoginForm({
  onLogin = loginUser,
  onAuthenticated,
  initialStatus = "ready",
  initialMessage = ""
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<LoginFormStatus>(initialStatus);
  const [message, setMessage] = useState(initialMessage);
  const isSubmitting = status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setStatus("submitting");
    setMessage("");

    try {
      const result = await onLogin({ email, password });
      saveAccessToken(result.accessToken);
      setPassword("");
      setStatus("authenticated");
      setMessage("You are signed in.");
      onAuthenticated?.();
    } catch (error) {
      clearAccessToken();
      setPassword("");
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-heading">
      <div className="auth-card__intro">
        <p className="eyebrow">Welcome back</p>
        <h2 id="login-heading">Log in</h2>
        <p>Use your LF account to continue.</p>
      </div>

      <form className="auth-form" aria-label="Log in" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      {status === "submitting" && <output>Logging you in...</output>}
      {status === "authenticated" && <output>{message}</output>}
      {status === "error" && <p role="alert">{message}</p>}
    </section>
  );
}
