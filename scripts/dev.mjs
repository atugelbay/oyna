import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const groups = {
  client: [['client/backend', 'start:dev'], ['client/frontend', 'dev']],
  crm: [['backend', 'start:dev'], ['frontend', 'dev']],
};
const scope = process.argv[2] ?? 'client';
const apps = scope === 'all' ? [...groups.crm, ...groups.client] : groups[scope];
if (!apps || !process.env.npm_execpath) {
  console.error('Run npm run dev, dev:client or dev:crm from the repository root.');
  process.exit(1);
}
const children = apps.map(([directory, command]) => {
  console.log(`Starting ${directory} (${command})`);
  const extra = directory === 'frontend' ? ['--', '--port', '3001'] : [];
  return spawn(process.execPath, [process.env.npm_execpath, '--prefix', directory, 'run', command, ...extra], { cwd: root, stdio: 'inherit' });
});
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = code;
}
children.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
