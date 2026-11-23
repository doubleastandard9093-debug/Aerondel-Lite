// Preload that runs any tools/*-check.cjs against the production bundle instead of js/ sources:
//   node -r ./tools/bundle-mode.cjs tools/gamepad-check.cjs '' low
// (sets localStorage aerondel.bundle=1 before every page load; index.html then imports bundle/aerondel.js on localhost).
// Checks that import('/js/<module>.js') into the page get a second copy of that module, so stateful ones will not see the game.
const pp = require('/workspace/pptr/node_modules/puppeteer-core');
const launch = pp.launch.bind(pp);
pp.launch = async (...a) => {
  const b = await launch(...a), np = b.newPage.bind(b);
  b.newPage = async (...x) => { const p = await np(...x); await p.evaluateOnNewDocument(() => { try { localStorage.setItem('aerondel.bundle', '1'); } catch (e) {} }); return p; };
  return b;
};
