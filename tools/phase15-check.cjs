// Phase 15 (v29) headless check: Kinbeasts (after the Phase 15 bugfixes). Also loads the v26 max save and older fixtures.
// Usage: node tools/phase14-check.cjs [low|high] [save.json]
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
  o.hasHorde=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='horde'));
  o.hasMarks=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='marks'));
  o.hasSpire=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='spire'));
  o.hasKin=!!(A&&A.tabs&&A.tabs.some(t=>t.id==='kin'));
  o.hunterKept=g.skills.Hunter&&g.skills.Hunter.max===1000;
  o.farmKept=g.skills.Farming&&g.skills.Farming.max===1000;
  if(A&&A.vtests){
    for (const k of ['hordewake','deepmarks','ashspire','kinbeasts']) {
      if(!A.vtests[k]) continue;
      try{o[k]=await A.vtests[k](g,A);}catch(e){o[k]='ERR '+e.message;}
    }
  }
  if(old){const s=JSON.parse(old);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;const lat=s.player&&s.player.adapt&&s.player.adapt.lattice;
    const ok=SV.applySaveData(s,g.skills,P,g.pm);o.oldLoad=ok;o.oldAttackKept=atk==null||g.skills.Attack.level===atk;
    o.oldLattice=JSON.stringify((g.player.adapt&&g.player.adapt.lattice)||{})===JSON.stringify(lat||g.player.adapt.lattice);}
  if(old26){const s=JSON.parse(old26);const atk=s.skills&&s.skills.Attack&&s.skills.Attack.level;const hun=s.skills&&s.skills.Hunter&&s.skills.Hunter.level;const farm=s.skills&&s.skills.Farming&&s.skills.Farming.level;const con=s.skills&&s.skills.Construction&&s.skills.Construction.level;
    const ok=SV.applySaveData(s,g.skills,P,g.pm);o.v26Load=ok;o.v26Attack=atk==null||g.skills.Attack.level===atk;o.v26Hunter=hun==null||g.skills.Hunter.level===hun;o.v26Farm=farm==null||g.skills.Farming.level===farm;o.v26Con=con==null||g.skills.Construction.level===con;}
  if(oldLegacy){const atk=JSON.parse(oldLegacy).skills&&JSON.parse(oldLegacy).skills.Attack&&JSON.parse(oldLegacy).skills.Attack.level;
    try{const ok=SV.applySaveData(JSON.parse(oldLegacy),g.skills,P,g.pm);o.legacyLoad=ok;o.legacyAttackKept=atk==null||g.skills.Attack.level===atk;}catch(e){o.legacyLoad=e.message;}}
  const sv=JSON.parse(SV.getSaveData(g.skills,P,g.pm));o.ver=sv.version;
  return o;},old,oldLegacy,old26,tier);
 const fail=[];
 if(!r.core)fail.push('no ventures core');
 if(!r.hasHorde)fail.push('no Hordewake tab');
 if(r.hordewake!==true&&r.hordewake!==undefined)fail.push('hordewake vtest '+r.hordewake);
 if(r.hasMarks&&r.deepmarks!==true&&r.deepmarks!==undefined)fail.push('deepmarks vtest '+r.deepmarks);
 if(r.hasSpire&&r.ashspire!==true&&r.ashspire!==undefined)fail.push('ashspire vtest '+r.ashspire);
 if(!r.hasKin)fail.push('no Kinbeasts tab');
 if(r.kinbeasts!==true&&r.kinbeasts!==undefined)fail.push('kinbeasts vtest '+r.kinbeasts);
 if(old&&r.oldLoad===false)fail.push('max save failed to load');
 if(old&&r.oldAttackKept===false)fail.push('Attack level changed on migrate');
 if(old26&&r.v26Load===false)fail.push('v26 max save failed to load');
 if(old26&&r.v26Attack===false)fail.push('v26 Attack changed');
 if(old26&&r.v26Hunter===false)fail.push('v26 Hunter changed');
 if(old26&&r.v26Farm===false)fail.push('v26 Farming changed');
 if(old26&&r.v26Con===false)fail.push('v26 Construction changed');
 if(r.ver<29)fail.push('SAVE_VERSION '+r.ver);
 if(oldLegacy&&r.legacyLoad===false)fail.push('legacy 99 save failed');
 console.log(JSON.stringify(r,null,1));
 console.log('errors:',errs.length?errs:'none');
 if(fail.length){console.log('FAIL:',fail.join('; '));await b.close();process.exit(1);}
 if(errs.length){await b.close();process.exit(1);}
 console.log('phase15-check ok');
 await b.close();process.exit(0);})();
