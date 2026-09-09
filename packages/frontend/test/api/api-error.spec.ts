import { describe, expect, test } from "@jest/globals";
import { ApiError } from "../../src/api/api-error.js";

describe("ApiError", () => {
  test("uses the first server message as its Error message", () => {
    const error = new ApiError(422, ["email is invalid", "password is too short"]);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(422);
    expect(error.messages).toEqual(["email is invalid", "password is too short"]);
    expect(error.message).toBe("email is invalid");
  });

  test("uses the status when the server provides no messages", () => {
    const error = new ApiError(503, []);

    expect(error.message).toBe("Request failed with status 503");
  });
});
