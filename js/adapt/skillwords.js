// Skillwords: dialogue lines gated by many skills (Smithing, Herbalism, Hunter, Construction, Farming, Agility).
// Silver Tongue stays the three social checks (Persuade, Lie, Intimidate). No dice. A miss is a short refusal and
// does not spend the hook or soft-lock a quest.
import { NORM, obj, arr } from './state.js';

export const SKILL_HOOKS = {
  hilda_pie: { skill: 'Farming', need: 15, giver: 'hilda', quest: 'hilda_pie', text: 'Offer a better berry bed for her garden', pass: 'Oh! That would keep the birds off. Take this for the advice.', fail: 'I know my own garden, dear. Come back when you have grown a few beds of your own.', gold: 40, xp: 80 },
  bram_brew: { skill: 'Herbalism', need: 20, giver: 'bram', quest: 'bram_brew', text: 'Name the bitter in last season\'s mash', pass: 'Nightshade? You have a good nose. Here is a little extra.', fail: 'I would rather not guess at bitters with a stranger.', gold: 50, xp: 80 },
  thurgo_steel: { skill: 'Smithing', need: 30, giver: 'thurgo', quest: 'thurgo_steel', text: 'Point out the hairline crack in the bloom', pass: 'So there is. I had missed it. Take a coin for the eye.', fail: 'The bloom is fine. Do not tell a smith his fire.', gold: 80, xp: 120 },
  tamsin_tower: { skill: 'Agility', need: 25, giver: 'tamsin', quest: 'tamsin_tower', text: 'Offer to take the high ledge instead of the stairs', pass: 'If you can make that jump, the errand is shorter. Take this.', fail: 'That ledge is not a shortcut if you cannot hold it.', gold: 60, xp: 100 },
  vannaka_slayer: { skill: 'Hunter', need: 30, giver: 'vannaka', quest: 'vannaka_slayer', text: 'Read the prints beside the last camp', pass: 'You read the trail correctly. That is worth a little purse.', fail: 'Those prints are not as simple as they look. Come back when you have tracked more than a rabbit.', gold: 80, xp: 120 },
  bob_tools: { skill: 'Construction', need: 15, giver: 'bob', quest: null, text: 'Offer to true the hafts on his rack', pass: 'A straight haft sells twice. Take a little for the work.', fail: 'Those hafts are already true enough, thank you.', gold: 40, xp: 80 }
};

NORM.checks = v => {
  v = obj(v);
  const used = arr(v.used).filter(x => typeof x === 'string' && SKILL_HOOKS[x]).slice(0, 32);
  return { used };
};

export function hookLabel(h, skills) {
  const lv = (skills && skills[h.skill] && skills[h.skill].level) || 1;
  return `${h.skill} ${lv}/${h.need}: ${h.text}`;
}
export function hookOpen(id, player, skills) {
  const h = SKILL_HOOKS[id]; if (!h) return null;
  const used = (player.adapt && player.adapt.checks && player.adapt.checks.used) || [];
  if (used.includes(id)) return null;
  if (h.quest && !(player.quests && player.quests[h.quest])) return null;
  return h;
}

