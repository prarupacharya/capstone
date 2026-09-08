import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { test } from "node:test";

const dist = new URL("../dist/", import.meta.url);

function loadApp(fetchImplementation) {
  const html = readFileSync(new URL("index.html", dist), "utf8");
  const scriptName = readdirSync(new URL("assets/", dist)).find((name) => name.endsWith(".js"));
  const script = readFileSync(new URL(`assets/${scriptName}`, dist), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only" });

  dom.window.fetch = fetchImplementation;
  dom.window.eval(script);
  return dom;
}

async function settle(dom) {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  }
}

test("shows connected state after a successful health request", async () => {
  let requestedUrl;
  const dom = loadApp(async (url) => {
    requestedUrl = String(url);
    return { ok: true, status: 200, json: async () => ({ status: "ok", service: "backend" }) };
  });

  await settle(dom);

  assert.equal(requestedUrl, "http://localhost:3000/health");
  assert.equal(dom.window.document.querySelector("[role=status]")?.textContent, "Backend connected.");
});

test("shows unavailable state when the health request fails", async () => {
  const dom = loadApp(async () => {
    throw new Error("backend offline");
  });

  await settle(dom);

  assert.equal(dom.window.document.querySelector("[role=alert]")?.textContent, "Backend unavailable.");
});
