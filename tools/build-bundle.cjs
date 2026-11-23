// Builds bundle/aerondel.js: the whole game (js/**) as one minified ES module for fast phone loads.
// three.js and its addons stay external (importmap, jsdelivr CDN). index.html loads the bundle by default,
// or js/main.js directly with ?dev (what the tools/*-check.cjs suites use on localhost).
// Usage: node tools/build-bundle.cjs          -> rebuild bundle/aerondel.js
//        node tools/build-bundle.cjs --check  -> exit 1 if the bundle is stale (sources changed since the last build)
// Re-run after ANY change under js/ and commit bundle/ together with the source change.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
let esbuild;
try { esbuild = require('esbuild'); } catch { esbuild = require('/workspace/pptr/node_modules/esbuild'); }
const OUT = path.join(root, 'bundle', 'aerondel.js');

function srcHash() {
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) files.push(p); } })(path.join(root, 'js'));
  files.sort(); const h = crypto.createHash('sha256');
  for (const f of files) { h.update(path.relative(root, f).split(path.sep).join('/')); h.update('\0'); h.update(fs.readFileSync(f)); h.update('\0'); }
  return h.digest('hex').slice(0, 16);
}
const hash = srcHash(), tag = `/* aerondel bundle src:${hash} (built by tools/build-bundle.cjs; do not edit) */`;

if (process.argv.includes('--check')) {
  const head = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').slice(0, 200) : '';
  if (!head.includes(`src:${hash}`)) { console.error(`STALE: bundle/aerondel.js does not match js/ (want src:${hash}). Run: node tools/build-bundle.cjs`); process.exit(1); }
  console.log(`ok: bundle matches js/ (src:${hash})`); process.exit(0);
}
esbuild.build({
  entryPoints: [path.join(root, 'js', 'main.js')], outfile: OUT, bundle: true, format: 'esm', minify: true,
  target: ['es2020', 'safari15'], external: ['three', 'three/addons/*'], legalComments: 'none', charset: 'utf8',
  banner: { js: tag }, logLevel: 'warning', metafile: true,
}).then(r => {
  const n = Object.keys(r.metafile.inputs).length, sz = fs.statSync(OUT).size;
  const gz = require('zlib').gzipSync(fs.readFileSync(OUT), { level: 9 }).length;
  console.log(`bundle/aerondel.js: ${n} modules, ${(sz / 1024).toFixed(0)} KB raw, ${(gz / 1024).toFixed(0)} KB gzip, src:${hash}`);
}).catch(() => process.exit(1));
