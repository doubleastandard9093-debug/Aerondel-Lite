// Phase 10 (v24) headless check: Hunter skill, Huntwright, save migration.
// Usage: node tools/phase10-check.cjs [low|high] [save.json]
// Does not write or replace any save files.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,tier='low',savef='/workspace/aerondel-save-max.json']=process.argv;
const old99='/workspace/gielinor-save-99.json';
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8811/',{waitUntil:'load'}).catch(()=>{});
 await p.evaluate(()=>localStorage.clear());
 await p.goto(`http://localhost:8811/?gfx=${tier}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,14000));
 const old=fs.existsSync(savef)?fs.readFileSync(savef,'utf8'):null;
 const oldLegacy=fs.existsSync(old99)?fs.readFileSync(old99,'utf8'):null;
 const ready=await p.evaluate(()=>!!window.gielinor);
 if(!ready){console.log('FAIL: game did not boot');console.log('errors:',errs);await b.close();process.exit(1);}
 const r=await p.evaluate(async(old,oldLegacy,tier)=>{const g=window.gielinor,A=g.EXT.adapt,P=g.player,o={},SV=await import('/js/save.js'),SK=await import('/js/skills.js'),I=await import('/js/items.js');
  const T=ms=>new Promise(r=>setTimeout(r,ms));
  o.core=!!A&&!!document.getElementById('advWin');
  o.hasTab=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='hunt'));o.hasAsh=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='ashkin'));o.hasGuard=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='guard'));
  o.hunterNew={level:g.skills.Hunter&&g.skills.Hunter.level,max:g.skills.Hunter&&g.skills.Hunter.max};
  o.combatSkill=!(SK.COMBAT_SKILLS||[]).includes('Hunter');
  o.cape=!!I.ITEMS['Hunter cape'];
  o.brand=!!I.ITEMS['Brandhide helm']&&!!I.ITEMS['Cinder horn']&&!!I.ITEMS['Eclipshide edge'];
  o.vexmarUnique=!!I.ITEMS['Vexmar, the Last Eclipse']; // frontier unique still exists
  if(A&&A.vtests&&A.vtests.huntwright){try{o.huntwright=await A.vtests.huntwright(g,A);}catch(e){o.huntwright='ERR '+e.message;}}
  if(A&&A.vtests&&A.vtests.guardbreak){try{o.guardbreak=await A.vtests.guardbreak(g,A);}catch(e){o.guardbreak='ERR '+e.message;}}
  if(A&&A.vtests&&A.vtests.ashkin){try{o.ashkin=await A.vtests.ashkin(g,A);}catch(e){o.ashkin='ERR '+e.message;}}
  // snapshot combat level on a fresh game, then migrate the max save
  const cl0=SK.combatLevel(g.skills);
  if(old){const s=JSON.parse(old);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;const hadHunter=!!(s.skills&&s.skills.Hunter);
    const ok=SV.applySaveData(s,g.skills,P,g.pm);o.oldLoad=ok;o.oldVer=s.version;o.oldHunter={level:g.skills.Hunter&&g.skills.Hunter.level,max:g.skills.Hunter&&g.skills.Hunter.max,had:hadHunter};
    o.oldAttackKept=atk==null||g.skills.Attack.level===atk;o.oldCL=SK.combatLevel(g.skills);}
  if(oldLegacy){const s=JSON.parse(oldLegacy);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;
    // apply onto a throwaway copy of current skills by re-reading through migrate only
    const notes=[]; try{const ok=SV.applySaveData(JSON.parse(oldLegacy),g.skills,P,g.pm);o.legacyLoad=ok;o.legacyHunter=g.skills.Hunter&&g.skills.Hunter.level;o.legacyAttackKept=atk==null||g.skills.Attack.level===atk;}catch(e){o.legacyLoad=e.message;}}
  const sv=JSON.parse(SV.getSaveData(g.skills,P,g.pm));o.ver=sv.version;o.savedHunter=sv.skills.Hunter&&sv.skills.Hunter.level;
  o.freshCL=cl0;
  return o;},old,oldLegacy,tier);
 const fail=[];
 if(!r.core)fail.push('no ventures core');
 if(!r.hasTab)fail.push('no Huntwright tab');
 if(!r.hasAsh)fail.push('no Ashkin tab');
 if(!r.hasGuard)fail.push('no Guardbreak tab');
 if(!(r.hunterNew&&r.hunterNew.level===1&&r.hunterNew.max===1000))fail.push('fresh Hunter not 1/1000 '+JSON.stringify(r.hunterNew));
 if(!r.combatSkill)fail.push('Hunter was added to COMBAT_SKILLS');
 if(!r.cape||!r.brand||!r.vexmarUnique)fail.push('items missing');
 if(r.huntwright!==true&&r.huntwright!==undefined)fail.push('huntwright vtest '+r.huntwright);
 if(r.guardbreak!==true&&r.guardbreak!==undefined)fail.push('guardbreak vtest '+r.guardbreak);
 if(r.ashkin!==true&&r.ashkin!==undefined)fail.push('ashkin vtest '+r.ashkin);
 if(old&&r.oldLoad===false)fail.push('max save failed to load');
 if(old&&!(r.oldHunter&&r.oldHunter.level===1&&r.oldHunter.max===1000&&r.oldHunter.had===false))fail.push('max-save Hunter migration '+JSON.stringify(r.oldHunter));
 if(old&&r.oldAttackKept===false)fail.push('Attack level changed on migrate');
 if(r.ver<24)fail.push('SAVE_VERSION '+r.ver);
 if(oldLegacy&&r.legacyLoad===false)fail.push('legacy 99 save failed');
 if(oldLegacy&&r.legacyHunter!==1)fail.push('legacy Hunter '+r.legacyHunter);
 console.log(JSON.stringify(r,null,1));
 console.log('errors:',errs.length?errs:'none');
 if(fail.length){console.log('FAIL:',fail.join('; '));await b.close();process.exit(1);}
 if(errs.length){await b.close();process.exit(1);}
 console.log('phase10-check ok');
 await b.close();process.exit(0);})();
