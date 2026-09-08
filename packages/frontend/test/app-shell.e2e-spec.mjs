import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { test } from "node:test";

const dist = new URL("../dist/", import.meta.url);

test("the production bundle renders the application shell", async () => {
  const html = readFileSync(new URL("index.html", dist), "utf8");
  const scriptName = readdirSync(new URL("assets/", dist)).find((name) => name.endsWith(".js"));
  const script = readFileSync(new URL(`assets/${scriptName}`, dist), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only" });

  dom.window.eval(script);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(dom.window.document.querySelector("title")?.textContent, "Capstone");
  assert.equal(dom.window.document.querySelector("h1")?.textContent, "Capstone");
  assert.equal(
    dom.window.document.querySelector("p")?.textContent,
    "Frontend application shell is ready."
  );
});
