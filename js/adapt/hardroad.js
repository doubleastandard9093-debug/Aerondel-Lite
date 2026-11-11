// Hardroad: optional hunger, thirst and rest meters. Off by default, never lethal.
// Existing food still heals; wells and waterskins fill thirst; beds at a Townstead, Waycamp (and a later Hearthstead) fill rest.
// Low meters only slow health / prayer regen and run-energy recovery. Turn it off at any time; meters pause.
import { setEatHook } from '../gameplay.js';
import { NORM, obj, num } from './state.js';

export const METER_MAX = 100, DRAIN_MS = 45000, LOW = 30;

NORM.road = v => {
  v = obj(v);
  const meter = k => Math.max(0, Math.min(METER_MAX, Math.floor(num(v[k], METER_MAX, 0))));
  return { on: !!v.on, hunger: meter('hunger'), thirst: meter('thirst'), rest: meter('rest'), hideHud: !!v.hideHud };
};

export default function hardroad(A) {
  const { ctx, player } = A;
  const S = () => A.S('road');
  let last = Date.now();

  const lowest = () => Math.min(S().hunger, S().thirst, S().rest);
  const mul = () => {
    if (!S().on) return 1;
    const L = lowest();
    if (L >= LOW) return 1;
    return 0.5 + 0.5 * (L / LOW); // at 0, half speed — never a full stop, never lethal
  };
  A.roadOn = () => !!S().on;
  A.roadMeters = () => ({ hunger: S().hunger, thirst: S().thirst, rest: S().rest });
  A.roadRegen = kind => mul();
  A.roadToggle = (on = !S().on) => {
    S().on = !!on;
    last = Date.now();
    A.log(S().on ? 'Hardroad is on. Hunger, thirst and rest will tick. They never kill you, never strip XP, and never block a skill. Turn it off at any time.' : 'Hardroad is off. The meters pause and are not used.', 'game');
    refreshHud(); A.dirty(); return S().on;
  };
  A.roadFill = (kind, n) => {
    if (!['hunger', 'thirst', 'rest'].includes(kind)) return 0;
    const before = S()[kind];
    S()[kind] = Math.min(METER_MAX, S()[kind] + Math.max(0, Math.floor(n)));
    if (S()[kind] !== before) A.dirty();
    refreshHud();
    return S()[kind] - before;
  };
  A.roadDrink = (why, n = 25) => {
    const got = A.roadFill('thirst', n);
    if (got && S().on) A.log('That helps your thirst.', 'game');
    return got;
  };
  A.roadEat = (n = 25) => {
    const got = A.roadFill('hunger', n);
    if (got && S().on) A.log('That helps your hunger. The food still heals as it always did.', 'game');
    return got;
  };
  A.roadRest = (n = 70) => {
    const got = A.roadFill('rest', n);
    if (got && S().on) A.log('You rest. That helps your rest meter.', 'game');
    return got;
  };
  A.roadTick = (ms) => {
    if (!S().on) { last = Date.now(); return; }
    const span = ms != null ? ms : (Date.now() - last);
    if (span < DRAIN_MS) return;
    const steps = Math.floor(span / DRAIN_MS);
    last += steps * DRAIN_MS;
    for (const k of ['hunger', 'thirst', 'rest']) S()[k] = Math.max(0, S()[k] - steps);
    // Meters do not damage you, do not strip XP, and do not block skills.
    A.dirty(); refreshHud();
  };
  A.hpRegenMul = () => mul();
  A.runRegenMul = () => mul();
  const prevPray = A.prayerRegenMul;
  A.prayerRegenMul = () => (prevPray ? prevPray() : 1) * mul();

  setEatHook(() => A.roadEat(25));
  const prevStead = A.steadRest;
  if (prevStead) A.steadRest = (...args) => { const r = prevStead(...args); if (r !== false) A.roadRest(70); return r; };
  const prevCamp = A.campRest;
  if (prevCamp) A.campRest = (...args) => { const r = prevCamp(...args); if (r !== false) A.roadRest(70); return r; };

  A.every(10, () => A.roadTick());

  let hud = null;
  const refreshHud = () => {
    if (typeof document === 'undefined') return;
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'roadHud';
      hud.style.cssText = 'position:fixed;top:calc(48px + var(--st,0px));left:calc(8px + var(--sl,0px));z-index:41;color:#f0e6d0;font-size:12px;text-shadow:0 1px 2px #000;pointer-events:none;';
      document.body.appendChild(hud);
    }
    const hide = !S().on || S().hideHud;
    hud.style.display = hide ? 'none' : 'block';
    if (!hide) hud.textContent = `Hunger ${S().hunger} · Thirst ${S().thirst} · Rest ${S().rest}`;
  };
  A.onReady.push(refreshHud);
  A.roadHideHud = on => { S().hideHud = on == null ? !S().hideHud : !!on; refreshHud(); A.dirty(); return S().hideHud; };

  A.npc('hardroad', '🥖', 'Roadwise Marla', 'Hardroad is an optional way of travelling. When it is on, hunger, thirst and rest tick slowly. Food still heals, a well or waterskin helps thirst, and a Townstead or Waycamp bed helps rest. If a meter is low, your health, prayer and run energy recover more slowly. The meters never kill you, never strip XP, and never block a skill. You can turn it off at any time. An Oathframe\'s core still drains either way — that is a frame rule, not a survival rule.', 'road');
  A.guide.push(['Hardroad', 'Settings → Hardroad, or Ventures ✦ → Hardroad, or talk to Roadwise Marla in Larkhaven. Off by default on new and old saves. Three light meters. Never lethal. Turn it off mid-session and the meters pause.']);
  A.tab({ id: 'road', icon: '🥖', name: 'Hardroad', render: () => {
    const s = S();
    return `<h4>Hardroad</h4><p>An optional travel mode. When it is on, hunger, thirst and rest tick. Food still heals as it always did. Wells and waterskins help thirst. A Townstead or Waycamp bed helps rest. Low meters only slow health, prayer and run-energy recovery. They never kill you, never strip XP, and never block a skill. An Oathframe core still drains in or out of Hardroad.</p>
      <p>Hunger <b>${s.hunger}</b> · Thirst <b>${s.thirst}</b> · Rest <b>${s.rest}</b></p>
      <div class="row"><button data-a="tog" style="min-height:44px">${s.on ? 'Turn Hardroad off' : 'Turn Hardroad on'}</button>
      <button data-a="hud">${s.hideHud ? 'Show the meters' : 'Hide the meters'}</button></div>`;
  }, act: a => { if (a === 'tog') A.roadToggle(); if (a === 'hud') A.roadHideHud(); } });

  A.vtests = A.vtests || {};
  A.vtests.hardroad = async (g, A) => {
    const s = S();
    const snap = { on: s.on, hunger: s.hunger, thirst: s.thirst, rest: s.rest, hideHud: s.hideHud };
    try {
      s.on = false; s.hunger = 100; s.thirst = 100; s.rest = 100;
      const full = A.roadRegen();
      if (full !== 1) return 'mul off ' + full;
      A.roadToggle(true);
      if (!s.on) return 'not on';
      s.hunger = 0; s.thirst = 0; s.rest = 0;
      const slow = A.roadRegen();
      if (!(slow > 0 && slow < 1)) return 'mul low ' + slow;
      if (A.hpRegenMul() !== slow || A.runRegenMul() !== slow) return 'hp/run mul';
      if (!(A.prayerRegenMul() <= slow + 1e-9)) return 'prayer mul';
      // Cannot starve to death.
      const hp0 = g.player.hp;
      A.roadTick(DRAIN_MS * 20);
      if (g.player.hp < hp0) return 'meters dealt damage';
      if (s.hunger < 0 || s.thirst < 0 || s.rest < 0) return 'meters negative';
      A.roadEat(25);
      if (s.hunger < 25) return 'eat';
      A.roadDrink('test', 25);
      if (s.thirst < 25) return 'drink';
      A.roadRest(70);
      if (s.rest < 70) return 'rest';
      A.roadToggle(false);
      if (s.on) return 'still on';
      if (A.roadRegen() !== 1) return 'mul still slow after off';
      // Old-save default is covered by NORM (on: false, meters full).
    } finally {
      s.on = snap.on; s.hunger = snap.hunger; s.thirst = snap.thirst; s.rest = snap.rest; s.hideHud = snap.hideHud;
    }
    return true;
  };
}
