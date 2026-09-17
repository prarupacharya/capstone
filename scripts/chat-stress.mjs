/* global AbortSignal */
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// The frontend already declares this client, so an npm install at the repo root is enough.
const requireFrontend = createRequire(new URL("../packages/frontend/package.json", import.meta.url));
const { io } = requireFrontend("socket.io-client");
const STAGES = ["register", "login", "rooms", "connect", "join", "send", "leave"];

function positiveInteger(value, flag, { allowZero = false } = {}) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1)) {
    throw new Error(`${flag} must be ${allowZero ? "a nonnegative" : "a positive"} integer`);
  }
  return number;
}

export function parseOptions(args) {
  const options = {
    url: "http://localhost:3000",
    users: 10,
    concurrency: undefined,
    timeoutMs: 10000,
    holdMs: 0,
    output: undefined
  };
  const flags = new Set(["--url", "--users", "--concurrency", "--timeout-ms", "--hold-ms", "--output"]);
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!flags.has(flag) || !args[index + 1]) {
      throw new Error(`Invalid argument ${flag ?? ""}. Use --url, --users, --concurrency, --timeout-ms, --hold-ms, or --output.`);
    }
    const value = args[index + 1];
    if (flag === "--url") options.url = value;
    if (flag === "--users") options.users = positiveInteger(value, flag);
    if (flag === "--concurrency") options.concurrency = positiveInteger(value, flag);
    if (flag === "--timeout-ms") options.timeoutMs = positiveInteger(value, flag);
    if (flag === "--hold-ms") options.holdMs = positiveInteger(value, flag, { allowZero: true });
    if (flag === "--output") options.output = value;
  }
  const url = new URL(options.url);
  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("--url must be an HTTP(S) origin, such as http://localhost:3000");
  }
  options.url = url.origin;
  options.concurrency = Math.min(options.concurrency ?? options.users, options.users);
  return options;
}

