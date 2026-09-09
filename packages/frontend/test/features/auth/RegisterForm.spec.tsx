import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../../../src/api/api-error.js";
import { RegisterForm, type RegisterFormProps } from "../../../src/features/auth/RegisterForm.js";
import type { PublicUser } from "../../../src/api/auth.js";

const credentials = {
  email: "new@example.com",
  password: "correct-password"
};

const publicUser: PublicUser = {
  id: "user-123",
  email: credentials.email,
  username: null,
  createdDateTime: "2026-01-01T00:00:00.000Z",
  userType: "generaluser"
};

type RegisterHandler = NonNullable<RegisterFormProps["onRegister"]>;

function createRegisterMock() {
  return jest.fn<RegisterHandler>();
}

afterEach(() => {
  cleanup();
});

function fillRegistrationForm() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: credentials.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: credentials.password } });
}

function submitRegistrationForm() {
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("RegisterForm", () => {
  test("renders editable credentials fields", () => {
    render(<RegisterForm />);

    expect(screen.getByRole("heading", { name: "Create your account" })).not.toBeNull();
    expect(screen.getByLabelText("Email")).not.toBeNull();
    expect(screen.getByLabelText("Password")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Create account" })).not.toBeNull();
  });

  test("disables duplicate submissions while registration is pending", async () => {
    let resolveRegistration: (user: typeof publicUser) => void = () => undefined;
    const onRegister = jest.fn<RegisterHandler>(
      () => new Promise<typeof publicUser>((resolve) => { resolveRegistration = resolve; })
    );
    render(<RegisterForm onRegister={onRegister} />);
    fillRegistrationForm();

    submitRegistrationForm();

    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onRegister).toHaveBeenCalledWith(credentials);
    expect(screen.getByRole("button", { name: "Creating account..." })).not.toBeNull();
    expect((screen.getByRole("button", { name: "Creating account..." }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Creating your account...")).not.toBeNull();

    fireEvent.submit(document.querySelector("form")!);
    expect(onRegister).toHaveBeenCalledTimes(1);

    resolveRegistration(publicUser);
    await waitFor(() => expect(screen.getByText("Account created for new@example.com.")).not.toBeNull());
  });

  test("shows success feedback and clears the password", async () => {
    const onRegister = createRegisterMock();
    onRegister.mockResolvedValue(publicUser);
    render(<RegisterForm onRegister={onRegister} />);
    fillRegistrationForm();

    submitRegistrationForm();

    await waitFor(() => expect(screen.getByText("Account created for new@example.com.")).not.toBeNull());
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(credentials.email);
  });

  test("joins validation messages and clears the password on API failure", async () => {
    const onRegister = createRegisterMock();
    onRegister.mockRejectedValue(new ApiError(400, ["email is invalid", "password is too short"]));
    render(<RegisterForm onRegister={onRegister} />);
    fillRegistrationForm();

    submitRegistrationForm();

    await waitFor(() => expect(screen.getByRole("alert")).not.toBeNull());
    expect(screen.getByRole("alert").textContent).toBe("email is invalid. password is too short");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("alert").textContent).not.toContain(credentials.password);
  });

  test("uses generic safe feedback for an unknown failure", async () => {
    const onRegister = createRegisterMock();
    onRegister.mockRejectedValue(new Error("database password leaked"));
    render(<RegisterForm onRegister={onRegister} />);
    fillRegistrationForm();

    submitRegistrationForm();

    await waitFor(() => expect(screen.getByRole("alert")).not.toBeNull());
    expect(screen.getByRole("alert").textContent).toBe(
      "Registration could not be completed. Please try again."
    );
    expect(screen.getByRole("alert").textContent).not.toContain("database password leaked");
  });

  test("renders initial submitting, success, and error states", () => {
    render(<RegisterForm initialStatus="submitting" />);
    expect(screen.getByText("Creating your account...")).not.toBeNull();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);

    cleanup();
    render(<RegisterForm initialStatus="success" initialMessage="Account already created." />);
    expect(screen.getByText("Account already created.")).not.toBeNull();

    cleanup();
    render(<RegisterForm initialStatus="error" initialMessage="Registration failed." />);
    expect(screen.getByRole("alert").textContent).toBe("Registration failed.");
  });
});
