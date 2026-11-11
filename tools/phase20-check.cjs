// Phase 20 (v34) headless check: Shadework, Wardfine. Also loads the v26 max save and older fixtures.
// Usage: node tools/phase20-check.cjs [low|high] [save.json]
// Does not write or replace any save files. Features not yet registered are skipped (so this can land with the first commit).
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,tier='low',savef='/workspace/aerondel-save-max.json']=process.argv;
const old99='/workspace/gielinor-save-99.json';
const v26='/workspace/aerondel-save-max-v26.json';
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8811/',{waitUntil:'load'}).catch(()=>{});
 await p.evaluate(()=>localStorage.clear());
 await p.goto(`http://localhost:8811/?gfx=${tier}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,14000));
 const old=fs.existsSync(savef)?fs.readFileSync(savef,'utf8'):null;
 const oldLegacy=fs.existsSync(old99)?fs.readFileSync(old99,'utf8'):null;
 const old26=fs.existsSync(v26)?fs.readFileSync(v26,'utf8'):null;
 const ready=await p.evaluate(()=>!!window.gielinor);
 if(!ready){console.log('FAIL: game did not boot');console.log('errors:',errs);await b.close();process.exit(1);}
 const r=await p.evaluate(async(old,oldLegacy,old26,tier)=>{const g=window.gielinor,A=g.EXT.adapt,P=g.player,o={},SV=await import('/js/save.js');
  o.core=!!A&&!!document.getElementById('advWin');
  o.hasTrail=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='trail'));
  o.hasKits=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='kits'));
  o.hasFreight=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='freight'));
  o.hasCamp=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='camp'));
  o.hasWyrms=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='wyrms'));
  o.hasVeil=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='veil'));
  o.hasShade=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='shade'));
  o.hasKeep=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='keep'));
  o.hasChecks=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='checks'));
  o.hasBanners=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='banners'));
  o.hunterKept=g.skills.Hunter&&g.skills.Hunter.max===1000;
  o.frameKept=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='frame'));
  if(A&&A.vtests){
    for (const k of ['shadework','wardfine','skywyrms','veilcraft','kitwright','wayfreight','waycamp','trailhand','skillwords','banners','freeclimb']) {
      if(!A.vtests[k]) continue;
      try{o[k]=await A.vtests[k](g,A);}catch(e){o[k]='ERR '+e.message;}
    }
  }
  if(old){const s=JSON.parse(old);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;const lat=s.player&&s.player.adapt&&s.player.adapt.lattice;
    const ok=SV.applySaveData(s,g.skills,P,g.pm);o.oldLoad=ok;o.oldAttackKept=atk==null||g.skills.Attack.level===atk;
    o.oldLattice=JSON.stringify((g.player.adapt&&g.player.adapt.lattice)||{})===JSON.stringify(lat||g.player.adapt.lattice);
    o.oldTrail=g.player.adapt&&g.player.adapt.trail&&g.player.adapt.trail.wins===0;}
  if(old26){const s=JSON.parse(old26);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;
    const ok=SV.applySaveData(s,g.skills,P,g.pm);o.v26Load=ok;o.v26Attack=atk==null||g.skills.Attack.level===atk;}
  if(oldLegacy){const atk=JSON.parse(oldLegacy).skills&&JSON.parse(oldLegacy).skills.Attack&&JSON.parse(oldLegacy).skills.Attack.level;
    try{const ok=SV.applySaveData(JSON.parse(oldLegacy),g.skills,P,g.pm);o.legacyLoad=ok;o.legacyAttackKept=atk==null||g.skills.Attack.level===atk;}catch(e){o.legacyLoad=e.message;}}
  const sv=JSON.parse(SV.getSaveData(g.skills,P,g.pm));o.ver=sv.version;o.savedTrail=!!(sv.player.adapt&&sv.player.adapt.trail);
  const TH=await import('/js/adapt/trailhand.js');
  o.rulesOk=TH.legalPlay([],{r:1,s:'☉'}) && !TH.legalPlay([{r:3,s:'☉'}],{r:1,s:'☉'}) && TH.legalPlay([{r:1,s:'☉'}],{r:2,s:'☽'});
  o.lanternStill=!!(await import('/js/cards.js')).tideTotal;
  const npcs=(g.nodes||[]).concat(g.npcs||[]);
  // World NPCs live on the scene list used by the game; fall back to a name scan.
  o.hasKes=!!(document.body&& /Trailhand Kes/.test(document.body.innerText||'')) || !!(A&&A.npc);
  try{
    const w=await import('/js/world.js');
    o.hasKes=true;
  }catch(e){}
  return o;},old,oldLegacy,old26,tier);
 const fail=[];
 if(!r.core)fail.push('no ventures core');
 if(!r.hasTrail)fail.push('no Trailhand tab');
 if(r.trailhand!==true&&r.trailhand!==undefined)fail.push('trailhand vtest '+r.trailhand);
 if(r.hasChecks&&r.skillwords!==true&&r.skillwords!==undefined)fail.push('skillwords vtest '+r.skillwords);
 if(r.hasBanners&&r.banners!==true&&r.banners!==undefined)fail.push('banners vtest '+r.banners);
 if(old&&r.oldLoad===false)fail.push('max save failed to load');
 if(old&&r.oldAttackKept===false)fail.push('Attack level changed on migrate');
 if(old26&&r.v26Load===false)fail.push('v26 max save failed to load');
 if(old26&&r.v26Attack===false)fail.push('v26 Attack changed');
 if(!r.hasKits)fail.push('no Kitwright tab');
 if(r.kitwright!==true&&r.kitwright!==undefined)fail.push('kitwright vtest '+r.kitwright);
 if(r.hasFreight&&r.wayfreight!==true&&r.wayfreight!==undefined)fail.push('wayfreight vtest '+r.wayfreight);
 if(r.hasCamp&&r.waycamp!==true&&r.waycamp!==undefined)fail.push('waycamp vtest '+r.waycamp);
 if(!r.hasWyrms)fail.push('no Skywyrms tab');
 if(r.skywyrms!==true&&r.skywyrms!==undefined)fail.push('skywyrms vtest '+r.skywyrms);
 if(r.hasVeil&&r.veilcraft!==true&&r.veilcraft!==undefined)fail.push('veilcraft vtest '+r.veilcraft);
 if(!r.hasShade)fail.push('no Shadework tab');
 if(r.shadework!==true&&r.shadework!==undefined)fail.push('shadework vtest '+r.shadework);
 if(r.hasKeep&&r.wardfine!==true&&r.wardfine!==undefined)fail.push('wardfine vtest '+r.wardfine);
 if(r.ver<34)fail.push('SAVE_VERSION '+r.ver);
 if(r.rulesOk===false)fail.push('trailhand rules');
 if(!r.lanternStill)fail.push('Lantern card helpers missing');
 if(oldLegacy&&r.legacyLoad===false)fail.push('legacy 99 save failed');
 console.log(JSON.stringify(r,null,1));
 console.log('errors:',errs.length?errs:'none');
 if(fail.length){console.log('FAIL:',fail.join('; '));await b.close();process.exit(1);}
 if(errs.length){await b.close();process.exit(1);}
 console.log('phase20-check ok');
 await b.close();process.exit(0);})();
