// Burst Tides (adapted from PSO2 emergency quests / Lost Ark field events): every 20–30 minutes one region surges for 10 minutes.
// Kills there respawn 3× faster and stack bonus XP; the tide ends with a capped boss wave.
import { REGION_DATA } from '../regiondata.js';
import { NORM, obj, num } from './state.js';
NORM.tides = v => { v = obj(v); return { seen: Math.floor(num(v.seen, 0, 0)), best: Math.floor(num(v.best, 0, 0)) }; };
const BOSSES = ['Cinder Warden', 'Thornback Prowler', 'Bramble Colossus', 'Hoarfrost Stalker', 'Glacier Behemoth', 'Storm Gryphon', 'Peak Warlord', 'Bog Revenant', 'Dune Tyrant'];
export default function tides(A) {
  const { ctx } = A, T = { region: null, until: 0, next: Date.now() + (20 + Math.random() * 10) * 60000, stacks: 0, wave: [] };
  A.tideState = T;
  const inTide = () => { if (!T.region) return false; const p = A.pos(); return Math.hypot(p.x - T.region.x, p.z - T.region.z) < T.region.r + 10; };
  A.tideStart = (reg) => { const R = reg || REGION_DATA[Math.floor(Math.random() * REGION_DATA.length)]; Object.assign(T, { region: R, until: Date.now() + 10 * 60000, stacks: 0, wave: [] }); A.S('tides').seen++;
    A.log(`🌊 Burst Tide! ${R.name} is surging for 10 minutes: foes return fast and every kill there stacks bonus XP.`, 'skill'); };
  const end = () => { if (!T.region) return; const R = T.region; T.region = null; T.next = Date.now() + (20 + Math.random() * 10) * 60000;
    if (A.tideState.stacks > A.S('tides').best) A.S('tides').best = A.tideState.stacks; A.log(`The tide over ${R.name} recedes.`, 'game'); };
  A.tideWave = () => { const R = T.region; if (!R) return; const lvl = Math.max(30, A.vLevel()), n = ctx.gfxQ() === 'low' ? 2 : 3, type = BOSSES[Math.min(BOSSES.length - 1, Math.floor(lvl / 110))];
    const c = R.camp ? { x: R.x + R.camp.dx + 14, z: R.z + R.camp.dz + 14 } : { x: R.x, z: R.z };
    for (let i = 0; i < n; i++) { const m = ctx.spawnMonster(type, c.x + i * 3, c.z, 4); Object.assign(m, { respawn: 1e12, tideBoss: true, level: Math.max(m.level, lvl) }); T.wave.push(m); }
    A.log(`The tide crests: a ${type} wave rises near ${R.camp ? R.camp.name : R.name}!`, 'combat'); };
  A.every(5, () => { const now = Date.now();
    if (!T.region && now > T.next) A.tideStart();
    if (T.region && !T.waved && now > T.until - 60000) { T.waved = true; A.tideWave(); }
    if (T.region && now > T.until) { T.waved = false; end(); }
    for (const m of T.wave) if (!T.region && m.alive && Math.random() < 0.3) { m.alive = false; m.state = 'dead'; m.respawnAt = 0; m.mesh.visible = false; }
    T.wave = T.wave.filter(m => m.alive || m.dying); });
  // Faster respawns inside the tide (normal world monsters only; the overall cap stays the same).
  ctx.EXT.extFrame.push(now => { if (!T.region) return; for (const m of ctx.monsters) if (m.state === 'dead' && m.respawnAt && m.respawnAt !== m._tideCut && (m.respawn || 0) < 1e9) {
    if (Math.hypot(m.spawnX - T.region.x, m.spawnZ - T.region.z) < T.region.r + 10) { m.respawnAt = now + (m.respawnAt - now) / 3; m._tideCut = m.respawnAt; } } });
  ctx.EXT.extKill.push(m => { if (inTide() && !m.venture) { T.stacks = Math.min(50, T.stacks + 1); if (m.tideBoss && A.bonusDrop) A.bonusDrop(m, 'the tide'); } });
  A.mods.xp.push(() => (inTide() ? T.stacks * 0.01 : 0));
  A.onQuick('tide', () => A.open('tides'));
  A.quick(() => (T.region ? [['tide', '🌊Tide', `Burst Tide: ${T.region.name}`]] : null));
  A.guide.push(['Burst Tides', 'Every 20–30 minutes of play a region surges for 10 minutes (a 🌊Tide button appears). Foes there come back 3× faster and each kill adds +1% combat XP (up to +50%). In the last minute a boss wave rises near the region camp.']);
  A.tab({ id: 'tides', icon: '🌊', name: 'Tides', render: () => T.region ? `<h4>🌊 ${T.region.name} is surging</h4><p>${Math.max(0, Math.ceil((T.until - Date.now()) / 60000))} min left · stacks ${T.stacks} (+${T.stacks}% XP while there)${inTide() ? '' : ' — <b>you are not in the region</b>'}</p><p><small>Boss wave in the last minute near ${T.region.camp ? T.region.camp.name : 'the region centre'}.</small></p>`
    : `<h4>No tide right now</h4><p>The next surge comes in about ${Math.max(1, Math.round((T.next - Date.now()) / 60000))} minutes of play.</p><p><small>Tides seen: ${A.S('tides').seen} · best stack: ${A.S('tides').best}</small></p>` });
  A.vtests = A.vtests || {};
  A.vtests.tides = async (g, A) => { A.tideStart(REGION_DATA[0]); const p = A.pos(), o = [p.x, p.z]; p.x = REGION_DATA[0].x; p.z = REGION_DATA[0].z; g.EXT.extKill.forEach(f => { try { f({ name: 'Wolf' }, 0); } catch (e) { /* other hooks */ } });
    const ok = A.tideState.stacks >= 1 && A.totals ? true : false; A.tideWave(); const w = A.tideState.wave.length; for (const m of A.tideState.wave) { m.alive = false; m.mesh.visible = false; } A.tideState.wave = []; A.tideState.until = 0; p.x = o[0]; p.z = o[1]; return ok && w >= 2 && w <= 3; };
}
