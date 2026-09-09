import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { HomePage } from "../../../src/features/home/HomePage.js";

test("renders the home application shell", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { name: "Capstone" })).not.toBeNull();
  expect(screen.getByText("Frontend application shell is ready.")).not.toBeNull();
});
