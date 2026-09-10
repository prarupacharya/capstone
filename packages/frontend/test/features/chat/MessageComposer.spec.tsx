import { afterEach, expect, jest, test } from "@jest/globals";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { MessageComposer } from "../../../src/features/chat/MessageComposer.js";

afterEach(cleanup);

test("keeps the input controlled and reports edits and submission", () => {
  const onDraftChange = jest.fn();
  const onSubmit = jest.fn<(event: FormEvent<HTMLFormElement>) => void>();
  render(
    <MessageComposer
      draft="hello" sending={false} active onDraftChange={onDraftChange} onSubmit={onSubmit}
    />
  );

  const input = screen.getByRole("textbox", { name: "Message" });
  expect(input).toHaveProperty("value", "hello");
  expect(input).toHaveProperty("maxLength", 2000);
  fireEvent.change(input, { target: { value: "updated" } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);

  expect(onDraftChange).toHaveBeenCalledWith("updated");
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("disables sending for inactive, blank, or pending drafts", () => {
  const onSubmit = jest.fn();
  const props = { draft: "hello", sending: false, active: false, onDraftChange: jest.fn(), onSubmit };
  const { rerender } = render(<MessageComposer {...props} />);
  expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);

  rerender(<MessageComposer {...props} active draft="   " />);
  expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);

  rerender(<MessageComposer {...props} active sending />);
  expect(screen.getByRole("button", { name: "Sending..." })).toHaveProperty("disabled", true);
});
