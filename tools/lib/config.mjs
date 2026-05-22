import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

export function loadConfig() {
  const configPath = path.join(projectRoot, 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error(`\nMissing config.json at ${configPath}`);
    console.error(`Copy config.example.json to config.json and fill in your Schoology domain + cookie.\n`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!raw.domain || !raw.cookie || raw.cookie.includes('PASTE_YOUR_COOKIE')) {
    console.error('\nconfig.json is missing `domain` or `cookie`. Edit it and try again.\n');
    process.exit(1);
  }
  raw.domain = raw.domain.replace(/\/+$/, '');
  raw.dataDir = path.resolve(projectRoot, raw.dataDir || './data');
  raw.port = raw.port || 3000;
  raw.userAgent = raw.userAgent || 'Mozilla/5.0';
  return raw;
}

export { projectRoot };
