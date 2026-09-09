import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../../../src/api/api-error.js";
import type { LoginResult } from "../../../src/api/auth.js";
import { ACCESS_TOKEN_KEY } from "../../../src/auth/session.js";
import { LoginForm, type LoginFormProps } from "../../../src/features/auth/LoginForm.js";

const credentials = {
  email: "user@example.com",
  password: "correct-password"
};

const loginResult: LoginResult = { accessToken: "header.payload.signature" };
type LoginHandler = NonNullable<LoginFormProps["onLogin"]>;

function createLoginMock() {
  return jest.fn<LoginHandler>();
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

function fillLoginForm() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: credentials.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: credentials.password } });
}

function submitLoginForm() {
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  test("renders editable credentials fields", () => {
    render(<LoginForm />);

    expect(screen.getByRole("heading", { name: "Log in" })).not.toBeNull();
    expect(screen.getByLabelText("Email")).not.toBeNull();
    expect(screen.getByLabelText("Password")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Log in" })).not.toBeNull();
  });

  test("disables duplicate submissions while login is pending", async () => {
    let resolveLogin: (result: LoginResult) => void = () => undefined;
    const onLogin = jest.fn<LoginHandler>(
      () => new Promise<LoginResult>((resolve) => { resolveLogin = resolve; })
    );
    render(<LoginForm onLogin={onLogin} />);
    fillLoginForm();

    submitLoginForm();

    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledWith(credentials);
    const pendingButton = screen.getByRole("button", { name: "Logging in..." }) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    expect(screen.getByText("Logging you in...")).not.toBeNull();

    fireEvent.submit(document.querySelector("form")!);
    expect(onLogin).toHaveBeenCalledTimes(1);

    resolveLogin(loginResult);
    await waitFor(() => expect(screen.getByText("You are signed in.")).not.toBeNull());
  });

  test("saves the token, clears the password, and notifies the parent on success", async () => {
    const onLogin = createLoginMock();
    const onAuthenticated = jest.fn();
    onLogin.mockResolvedValue(loginResult);
    render(<LoginForm onLogin={onLogin} onAuthenticated={onAuthenticated} />);
    fillLoginForm();

    submitLoginForm();

    await waitFor(() => expect(screen.getByText("You are signed in.")).not.toBeNull());
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe(loginResult.accessToken);
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  test("joins API messages and clears stale session state on failure", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "stale-token");
    const onLogin = createLoginMock();
    onLogin.mockRejectedValue(new ApiError(401, ["invalid email", "invalid password"]));
    render(<LoginForm onLogin={onLogin} />);
    fillLoginForm();

    submitLoginForm();

    await waitFor(() => expect(screen.getByRole("alert")).not.toBeNull());
    expect(screen.getByRole("alert").textContent).toBe("invalid email. invalid password");
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("alert").textContent).not.toContain(credentials.password);
  });

  test("uses generic safe feedback for an unknown failure", async () => {
    const onLogin = createLoginMock();
    onLogin.mockRejectedValue(new Error("database password leaked"));
    render(<LoginForm onLogin={onLogin} />);
    fillLoginForm();

    submitLoginForm();

    await waitFor(() => expect(screen.getByRole("alert")).not.toBeNull());
    expect(screen.getByRole("alert").textContent).toBe(
      "Login could not be completed. Please try again."
    );
    expect(screen.getByRole("alert").textContent).not.toContain("database password leaked");
  });

  test("renders initial submitting, authenticated, and error states", () => {
    render(<LoginForm initialStatus="submitting" />);
    expect(screen.getByText("Logging you in...")).not.toBeNull();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);

    cleanup();
    render(<LoginForm initialStatus="authenticated" initialMessage="Already signed in." />);
    expect(screen.getByText("Already signed in.")).not.toBeNull();

    cleanup();
    render(<LoginForm initialStatus="error" initialMessage="Login failed." />);
    expect(screen.getByRole("alert").textContent).toBe("Login failed.");
  });
});
