import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTION_EXCLUDED_ASSETS } from './production-assets.mjs';

const base = '/who-ate-my-rice/';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Read-only upload gate: tracked public assets plus this build's HTML/JS/CSS, never the checkout. */
export function verifyPagesBuild(root = process.cwd(), publicFiles) {
  const dist = resolve(root, 'dist');
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  require(!lstatSync(dist).isSymbolicLink(), 'dist must not be a link');
  publicFiles ??= execFileSync('git', ['ls-files', '-z', '--', 'public'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean).map(file => file.slice('public/'.length));
  const approved = publicFiles.filter(file => !PRODUCTION_EXCLUDED_ASSETS.includes(file));
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const entries = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => {
    require(match[1].startsWith(`${base}assets/`), `Wrong Pages entry URL: ${match[1]}`);
    const file = match[1].slice(base.length);
    require(/^assets\/index-[\w-]+\.(?:js|css)$/.test(file), `Unexpected entry: ${file}`);
    return file;
  });
  require(entries.some(file => file.endsWith('.js')) && entries.some(file => file.endsWith('.css')), 'Missing app entries');
  const allowed = new Set(['index.html', ...entries, ...approved]);
  const files = [];
  function walk(folder) {
    for (const name of readdirSync(folder)) {
      const full = join(folder, name), stat = lstatSync(full);
      require(!stat.isSymbolicLink(), `Linked artifact: ${full}`);
      if (stat.isDirectory()) { walk(full); continue; }
      require(stat.isFile() && stat.nlink === 1, `Non-regular or hard-linked artifact: ${full}`);
      const file = relative(dist, full).replaceAll('\\', '/');
      require(!/(^|\/)(?:tests?|src|node_modules|incoming-assets|\.git|\.github|\.codex|\.trae|\.dsh-meow)(\/|$)|\.(?:bak|tmp|log|map)$/.test(file), `Private/development artifact: ${file}`);
      require(allowed.has(file), `Unapproved artifact: ${file}`);
      const bytes = readFileSync(full);
      if (approved.includes(file)) require(bytes.equals(readFileSync(join(root, 'public', file))), `Changed public asset: ${file}`);
      files.push({ path: file, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  walk(dist);
  for (const file of allowed) require(files.some(entry => entry.path === file), `Missing artifact: ${file}`);
  const glbs = files.filter(file => file.path.endsWith('.glb')).map(file => file.path).sort();
  require(JSON.stringify(glbs) === JSON.stringify(['assets/characters/deepseek/deepseek_animated_v6_hair.glb', 'assets/props/rice-bag/rice-bag.glb']), 'Unexpected production models');
  const code = entries.map(file => readFileSync(join(dist, file), 'utf8')).join('\n');
  for (const name of ['KeyZ', 'KeyC', 'KeyX', '/__dev/', ...PRODUCTION_EXCLUDED_ASSETS.map(file => file.split('/').at(-1))])
    require(!code.includes(name), `Development/private reference: ${name}`);
  require(!/["'`]\/(?:assets|ui)\/|url\(["']?\/(?:assets|ui)\//.test(code), 'Root asset URL remains');
  // Rollup may keep BASE_URL in a shared constant instead of folding every template.
  require(code.includes(base) && code.includes('assets/characters/deepseek/deepseek_animated_v6_hair.glb'), 'Missing base-aware v6 URL');
  return { base, files: files.sort((a, b) => a.path.localeCompare(b.path)), count: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(verifyPagesBuild(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
