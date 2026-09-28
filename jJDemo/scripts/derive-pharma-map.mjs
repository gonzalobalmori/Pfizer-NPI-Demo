/*
 * Derive the exact device-era -> pharma string map from git history.
 *
 * Guessing regex rules screen by screen kept missing strings. The authored text
 * the stale C3 environment serves IS the historical content of these seed files,
 * so the complete mapping is recoverable: for every record id, in every past
 * revision, pair that revision's text fields against the current ones.
 *
 * Output is a generated TS module of exact-string pairs, applied before the
 * regex rules so whole phrases translate in one hop.
 *
 * RUN: node derive-map.mjs <repoRoot> <outFile>
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.argv[2];
const OUT = process.argv[3];
if (!ROOT || !OUT) { console.error('usage: node derive-map.mjs <repoRoot> <outFile>'); process.exit(1); }

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

const REVS = git(['log', '--format=%H', '--reverse']).trim().split('\n');
const CURRENT = REVS[REVS.length - 1];

/* Only the data/seed trees carry authored demo prose. */
const DIRS = [join('jJDemo', 'data'), join('jJDemo', 'seed')];

const ID_KEY = /(^|[a-z])(Id|Ids|Code|Codes|Ref|Key|Uri|Url)$/;
const SKIP = new Set(['id', 'ids', 'type', 'typeIdent', 'url', 'href', 'path',
  'transform', 'sourceFile', 'sourceRowKey', 'feedCode', 'version']);

/* Collect id -> {field: string} for one parsed JSON blob. */
function index(node, out) {
  if (Array.isArray(node)) { for (const v of node) index(v, out); return; }
  if (!node || typeof node !== 'object') return;
  const id = typeof node.id === 'string' ? node.id : null;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (typeof v === 'string') {
      if (id && !SKIP.has(k) && !ID_KEY.test(k) && v.trim().length > 3) {
        (out[id] ??= {})[k] = v;
      }
    } else index(v, out);
  }
}

const files = [];
for (const d of DIRS) {
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(e) === '.json') files.push(relative(ROOT, p).split('\\').join('/'));
    }
  })(join(ROOT, d));
}

/* Current state, indexed. */
const now = {};
for (const f of files) {
  try { index(JSON.parse(readFileSync(join(ROOT, f), 'utf8')), now); } catch { /* skip */ }
}

/* Every historical revision, paired against current. */
const pairs = new Map(); // old -> new
let scanned = 0;
for (const rev of REVS.slice(0, -1)) {
  for (const f of files) {
    let blob;
    try { blob = git(['show', `${rev}:${f}`]); } catch { continue; }
    let parsed;
    try { parsed = JSON.parse(blob); } catch { continue; }
    const then = {};
    index(parsed, then);
    scanned++;
    for (const [id, fields] of Object.entries(then)) {
      const cur = now[id];
      if (!cur) continue;
      for (const [k, oldVal] of Object.entries(fields)) {
        const newVal = cur[k];
        if (!newVal || newVal === oldVal) continue;
        /* Only keep pairs where the old text actually reads device-era; an
           unrelated edit (a number, a date) would otherwise be picked up. */
        if (!/comirnaty|abrysvo|hympavzi|cibinqo|velsipity|zavicefta|fragmin|zavzpret|zirabev|elrexfio|genotropin|somavert|prevnar|litfulo|steris|sterigenics|heraeus|\bbsi\b|notified body|sterilis|ethylene|\beo\b|half-cycle|510\(k\)|\bpma\b|eu mdr|\bce mark\b|ce certificate|\bdhf\b|\budi\b|v&v|design (verification|validation|input|freeze)|ring electrode|biocompat|loaner|value analysis|iso 1113|iec 623|irvine|venlo|marcoule|grand rapids|cashel|neuss|x-ray|catheter|stapler|\biol\b|device/i.test(oldVal)) continue;
        if (!pairs.has(oldVal)) pairs.set(oldVal, newVal);
      }
    }
  }
}

/* Longest first, so a phrase is replaced before any substring of it. */
const sorted = [...pairs.entries()].sort((a, b) => b[0].length - a[0].length);

const esc = (s) => JSON.stringify(s);
const body = sorted.map(([o, n]) => `  [${esc(o)}, ${esc(n)}],`).join('\n');

writeFileSync(OUT, `/*
 * GENERATED — do not edit by hand. Regenerate with scripts/derive-pharma-map.mjs.
 *
 * Exact device-era -> pharma strings, derived by pairing every historical
 * revision of the seed data against the current one, record by record. This
 * exists because the C3 environment a demo runs from may still serve the older
 * text; hand-written regex rules kept missing phrases, whereas this is complete
 * by construction for anything that was ever authored in the seed.
 *
 * ${sorted.length} pairs, longest first so a phrase wins over its substrings.
 */
export const EXACT_PAIRS: [string, string][] = [
${body}
];
`);

console.log(`scanned ${scanned} file revisions across ${REVS.length - 1} commits`);
console.log(`derived ${sorted.length} exact pairs -> ${OUT}`);
for (const [o, n] of sorted.slice(0, 12)) {
  console.log(`  ${o.slice(0, 68)}\n    -> ${n.slice(0, 68)}`);
}