async function requestJson(url, method, body, token, timeoutMs) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${payload?.message ?? response.statusText}`);
  }
  return payload;
}

function connect(url, token, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = io(url, {
      auth: { token },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: timeoutMs
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => {
      socket.disconnect();
      reject(error);
    });
  });
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * fraction) - 1]);
}

export function summarize(results, options, runId, durationMs, flowDurationMs, peakSockets) {
  const stages = Object.fromEntries(STAGES.map((stage) => {
    const attempts = results.filter((result) => stage in result.timings);
    const successes = attempts.filter((result) => result.timings[stage].ok);
    const latencies = successes.map((result) => result.timings[stage].ms);
    return [stage, {
      attempts: attempts.length,
      passed: successes.length,
      failed: attempts.length - successes.length,
      p50Ms: percentile(latencies, 0.5),
      p95Ms: percentile(latencies, 0.95)
    }];
  }));
  const completedUsers = results.filter((result) => result.ok).length;
  return {
    runId,
    url: options.url,
    requestedUsers: options.users,
    concurrency: options.concurrency,
    completedUsers,
    failedUsers: options.users - completedUsers,
    peakOpenSockets: peakSockets,
    durationMs: Math.round(durationMs),
    flowDurationMs: Math.round(flowDurationMs),
    completedUsersPerSecond: Number((completedUsers / (flowDurationMs / 1000)).toFixed(2)),
    stages,
    failureExamples: results.filter((result) => !result.ok).slice(0, 10).map(({ index, error }) => ({ index, ...error }))
  };
}

export async function runStress(options) {
  const health = await requestJson(`${options.url}/health`, "GET", null, null, options.timeoutMs);
  if (health?.status !== "up") throw new Error(`Backend is not ready: ${JSON.stringify(health)}`);

  const runId = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const password = `Stress-${randomBytes(12).toString("hex")}`;
  const results = Array(options.users);
  const openSockets = new Set();
  let peakSockets = 0;
  let nextIndex = 0;
  const started = performance.now();
  let flowDurationMs;

  async function runUser(index) {
    const email = `stress-${runId}-${index}@example.test`;
    const timings = {};
    let stage = "register";
    let socket;
    let chatroomId;
    let joinedRoom = false;
    async function step(name, operation) {
      stage = name;
      const start = performance.now();
      try {
        const value = await operation();
        timings[name] = { ok: true, ms: Math.round(performance.now() - start) };
        return value;
      } catch (error) {
        timings[name] = { ok: false, ms: Math.round(performance.now() - start) };
        throw error;
      }
    }

    async function leaveRoom() {
      await step("leave", async () => {
        const left = await socket.timeout(options.timeoutMs).emitWithAck(
          "leaveRoom", { chatroomId }
        );
        if (!left?.ok || left.data?.chatroomId !== chatroomId) {
          throw new Error(`leaveRoom rejected: ${left?.error?.code ?? "invalid acknowledgement"}`);
        }
      });
      joinedRoom = false;
    }

    try {
      await step("register", async () => {
        const registered = await requestJson(
          `${options.url}/auth/register`, "POST", { email, password }, null, options.timeoutMs
        );
        if (registered?.email !== email) throw new Error("registration returned the wrong user");
      });

      const login = await step("login", async () => {
        const response = await requestJson(
          `${options.url}/auth/login`, "POST", { email, password }, null, options.timeoutMs
        );
        if (typeof response?.accessToken !== "string") throw new Error("login returned no access token");
        return response;
      });

      const general = await step("rooms", async () => {
        const rooms = await requestJson(
          `${options.url}/chatrooms`, "GET", null, login.accessToken, options.timeoutMs
        );
        const room = Array.isArray(rooms) && rooms.find((entry) => entry.chatroomName?.toLowerCase() === "general");
        if (!room?.id) throw new Error("General room was not found");
        return room;
      });
      chatroomId = general.id;

      socket = await step("connect", () => connect(options.url, login.accessToken, options.timeoutMs));
      openSockets.add(socket);
      socket.on("disconnect", () => openSockets.delete(socket));
      peakSockets = Math.max(peakSockets, openSockets.size);

      await step("join", async () => {
        const joined = await socket.timeout(options.timeoutMs).emitWithAck(
          "joinRoom", { chatroomId }
        );
        if (!joined?.ok || joined.data?.chatroomId !== chatroomId) {
          throw new Error(`joinRoom rejected: ${joined?.error?.code ?? "invalid acknowledgement"}`);
        }
      });
      joinedRoom = true;

      const message = `Stress test ${runId}, user ${index}`;
      await step("send", async () => {
        const sent = await socket.timeout(options.timeoutMs).emitWithAck(
          "sendMessage", { chatroomId, message }
        );
        if (!sent?.ok || sent.data?.chatroomId !== chatroomId || sent.data?.message !== message ||
            sent.data?.senderEmail !== email || !sent.data?.id) {
          throw new Error(`sendMessage rejected: ${sent?.error?.code ?? "invalid acknowledgement"}`);
        }
      });
      await leaveRoom();
      return { index, ok: true, timings };
    } catch (error) {
      const failedStage = stage;
      if (joinedRoom && failedStage !== "leave" && socket?.connected) {
        try {
          await leaveRoom();
        } catch {
          // Preserve the original failure while still recording the leave attempt.
        }
      }
      if (socket) {
        socket.disconnect();
        openSockets.delete(socket);
      }
      return { index, ok: false, timings, error: { stage: failedStage, message: error.message } };
    }
  }

  try {
    await Promise.all(Array.from({ length: options.concurrency }, async () => {
      while (nextIndex < options.users) {
        const index = ++nextIndex;
        results[index - 1] = await runUser(index);
      }
    }));
    flowDurationMs = performance.now() - started;
    if (options.holdMs) await delay(options.holdMs);
  } finally {
    for (const socket of openSockets) socket.disconnect();
  }
  return summarize(results, options, runId, performance.now() - started, flowDurationMs, peakSockets);
}

function printSummary(summary) {
  console.log(`\nChat stress run ${summary.runId}`);
  console.log(`Users: ${summary.completedUsers}/${summary.requestedUsers} completed; concurrency: ${summary.concurrency}; peak open sockets: ${summary.peakOpenSockets}`);
  console.log(`Flow duration: ${summary.flowDurationMs} ms; total duration: ${summary.durationMs} ms; completed users/sec: ${summary.completedUsersPerSecond}`);
  console.table(summary.stages);
  if (summary.failureExamples.length) console.table(summary.failureExamples);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const options = parseOptions(process.argv.slice(2));
    const summary = await runStress(options);
    printSummary(summary);
    if (options.output) await writeFile(options.output, `${JSON.stringify(summary, null, 2)}\n`);
    if (summary.failedUsers) process.exitCode = 1;
  } catch (error) {
    console.error(`Chat stress test failed: ${error.message}`);
    process.exitCode = 1;
  }
}
