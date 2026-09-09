import { afterEach, expect, jest, test } from "@jest/globals";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DashboardPage } from "../../../src/features/chat/DashboardPage.js";

afterEach(cleanup);

test("renders the verified user's dashboard and logs out", () => {
  const onLogout = jest.fn();

  render(
    <DashboardPage
      user={{ id: "user-123", email: "user@example.com", userType: "generaluser" }}
      onLogout={onLogout}
    />
  );

  expect(screen.getByRole("heading", { name: "Welcome to LF-Chat" })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "user@example.com" })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(onLogout).toHaveBeenCalledTimes(1);
});
