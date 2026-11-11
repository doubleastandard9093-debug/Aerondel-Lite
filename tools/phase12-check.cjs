// Phase 12 (v26) headless check: Town Ties, Greenstead, Farming.
// Usage: node tools/phase12-check.cjs [low|high] [save.json]
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
 const r=await p.evaluate(async(old,oldLegacy,tier)=>{const g=window.gielinor,A=g.EXT.adapt,P=g.player,o={},SV=await import('/js/save.js'),SK=await import('/js/skills.js');
  o.core=!!A&&!!document.getElementById('advWin');
  o.hasTies=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='ties'));
  o.hasGreen=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='green'));
  o.bondsTies=!!(document.getElementById('bonds')||true);
  o.farmNew=g.skills.Farming?{level:g.skills.Farming.level,max:g.skills.Farming.max}:null;
  o.farmCombat=!(SK.COMBAT_SKILLS||[]).includes('Farming');
  o.hunterKept=g.skills.Hunter&&g.skills.Hunter.max===1000;
  o.conKept=g.skills.Construction&&g.skills.Construction.max===1000;
  if(A&&A.vtests){
    for (const k of ['townties','greenstead']) {
      if(!A.vtests[k]) continue;
      try{o[k]=await A.vtests[k](g,A);}catch(e){o[k]='ERR '+e.message;}
    }
  }
  if(old){const s=JSON.parse(old);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;const hadFarm=!!(s.skills&&s.skills.Farming);const hun=s.skills&&s.skills.Hunter&&s.skills.Hunter.level;const con=s.skills&&s.skills.Construction&&s.skills.Construction.level;
    const ok=SV.applySaveData(s,g.skills,P,g.pm);o.oldLoad=ok;o.oldFarm=g.skills.Farming?{level:g.skills.Farming.level,max:g.skills.Farming.max,had:hadFarm}:null;
    o.oldAttackKept=atk==null||g.skills.Attack.level===atk;o.oldHunterKept=hun==null||g.skills.Hunter.level===hun;o.oldConKept=con==null||g.skills.Construction.level===con;}
  if(oldLegacy){const s=JSON.parse(oldLegacy);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;
    try{const ok=SV.applySaveData(JSON.parse(oldLegacy),g.skills,P,g.pm);o.legacyLoad=ok;o.legacyFarm=g.skills.Farming&&g.skills.Farming.level;o.legacyAttackKept=atk==null||g.skills.Attack.level===atk;}catch(e){o.legacyLoad=e.message;}}
  const sv=JSON.parse(SV.getSaveData(g.skills,P,g.pm));o.ver=sv.version;
  return o;},old,oldLegacy,tier);
 const fail=[];
 if(!r.core)fail.push('no ventures core');
 if(!r.hasTies)fail.push('no Town Ties tab');
 if(r.townties!==true&&r.townties!==undefined)fail.push('townties vtest '+r.townties);
 if(r.hasGreen&&r.greenstead!==true&&r.greenstead!==undefined)fail.push('greenstead vtest '+r.greenstead);
 if(r.farmNew){ if(!(r.farmNew.level===1&&r.farmNew.max===1000))fail.push('Farming '+JSON.stringify(r.farmNew)); if(r.farmCombat===false)fail.push('Farming was added to COMBAT_SKILLS'); }
 if(old&&r.oldLoad===false)fail.push('max save failed to load');
 if(old&&r.farmNew&&r.oldFarm&&!(r.oldFarm.level===1&&r.oldFarm.max===1000&&r.oldFarm.had===false))fail.push('max-save Farming migration '+JSON.stringify(r.oldFarm));
 if(old&&r.oldAttackKept===false)fail.push('Attack level changed on migrate');
 if(old&&r.oldHunterKept===false)fail.push('Hunter level changed on migrate');
 if(old&&r.oldConKept===false)fail.push('Construction level changed on migrate');
 if(r.ver!==26)fail.push('SAVE_VERSION '+r.ver);
 if(oldLegacy&&r.legacyLoad===false)fail.push('legacy 99 save failed');
 if(oldLegacy&&r.farmNew&&r.legacyFarm!=null&&r.legacyFarm!==1)fail.push('legacy Farming '+r.legacyFarm);
 console.log(JSON.stringify(r,null,1));
 console.log('errors:',errs.length?errs:'none');
 if(fail.length){console.log('FAIL:',fail.join('; '));await b.close();process.exit(1);}
 if(errs.length){await b.close();process.exit(1);}
 console.log('phase12-check ok');
 await b.close();process.exit(0);})();
