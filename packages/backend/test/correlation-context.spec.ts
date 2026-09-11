import { getCorrelationId, runWithCorrelationId } from "../src/common/logging/correlation-context";

describe("correlation context", () => {
  it("uses the system ID outside a request", () => {
    expect(getCorrelationId()).toBe("system");
    expect(getCorrelationId(" ")).toBe("system");
  });

  it("keeps concurrent asynchronous scopes isolated", async () => {
    const ids = await Promise.all(["request-a", "request-b"].map((id) =>
      runWithCorrelationId(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return getCorrelationId();
      })
    ));

    expect(ids).toEqual(["request-a", "request-b"]);
    expect(getCorrelationId()).toBe("system");
  });
});
