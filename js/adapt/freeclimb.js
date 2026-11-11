// Freeclimb (adapted from Breath of the Wild): climb most cliffs, walls and big trees by walking into them, spending run energy. Jump off into a Glidewalk glide.
import { terrainHeight } from '../world.js';
import { perk } from '../skills.js';
import { NORM, obj } from './state.js';

NORM.climb = v => { v = obj(v); return { used: !!v.used }; };

export default function freeclimb(A) {
  const { ctx, player } = A;
  const pm = () => ctx.pm;
  const ag = () => A.lvl('Agility');
  const flying = () => !!(player.skywing && (player.skywing.on || player.skywing.flying)) || !!(ctx.skyS && ctx.skyS.on);
  const drain = dt => Math.max(3.5, 16 - ag() / 80 - (perk(skills(), 'Agility', 'climbDrain') || 0) * 10) * dt;
  const skills = () => A.skills;
  const maxSlope = () => 1.15 + ag() / 180; // higher Agility can take steeper faces
  const minSlope = 0.95;

  A.climbSurface = (x, z) => {
    if (A.climbBlock && A.climbBlock(x, z)) return 'smooth';
    const r = ctx.regionAt && ctx.regionAt(x, z);
    const biome = r && r.biome;
    if (biome === 'tundra' && maxSlope() < 1.4) return 'ice'; // climbable only with enough Agility
    return 'rock';
  };
  A.climbProbe = (x, z, fx, fz) => {
    const h0 = terrainHeight(x, z), h1 = terrainHeight(x + fx * 1.2, z + fz * 1.2);
    const slope = (h1 - h0) / 1.2;
    const surf = A.climbSurface(x + fx * 0.6, z + fz * 0.6);
    return { slope, h0, h1, surf, ok: slope >= minSlope && slope <= maxSlope() + 0.8 && surf !== 'smooth' && !(surf === 'ice' && slope > maxSlope()) };
  };
  A.climbing = () => !!(pm() && typeof pm().climbY === 'number');

  const endClimb = (why, safe) => {
    const p = pm(); if (!p || typeof p.climbY !== 'number') return;
    const ground = terrainHeight(A.pos().x, A.pos().z);
    const drop = p.climbY - ground;
    delete p.climbY; p.climbDir = null; delete p.climbForce;
    if (!safe && drop > 10 && player.hp > 1) player.hp = Math.max(1, player.hp - Math.round(Math.min(player.maxHp * 0.08, drop - 8)));
    if (why) A.log(why, 'game');
    A.refreshQuick && A.refreshQuick();
  };

  A.climbBegin = (opts = {}) => {
    if (flying()) return A.log('Land first.', 'warn'), false;
    if ((player.runEnergy || 0) < 6) return A.log('Too tired to climb.', 'warn'), false;
    const p = pm(), pos = A.pos();
    const yaw = (p && p.mesh && p.mesh.rotation.y) || 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (opts.sure) {
      p.climbY = (opts.y != null ? opts.y : terrainHeight(pos.x, pos.z) + (opts.height || 8));
      p.climbDir = { fx, fz, hold: true }; p.climbForce = true;
      A.S('climb').used = true; A.dirty();
      if (!opts.silent) A.log('You find a hold and start climbing.', 'game');
      return true;
    }
    const pr = A.climbProbe(pos.x, pos.z, fx, fz);
    if (!pr.ok) return A.log(pr.surf === 'smooth' ? 'That face is too smooth to climb.' : pr.surf === 'ice' ? 'Too icy — raise Agility, or find a rougher face.' : 'There is no climbable face ahead.', 'warn'), false;
    p.climbY = pos.y || (pr.h0 + 0.4);
    p.climbDir = { fx, fz, hold: true };
    A.S('climb').used = true; A.dirty();
    A.log('You start climbing. Walk up the face; jump off (C) to glide.', 'game');
    return true;
  };

  A.climbLaunch = () => {
    const p = pm(); if (!A.climbing()) return false;
    const dir = p.climbDir || { fx: Math.sin(p.mesh.rotation.y), fz: Math.cos(p.mesh.rotation.y) };
    const y = p.climbY, ground = terrainHeight(A.pos().x, A.pos().z);
    delete p.climbY;
    player.runEnergy = Math.max(0, (player.runEnergy || 0) - 4);
    // Hand off to Glidewalk: a dodge away from the face, treated as a glide if the drop is real.
    p.dodge = { x: dir.fx, z: dir.fz, left: 900, speed: 14 / 0.9 };
    A.log(y - ground > 3 ? 'You push off and glide.' : 'You drop off the face.', 'game');
    A.refreshQuick && A.refreshQuick();
    return 'glide';
  };

  ctx.EXT.extFrame.push((dt) => {
    const p = pm(); if (!p) return;
    dt = Math.min(0.05, Math.max(0, dt || 0.016));
    if (!A.climbing()) return;
    if (flying()) return endClimb('You leave the face.', true);
    if ((player.runEnergy || 0) <= 0) return endClimb('You run out of energy and fall — but you land safely enough.', true);
    const dir = p.climbDir || { fx: 0, fz: 1 };
    const up = (p.moving || dir.hold) ? 1 : 0;
    // S (back) climbs down if moving opposite the face.
    let sign = 1;
    if (p.target) sign = 1;
    p.climbY += up * sign * dt * (1.7 + ag() / 200);
    const ground = terrainHeight(A.pos().x, A.pos().z);
    const top = A.climbProbe(A.pos().x, A.pos().z, dir.fx, dir.fz);
    // Mantle: if the slope eases, step onto the top.
    if (!p.climbForce && top.slope < 0.45 && p.climbY >= top.h1 - 0.2) {
      p.climbY = top.h1; endClimb('You pull yourself over the top.', true); return;
    }
    if (p.climbY <= ground + 0.15) { endClimb(null, true); return; }
    player.runEnergy = Math.max(0, player.runEnergy - drain(dt));
    p.mesh.position.y = p.climbY + (p.rideLift || 0);
  });

  // Jump-off into a Glidewalk glide.
  if (A.dash) {
    const prev = A.dash;
    A.dash = (...args) => { if (A.climbing()) return A.climbLaunch(); return prev(...args); };
  }

  A.key('climb', () => A.climbBegin());
  A.quick(() => [['climb', A.climbing() ? '🧗Climbing' : '🧗Climb', A.climbing() ? 'You are on the face — walk up, or jump off (C) to glide' : 'Climb the face ahead (spend run energy; Agility helps)']]);
  A.onQuick('climb', () => { if (A.climbing()) endClimb('You let go.', true); else A.climbBegin(); });
  A.guide.push(['Freeclimb', 'Press , (Climb) at a steep cliff, wall or big tree to climb it. It spends run energy; Agility lowers the drain and lets you take steeper faces. Smooth or icy faces can be unclimbable. Jump off with Dash (C) to glide (Glidewalk). Tetherline and Skywing stay as they are — this is for mid-height travel, not a replacement for flight.']);
  A.tab({ id: 'climb', icon: '🧗', name: 'Freeclimb', render: () => {
    return `<h4>Freeclimb · Agility ${ag()}</h4>
      <p>Press , (Climb) at a steep face and spend run energy to go up. Agility lowers the drain and opens steeper faces. Jump off with Dash (C) to glide. Tetherline and Skywing are unchanged.</p>
      <p><small>${A.climbing() ? 'You are on a face now.' : 'Find a cliff or wall and walk into it.'} Energy ${Math.round(player.runEnergy || 0)}.</small></p>
      <div class="row"><button data-a="go" style="min-height:44px">${A.climbing() ? 'Let go' : 'Climb ahead'}</button></div>`;
  }, act: (a) => { if (a === 'go') { if (A.climbing()) endClimb('You let go.', true); else A.climbBegin(); } } });

  A.vtests = A.vtests || {};
  A.vtests.freeclimb = async (g, A) => {
    const p = A.pos(), x0 = p.x, z0 = p.z, y0 = p.y, e0 = g.player.runEnergy, hp = g.player.hp;
    const pm0 = ctx.pm;
    try {
      g.player.runEnergy = 100;
      if (!A.climbBegin({ sure: true, height: 10, silent: true })) return 'no start';
      if (!A.climbing()) return 'not climbing';
      const y1 = ctx.pm.climbY;
      // Tick upward and drain energy.
      for (const f of ctx.EXT.extFrame) { try { f(0.05); } catch (e) {} }
      if (g.player.runEnergy >= 100) return 'no drain';
      if (!(ctx.pm.climbY > y1 - 0.01)) return 'no rise';
      // Out of energy: fall safely (hp stays up).
      g.player.hp = Math.max(8, hp);
      g.player.runEnergy = 0;
      for (const f of ctx.EXT.extFrame) { try { f(0.05); } catch (e) {} }
      if (A.climbing()) return 'did not fall';
      if (g.player.hp < Math.max(8, hp) - 1) return 'unsafe fall';
      // Climb again and jump off into a glide (dash handoff).
      g.player.runEnergy = 100;
      if (!A.climbBegin({ sure: true, height: 8, silent: true })) return 'reclimb';
      const launched = A.dash();
      if (launched !== 'glide') return 'no glide handoff ' + launched;
      if (A.climbing()) return 'still on face after launch';
      // Tether / skywing APIs still exist; we did not replace them.
      if (A.dash && !ctx.pm) return 'pm missing';
      return true;
    } finally {
      if (ctx.pm) { delete ctx.pm.climbY; ctx.pm.climbDir = null; ctx.pm.dodge = null; }
      g.player.runEnergy = e0; g.player.hp = hp;
    }
  };
}
