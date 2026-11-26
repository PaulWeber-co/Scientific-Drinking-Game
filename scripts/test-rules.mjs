#!/usr/bin/env node
/**
 * Startet den offiziellen Realtime-Database-Emulator und prüft
 * `database.rules.json` mit tests/rules/*.test.ts.
 *
 *   npm run test:rules
 *
 * Braucht Java (wie jeder Firebase-Emulator). Die JAR-Datei kommt von der
 * Download-Adresse, die auch `firebase-tools` benutzt; die SHA-256-Prüfsumme
 * ist hier fest eingetragen (Quelle: firebase-tools
 * lib/emulator/downloadableEmulatorInfo.json). Stimmt sie nicht, bricht das
 * Skript ab, statt fremden Code zu starten.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const VERSION = '4.11.2';
const SHA256 = 'b70d99344caf17c98b6f910fa8f6edf32a7c016cb1035e8915f70d38901eb97f';
const URL_JAR = `https://storage.googleapis.com/firebase-preview-drop/emulator/firebase-database-emulator-v${VERSION}.jar`;
const CACHE =
  process.env.FIREBASE_EMULATOR_CACHE ?? join(homedir(), '.cache', 'firebase', 'emulators');
const JAR = join(CACHE, `firebase-database-emulator-v${VERSION}.jar`);
const PORT = Number(process.env.RULES_EMULATOR_PORT ?? 9000);

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

async function ensureJar() {
  if (existsSync(JAR) && sha256(JAR) === SHA256) return;
  mkdirSync(CACHE, { recursive: true });
  const tmp = `${JAR}.download`;
  console.log(`Lade Database-Emulator ${VERSION} …`);
  const res = await fetch(URL_JAR);
  if (!res.ok || !res.body) throw new Error(`Download fehlgeschlagen: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  const got = sha256(tmp);
  if (got !== SHA256) {
    rmSync(tmp, { force: true });
    throw new Error(`Prüfsumme des Emulators stimmt nicht (${got}). Abbruch.`);
  }
  renameSync(tmp, JAR);
}

async function waitForEmulator(timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/.json?ns=demo-pegel-rules`);
      if (res.ok || res.status === 401) return;
    } catch {
      /* noch nicht oben */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Database-Emulator ist nicht gestartet.');
}

await ensureJar();
const emu = spawn(
  'java',
  ['-Duser.language=en', '-jar', JAR, '--host', '127.0.0.1', '--port', String(PORT)],
  {
    stdio: ['ignore', 'ignore', 'inherit'],
  },
);
const stop = () => emu.kill();
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

try {
  await waitForEmulator();
  const vitest = spawn('npx', ['vitest', 'run', '--config', 'vitest.rules.config.ts'], {
    stdio: 'inherit',
    env: { ...process.env, FIREBASE_DATABASE_EMULATOR_HOST: `127.0.0.1:${PORT}` },
  });
  const code = await new Promise((resolve) => vitest.on('exit', resolve));
  process.exit(code ?? 1);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
