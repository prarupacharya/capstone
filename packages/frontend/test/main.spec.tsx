import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fileURLToPath } from "node:url";
import { StrictMode } from "react";

const renderMock = jest.fn();
const createRootMock = jest.fn(() => ({ render: renderMock }));

jest.unstable_mockModule(
  fileURLToPath(new URL("../../../node_modules/react-dom/client.js", import.meta.url)),
  () => ({ createRoot: createRootMock })
);

const { default: App } = await import("../src/App.js");

describe("main bootstrap", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    createRootMock.mockClear();
    renderMock.mockClear();
  });

  test("mounts App into the root under StrictMode", async () => {
    await import("../src/main.tsx");

    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderMock).toHaveBeenCalledTimes(1);
    const renderedTree = renderMock.mock.calls[0][0] as {
      type: unknown;
      props: { children: { type: unknown } };
    };
    expect(renderedTree.type).toBe(StrictMode);
    expect(renderedTree.props.children.type).toBe(App);
  });
});
