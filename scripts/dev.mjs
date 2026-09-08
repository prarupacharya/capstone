import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
let stopping = false;
const services = [
  ["backend", ["run", "start:dev", "--workspace", "backend"]],
  ["frontend", ["run", "dev", "--workspace", "frontend"]]
];
const children = services.map(([name, args]) => {
  const child = spawn(npm, args, {
    shell: process.platform === "win32",
    stdio: "inherit"
  });
  child.on("exit", (code) => {
    if (!stopping) shutdown(code ?? 1);
  });
  process.stdout.write(`Started ${name}\n`);
  return child;
});

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
