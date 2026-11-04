// Instanced spaces (Hearth & Arena): small flat zones far west of the map (x < -700).
// Out there the overworld chunks are beyond load range, so the world is effectively unloaded while you're inside.
export const INSTANCE_X = -700;
export const HEARTH = { x: -1000, z: 0, hw: 12, hd: 9, door: { x: -1000, z: 8 }, stone: { x: -1000, z: 0 } };
export const ARENA = { x: -1000, z: -200, r: 13, gate: { x: -1000, z: -188 } };
export function inInstance(x) { return x < INSTANCE_X; }
export function instanceAt(x, z) {
  if (!inInstance(x)) return null;
  if (z > 300) return 'dungeon';   // relic dungeons and Delving floors (dungeon.js)
  if (z < -560) return 'siege';
  if (z < -340) return 'delve';
  if (z > 100) return 'venture';   // Ventures zones (js/adapt/zone.js): Vigil z 135, Breach z 205, Hold z 270
  return Math.abs(z - HEARTH.z) < 60 ? 'hearth' : 'arena';
}
// Keep a walker inside the instance it's in.
// dungeon.js sets the active dungeon's outer box here (walls are colliders).
export const DUNGEON_BOX = { box: null };
export const VENTURE_ZONES = [{ id: 'vigil', z: 135 }, { id: 'breach', z: 205 }, { id: 'hold', z: 270 }];
export const VENTURE_HALF = 14;
export const ventureZone = z => VENTURE_ZONES.reduce((b, v) => (Math.abs(v.z - z) < Math.abs(b.z - z) ? v : b));
export function clampInstance(pos) {
  if (instanceAt(pos.x, pos.z) === 'dungeon') {
    const b = DUNGEON_BOX.box; if (!b) return;
    pos.x = Math.max(b.minX, Math.min(b.maxX, pos.x)); pos.z = Math.max(b.minZ, Math.min(b.maxZ, pos.z));
    return;
  }
  if (instanceAt(pos.x, pos.z) === 'hearth') {
    pos.x = Math.max(HEARTH.x - HEARTH.hw + 0.6, Math.min(HEARTH.x + HEARTH.hw - 0.6, pos.x));
    pos.z = Math.max(HEARTH.z - HEARTH.hd + 0.6, Math.min(HEARTH.z + HEARTH.hd - 0.6, pos.z));
  } else if (instanceAt(pos.x, pos.z) === 'siege') {
    const dx = pos.x + 1000, dz = pos.z + 640, d = Math.hypot(dx, dz), R = 15.4;
    if (d > R) { pos.x = -1000 + dx / d * R; pos.z = -640 + dz / d * R; }
  } else if (instanceAt(pos.x, pos.z) === 'venture') {
    const c = ventureZone(pos.z).z, h = VENTURE_HALF - 0.6;
    pos.x = Math.max(-1000 - h, Math.min(-1000 + h, pos.x)); pos.z = Math.max(c - h, Math.min(c + h, pos.z));
  } else if (instanceAt(pos.x, pos.z) === 'delve') {
    const cz = pos.z > -440 ? -400 : -480;
    pos.x = Math.max(-1000 - 10.4, Math.min(-1000 + 10.4, pos.x));
    pos.z = Math.max(cz - 10.4, Math.min(cz + 10.4, pos.z));
  } else {
    const dx = pos.x - ARENA.x, dz = pos.z - ARENA.z, d = Math.hypot(dx, dz), R = ARENA.r - 0.6;
    if (d > R) { pos.x = ARENA.x + dx / d * R; pos.z = ARENA.z + dz / d * R; }
  }
}
