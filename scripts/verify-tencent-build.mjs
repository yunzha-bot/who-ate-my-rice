// Root-hosted Tencent artifact audit. Does not alter the build or run any deployment.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, join, extname } from 'node:path';
import { PRODUCTION_EXCLUDED_ASSETS } from './production-assets.mjs';

const root = process.cwd(), dist = resolve(root, 'dist-tencent');
const out = resolve(process.env.TENCENT_ARTIFACT_DIR ?? 'docs/verification/tencent-ready-2026-10-23');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'public'], { encoding: 'utf8' })
  .split('\0').filter(Boolean).map(file => file.slice(7));
// Explicitly reviewed local additions; never allow all untracked public files implicitly.
const additions = ['assets/characters/human/human_v2.glb', 'assets/ui/portraits/human-hoodie-v1.png',
  'assets/ui/portraits/human-report-hoodie-v1.png'];
const approved = [...new Set([...tracked, ...additions])].filter(file => !PRODUCTION_EXCLUDED_ASSETS.includes(file));
assert(!lstatSync(dist).isSymbolicLink());
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entries = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(([, url]) => {
  assert(/^\/assets\/index-[\w-]+\.(js|css)$/.test(url), `Wrong root entry: ${url}`);
  return url.slice(1);
});
assert.equal(entries.length, 2); assert(entries.some(file => file.endsWith('.js')) && entries.some(file => file.endsWith('.css')));
const allowed = new Set(['index.html', ...entries, ...approved]), files = [];
function walk(folder) {
  for (const name of readdirSync(folder)) {
    const full = join(folder, name), stat = lstatSync(full);
    assert(!stat.isSymbolicLink(), `Linked artifact: ${full}`);
    if (stat.isDirectory()) { walk(full); continue; }
    const path = relative(dist, full).replaceAll('\\', '/');
    assert(stat.isFile() && stat.nlink === 1 && allowed.has(path), `Unexpected artifact: ${path}`);
    assert(!/(^|\/)(?:src|tests?|node_modules|incoming-assets|\.git|\.github|\.codex|\.trae|\.dsh-meow)(\/|$)|\.(?:bak|tmp|log|map)$|(^|\/)\.env/.test(path), `Private artifact: ${path}`);
    const bytes = readFileSync(full);
    if (approved.includes(path)) assert(bytes.equals(readFileSync(join(root, 'public', path))), `Changed public asset: ${path}`);
    files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
}
walk(dist);
assert.equal(files.length, allowed.size, 'Missing approved assets');
const code = entries.map(file => readFileSync(join(dist, file), 'utf8')).join('\n');
for (const forbidden of ['/who-ate-my-rice/', '127.0.0.1', 'localhost:', '/@vite/', '/src/main.ts', '/__dev/', ...PRODUCTION_EXCLUDED_ASSETS.map(file => file.split('/').at(-1))])
  assert(!code.includes(forbidden), `Unexpected production reference: ${forbidden}`);
assert(!/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKID[A-Za-z0-9]{32}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[A-Z]:\\(?:Users|桌面)\\/.test(code), 'Potential secret or private path in production code');
assert(code.includes('assets/characters/human/human_v2.glb') && code.includes('assets/ui/portraits/human-hoodie-v1.png'));
assert(!code.includes('menu-start-row'), 'Outdated separate start button');
const result = { base: '/', outDir: dist, count: files.length, bytes: files.reduce((n, file) => n + file.bytes, 0),
  extensions: Object.fromEntries([...new Set(files.map(file => extname(file.path)))].map(ext => [ext, files.filter(file => extname(file.path) === ext).length])),
  files: files.sort((a, b) => a.path.localeCompare(b.path)) };
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'artifact.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ base: result.base, count: result.count, bytes: result.bytes, extensions: result.extensions }));
