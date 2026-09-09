import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const projectRoot = process.cwd();
const propertiesPath = resolve(projectRoot, '.sonar-project.properties');

if (!existsSync(propertiesPath)) {
  console.error(
    'Missing .sonar-project.properties. Create it with: Copy-Item .sonar-project.properties.example .sonar-project.properties',
  );
  process.exit(1);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const scannerCommands = process.platform === 'win32'
  ? ['sonar.bat', 'sonar-scanner.bat', 'sonar.cmd', 'sonar-scanner.cmd', 'sonar', 'sonar-scanner']
  : ['sonar', 'sonar-scanner'];

const findCommand = (commands) => {
  for (const command of commands) {
    try {
      const output = process.platform === 'win32'
        ? execFileSync('where.exe', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        : execFileSync('which', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const scannerPath = output.split(/\r?\n/).find(Boolean)?.trim();
      if (scannerPath) return scannerPath;
    } catch {
      // Try the next scanner command.
    }
  }
  return null;
};

const run = (command, args, useShell = false) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: useShell,
  });

  child.once('error', rejectRun);
  child.once('exit', (code, signal) => resolveRun(signal ? 1 : (code ?? 1)));
});

const coverageExit = await run(npmCommand, ['run', 'test:coverage', '--workspace', 'backend'], process.platform === 'win32');
if (coverageExit !== 0) process.exit(coverageExit);

const scannerPath = findCommand(scannerCommands);
if (scannerPath) {
  const exitCode = await run(
    scannerPath,
    [`-Dproject.settings=${propertiesPath}`],
    process.platform === 'win32',
  );
  process.exit(exitCode);
}

const dockerPath = findCommand(process.platform === 'win32' ? ['docker.exe', 'docker'] : ['docker']);
if (!dockerPath) {
  console.error('SonarScanner and Docker were not found. Install SonarScanner CLI or Docker and ensure it is on PATH.');
  process.exit(1);
}

const properties = readFileSync(propertiesPath, 'utf8');
const configuredHostUrl = properties
  .split(/\r?\n/)
  .find((line) => /^\s*sonar\.host\.url\s*=/.test(line))
  ?.replace(/^\s*sonar\.host\.url\s*=\s*/, '')
  .trim() || 'http://localhost:9000';

let dockerHostUrl = configuredHostUrl;
try {
  const parsedHostUrl = new URL(configuredHostUrl);
  if (['localhost', '127.0.0.1', '::1'].includes(parsedHostUrl.hostname)) {
    parsedHostUrl.hostname = 'host.docker.internal';
    dockerHostUrl = parsedHostUrl.toString().replace(/\/$/, '');
  }
} catch {
  console.error(`Invalid sonar.host.url in .sonar-project.properties: ${configuredHostUrl}`);
  process.exit(1);
}

console.log('Local SonarScanner not found; running the official scanner with Docker.');
const exitCode = await run(dockerPath, [
  'run',
  '--rm',
  '--add-host',
  'host.docker.internal:host-gateway',
  '--volume',
  `${projectRoot}:/usr/src`,
  'sonarsource/sonar-scanner-cli',
  '-Dproject.settings=/usr/src/.sonar-project.properties',
  `-Dsonar.host.url=${dockerHostUrl}`,
]);

process.exit(exitCode);
