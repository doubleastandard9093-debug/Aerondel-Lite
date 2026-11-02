// Skill gates used by relic dungeons (and reused by Delving floors). One gate per skill; a run draws a handful,
// weighted toward skills you have not been tested on yet, so over several runs every skill gets its turn.
// kind 'fight' gates spawn a warden that must be beaten; 'hp' gates cost a little health; everything else is a level check.
export const GATES = {
  Attack:      { name: 'Warden Gate',        kind: 'fight', act: 'Challenge the warden', done: 'The warden falls and the gate grinds open.' },
  Strength:    { name: 'Fallen Pillar',      act: 'Heave the pillar aside', done: 'You heave the pillar out of the way.' },
  Defence:     { name: 'Spike Corridor',     act: 'Brace and push through', done: 'You weather the spikes and trip the release.' },
  Hitpoints:   { name: 'Blood Seal',         kind: 'hp', act: 'Feed the seal', done: 'The seal drinks and the way opens.' },
  Ranged:      { name: 'Distant Lever',      act: 'Shoot the lever', done: 'Your shot strikes the far lever. Clunk.' },
  Magic:       { name: 'Arcane Ward',        act: 'Unpick the ward', done: 'The ward unravels in a spray of sparks.' },
  Prayer:      { name: 'Desecrated Altar',   act: 'Reconsecrate the altar', done: 'Your prayer cleanses the altar.' },
  Agility:     { name: 'Crumbling Ledge',    act: 'Leap the ledge', done: 'You leap across and lower the bridge.' },
  Thieving:    { name: 'Trapped Lock',       act: 'Pick the lock', done: 'Click. The trap never fires.' },
  Mining:      { name: 'Rubble Fall',        act: 'Dig through the rubble', done: 'You clear a path through the rubble.' },
  Woodcutting: { name: 'Root Wall',          act: 'Hack through the roots', done: 'The roots part under your blade.' },
  Fishing:     { name: 'Flooded Channel',    act: 'Net the sluice key', done: 'You fish the sluice key out of the water and drain the channel.' },
  Smithing:    { name: 'Seized Portcullis',  act: 'Re-forge the hinges', done: 'You hammer the hinges free.' },
  Crafting:    { name: 'Mosaic Bridge',      act: 'Restore the mosaic', done: 'The mosaic is whole; the bridge rises.' },
  Cooking:     { name: 'Hungry Guardian',    act: 'Cook a treat for it', done: 'The guardian hound munches happily and lets you by.' },
  Fletching:   { name: 'Rope-Arrow Gap',     act: 'Fletch a rope arrow', done: 'You loose a rope arrow across the gap and climb over.' },
  Herbalism:   { name: 'Spore Cloud',        act: 'Mix an antidote', done: 'Your antidote holds the spores at bay.' },
  Glyphcraft:  { name: 'Rune Lock',          act: 'Trace the glyphs', done: 'The glyphs flare in sequence and the lock opens.' },
  Relicry:     { name: 'Sealed Reliquary',   act: 'Read the reliquary', done: 'You read the old seal and it yields.' },
  Delving:     { name: 'Shifting Maze',      act: 'Find the true path', done: 'You find the true path through the maze.' }
};

// Draw n distinct gate skills from those that exist, preferring ones seen least.
export function drawGates(skills, seen, n, rng = Math.random) {
  const pool = Object.keys(GATES).filter(s => skills[s]);
  const pick = [];
  while (pick.length < n && pick.length < pool.length) {
    const left = pool.filter(s => !pick.includes(s));
    const w = left.map(s => 1 / (1 + (seen[s] || 0)) ** 2), tot = w.reduce((a, b) => a + b, 0);
    let r = rng() * tot, i = 0; while (i < left.length - 1 && (r -= w[i]) > 0) i++;
    pick.push(left[i]);
  }
  return pick;
}
// Level needed: grows with the dungeon level and the gate's depth; gateEase perks shave levels off.
export const gateLevel = (dlvl, depth, ease = 0) => Math.max(1, Math.min(96, Math.round(dlvl * 0.75 + depth * 2 - ease * 20)));
