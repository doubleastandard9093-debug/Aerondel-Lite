// Glidewalk: a dash on a cooldown (C or 💨 button), a sprint that burns run energy faster (hold run on and tap Sprint),
// and a glide: dashing off high ground (a drop ahead) carries you much further. Agility shortens the cooldown and boosts both.
import { terrainHeight } from '../world.js';
export default function glidewalk(A) {
  const { ctx } = A; const pm = ctx.pm; let ready = 0, sprint = false;
  const ag = () => A.lvl('Agility');
  const cd = () => Math.max(1500, 5000 - ag() * 30);
  const fwd = () => { const f = pm.facing || 0; return [Math.sin(f), Math.cos(f)]; };
  A.glideDrop = () => { const p = A.pos(), [fx, fz] = fwd(), h = terrainHeight(p.x, p.z); return h - terrainHeight(p.x + fx * 8, p.z + fz * 8); };
  A.dash = () => { if (pm.dodge) return false; if (Date.now() < ready) return A.log(`Dash recharging (${Math.ceil((ready - Date.now()) / 1000)}s).`, 'game'), false;
    if (A.player.runEnergy < 8) return A.log('Too tired to dash.', 'warn'), false;
    const [fx, fz] = fwd(), glide = A.glideDrop() > 3, dist = (glide ? 14 : 6) * (1 + ag() / 400), ms = glide ? 900 : 220;
    pm.dodge = { x: fx, z: fz, left: ms, speed: dist / (ms / 1000) }; A.player.runEnergy -= glide ? 4 : 8; ready = Date.now() + cd();
    if (glide) A.log('You glide off the high ground.', 'game');
    if (ctx.gfxQ() !== 'low') { const p = A.pos(); ctx.burst('dust', p.x, p.y, p.z, glide ? 10 : 5); } return glide ? 'glide' : 'dash'; };
  A.sprint = on => { sprint = on ?? !sprint; if (sprint) { if (A.player.runEnergy < 10) { sprint = false; return A.log('Too tired to sprint.', 'warn'); } A.player.settings.run = true; } A.log(sprint ? 'Sprinting.' : 'Sprint off.', 'game'); };
  ctx.EXT.extFrame.push(dt => { const want = sprint && A.player.settings.run && A.player.runEnergy > 0 ? 1.3 + ag() / 1000 : 1;
    if (want > 1) { pm.speedMul = want; if (pm.moving) A.player.runEnergy = Math.max(0, A.player.runEnergy - dt * 6); if (A.player.runEnergy <= 0) { sprint = false; A.log('Too tired to keep sprinting.', 'warn'); } }
    else if (pm.speedMul === pm._gwMul) pm.speedMul = 1; pm._gwMul = pm.speedMul; });
  A.key('dash', A.dash); A.onQuick('dash', A.dash); A.onQuick('sprint', () => A.sprint());
  A.quick(() => [['dash', A.glideDrop() > 3 ? '🪶Glide' : '💨Dash', 'Dash forward (C); off high ground it becomes a glide'], ['sprint', sprint ? '🏃Stop' : '🏃Sprint', 'Sprint: faster running that burns energy']]);
  A.guide.push(['Glidewalk', 'Press C or tap 💨Dash for a quick dash (5 s cooldown, down to 1.5 s with Agility). Facing a drop of 3 m or more, it becomes a long 🪶 Glide. 🏃Sprint makes running about 30% faster but drains run energy.']);
  A.vtests = A.vtests || {};
  A.vtests.glide = async (g, A) => { const p = A.pos(), x0 = p.x, z0 = p.z; ready = 0; A.player.runEnergy = 100; const ok = A.dash(); await new Promise(r => setTimeout(r, 600));
    const moved = Math.hypot(p.x - x0, p.z - z0); A.sprint(true); for (const f of ctx.EXT.extFrame) { try { f(0.016, performance.now()); } catch (e) {} } const sm = pm.speedMul; A.sprint(false); for (const f of ctx.EXT.extFrame) { try { f(0.016, performance.now()); } catch (e) {} }
    return !!ok && moved > 1 && sm > 1.2 && pm.speedMul === 1 || `ok${ok} m${moved.toFixed(1)} s${sm}/${pm.speedMul}`; };
}
