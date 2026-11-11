// Phase 11 (v25) headless check: Lookplates, Vocations, Wordcries, Construction, Townsteads.
// Usage: node tools/phase11-check.cjs [low|high] [save.json]
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
  o.hasWard=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='wardrobe'));
  o.hasVoc=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='vocations'));
  o.hasCry=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='cries'));
  o.hasStead=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='steads'));
  o.conNew=g.skills.Construction?{level:g.skills.Construction.level,max:g.skills.Construction.max}:null;
  o.conCombat=!(SK.COMBAT_SKILLS||[]).includes('Construction');
  o.hunterKept=g.skills.Hunter&&g.skills.Hunter.max===1000;
  if(A&&A.vtests){
    for (const k of ['wardrobe','vocations','wordcries','townsteads']) {
      if(!A.vtests[k]) continue;
      try{o[k]=await A.vtests[k](g,A);}catch(e){o[k]='ERR '+e.message;}
    }
  }
  if(old){const s=JSON.parse(old);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;const hadCon=!!(s.skills&&s.skills.Construction);const hun=s.skills&&s.skills.Hunter&&s.skills.Hunter.level;
    const ok=SV.applySaveData(s,g.skills,P,g.pm);o.oldLoad=ok;o.oldCon={level:g.skills.Construction&&g.skills.Construction.level,max:g.skills.Construction&&g.skills.Construction.max,had:hadCon};
    o.oldAttackKept=atk==null||g.skills.Attack.level===atk;o.oldHunterKept=hun==null||g.skills.Hunter.level===hun||(hun==null&&g.skills.Hunter&&g.skills.Hunter.level===1);}
  if(oldLegacy){const s=JSON.parse(oldLegacy);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;
    try{const ok=SV.applySaveData(JSON.parse(oldLegacy),g.skills,P,g.pm);o.legacyLoad=ok;o.legacyCon=g.skills.Construction&&g.skills.Construction.level;o.legacyAttackKept=atk==null||g.skills.Attack.level===atk;}catch(e){o.legacyLoad=e.message;}}
  const sv=JSON.parse(SV.getSaveData(g.skills,P,g.pm));o.ver=sv.version;
  return o;},old,oldLegacy,tier);
 const fail=[];
 if(!r.core)fail.push('no ventures core');
 if(!r.hasWard)fail.push('no Wardrobe tab');
 if(r.wardrobe!==true&&r.wardrobe!==undefined)fail.push('wardrobe/lookplates vtest '+r.wardrobe);
 if(r.hasVoc&&r.vocations!==true&&r.vocations!==undefined)fail.push('vocations vtest '+r.vocations);
 if(r.hasCry&&r.wordcries!==true&&r.wordcries!==undefined)fail.push('wordcries vtest '+r.wordcries);
 if(r.hasStead&&r.townsteads!==true&&r.townsteads!==undefined)fail.push('townsteads vtest '+r.townsteads);
 if(r.conNew){ if(!(r.conNew.level===1&&r.conNew.max===1000))fail.push('Construction '+JSON.stringify(r.conNew)); if(r.conCombat===false)fail.push('Construction was added to COMBAT_SKILLS'); }
 if(old&&r.oldLoad===false)fail.push('max save failed to load');
 if(old&&r.conNew&&r.oldCon&&!(r.oldCon.level===1&&r.oldCon.max===1000&&r.oldCon.had===false))fail.push('max-save Construction migration '+JSON.stringify(r.oldCon));
 if(old&&r.oldAttackKept===false)fail.push('Attack level changed on migrate');
 if(r.ver!==25)fail.push('SAVE_VERSION '+r.ver);
 if(oldLegacy&&r.legacyLoad===false)fail.push('legacy 99 save failed');
 if(oldLegacy&&r.conNew&&r.legacyCon!=null&&r.legacyCon!==1)fail.push('legacy Construction '+r.legacyCon);
 console.log(JSON.stringify(r,null,1));
 console.log('errors:',errs.length?errs:'none');
 if(fail.length){console.log('FAIL:',fail.join('; '));await b.close();process.exit(1);}
 if(errs.length){await b.close();process.exit(1);}
 console.log('phase11-check ok');
 await b.close();process.exit(0);})();
