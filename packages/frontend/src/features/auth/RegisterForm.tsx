import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/api-error.js";
import { registerUser, type PublicUser, type RegistrationInput } from "../../api/auth.js";

export type RegisterFormStatus = "ready" | "submitting" | "success" | "error";

export interface RegisterFormProps {
  onRegister?: (input: RegistrationInput) => Promise<PublicUser>;
  initialStatus?: RegisterFormStatus;
  initialMessage?: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.messages.length) return error.messages.join(". ");
  return "Registration could not be completed. Please try again.";
}

export function RegisterForm({
  onRegister = registerUser,
  initialStatus = "ready",
  initialMessage = ""
}: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<RegisterFormStatus>(initialStatus);
  const [message, setMessage] = useState(initialMessage);
  const isSubmitting = status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setStatus("submitting");
    setMessage("");

    try {
      const user = await onRegister({ email, password });
      setPassword("");
      setStatus("success");
      setMessage(`Account created for ${user.email}.`);
    } catch (error) {
      setPassword("");
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <section className="auth-card" aria-labelledby="register-heading">
      <div className="auth-card__intro">
        <p className="eyebrow">Join the community</p>
        <h2 id="register-heading">Create your account</h2>
        <p>Register to continue to Capstone.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      {status === "submitting" && <p role="status">Creating your account...</p>}
      {status === "success" && <p role="status">{message}</p>}
      {status === "error" && <p role="alert">{message}</p>}
    </section>
  );
}