export default function skillwords(A) {
  const { player, skills } = A;
  A.skillWrap = (ent, script) => {
    const npc = ent && ent.npc; if (!npc || !script) return script;
    const hits = Object.entries(SKILL_HOOKS).filter(([id]) => hookOpen(id, player, skills) && SKILL_HOOKS[id].giver === npc);
    if (!hits.length) return script;
    const choose = hits.map(([id, h]) => [hookLabel(h, skills), [{ run: () => A.skillTry(id) || [] }]]);
    choose.push(['Never mind.', []]);
    return [...script, { choose }];
  };
  A.skillTry = id => {
    const h = SKILL_HOOKS[id], S = A.S('checks');
    if (!h) return [['npc', 'I have nothing to add.']];
    if (S.used.includes(id)) return [['npc', 'We already spoke of that.']];
    const lv = A.lvl(h.skill);
    if (lv < h.need) {
      A.log(`${h.skill} is not high enough (${lv}/${h.need}).`, 'warn');
      return [['npc', h.fail]];
    }
    S.used.push(id);
    player.gold += h.gold;
    if (A.ctx.giveXP) A.ctx.giveXP(h.skill, h.xp);
    A.log(`${h.skill} advice landed. +${h.gold} coins.`, 'loot');
    A.dirty();
    return [['npc', `${h.pass} (${h.gold} coins).`]];
  };

  A.npc('skillwords', '✒️', 'Wordwise Tavian', 'People hear more than Persuade, a Lie or a hard word. A smith notices a crack. A herbalist names a bitter. If your skill is up to it, say so — if not, they will simply refuse, and you can try again later. Silver Tongue is unchanged.', 'checks');
  A.guide.push(['Skillwords', 'Ventures ✦ → Skillwords, or talk to Wordwise Tavian in Larkhaven. Some quest givers (and Tobin the tool seller) offer a line gated by Farming, Herbalism, Smithing, Agility, Hunter or Construction. Meet the level and the bonus is yours once. Miss, and they refuse — the hook stays open. Silver Tongue still handles Persuade, Lie and Intimidate.']);
  A.tab({ id: 'checks', icon: '✒️', name: 'Skillwords', render: () => {
    const S = A.S('checks');
    const rows = Object.entries(SKILL_HOOKS).map(([id, h]) => {
      const used = S.used.includes(id);
      const lv = A.lvl(h.skill);
      return `<div class="row"><div><b>${A.esc(h.skill)} ${h.need}</b> — ${A.esc(h.text)}<br><small>${used ? 'Already used.' : `Your ${h.skill}: ${lv}. ${h.quest ? 'Open or finish the related quest first.' : 'Talk to Tobin (tools) in Larkhaven.'}`}</small></div></div>`;
    }).join('');
    return `<h4>Skillwords</h4><p>Dialogue lines gated by skills you already have. Silver Tongue stays the three social checks. A miss is a short refusal and does not spend the hook or lock a quest.</p>${rows}`;
  } });

  A.vtests = A.vtests || {};
  A.vtests.skillwords = async (g, A) => {
    const P = g.player, sk = g.skills;
    P.quests = P.quests || {};
    P.quests.hilda_pie = P.quests.hilda_pie || { stage: 'in' };
    const farm0 = sk.Farming.level;
    sk.Farming.level = 1;
    const S = A.S('checks');
    S.used = S.used.filter(x => x !== 'hilda_pie');
    if (!hookOpen('hilda_pie', P, sk)) { sk.Farming.level = farm0; return 'hook closed at low skill (should still be open)'; }
    const gold0 = P.gold;
    const fail = A.skillTry('hilda_pie');
    if (S.used.includes('hilda_pie')) { sk.Farming.level = farm0; return 'fail spent the hook'; }
    if (P.gold !== gold0) { sk.Farming.level = farm0; return 'fail paid gold'; }
    if (!fail || !fail[0] || !/garden|beds/i.test(fail[0][1] || '')) { sk.Farming.level = farm0; return 'fail line'; }
    sk.Farming.level = 20;
    const pass = A.skillTry('hilda_pie');
    const ok = S.used.includes('hilda_pie') && P.gold === gold0 + 40 && pass && /advice|birds/i.test(pass[0][1] || '');
    const again = A.skillTry('hilda_pie');
    const once = /already/i.test((again && again[0] && again[0][1]) || '');
    // Silver Tongue table is untouched.
    const tongue = await import('/js/tongue.js');
    const st = !!(tongue.QUEST_CHECKS && tongue.QUEST_CHECKS.hilda_pie && tongue.CHECKS.persuade);
    // Wrap adds a choose line for Hilda when the hook is still open (use bob, which has no quest gate, after clearing used).
    S.used = S.used.filter(x => x !== 'bob_tools');
    sk.Construction.level = Math.max(sk.Construction.level, 15);
    const wrapped = A.skillWrap({ npc: 'bob' }, [['npc', 'Welcome.']]);
    const hasLine = JSON.stringify(wrapped).includes('true the hafts');
    sk.Farming.level = farm0;
    return !!(ok && once && st && hasLine);
  };
}
