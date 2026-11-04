// Ventures (v23) headless check. Usage: node tools/ventures-check.cjs [low|high] [save.json]
// Loads the game on a phone-sized viewport, exercises each Ventures system that is installed, migrates an old save and checks for console errors.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,tier='low',savef='/workspace/aerondel-save-max.json']=process.argv;
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8811/',{waitUntil:'load'}).catch(()=>{});
 await p.evaluate(()=>localStorage.clear());
 await p.goto(`http://localhost:8811/?gfx=${tier}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,14000));
 const old=fs.existsSync(savef)?fs.readFileSync(savef,'utf8'):null;
 const r=await p.evaluate(async(old,tier)=>{const g=window.gielinor,A=g.EXT.adapt,P=g.player,o={},SV=await import('/js/save.js');const T=ms=>new Promise(r=>setTimeout(r,ms));
  o.core=!!A&&!!document.getElementById('advWin');o.tabs=A.tabs.map(t=>t.id);
  A.open('overview');o.hubOpen=document.getElementById('advWin').classList.contains('on');A.close();
  const near=()=>{const pp=A.pos();let m=g.monsters.find(m=>m.alive&&!m.boss&&m.level<30);if(!m)return null;m.mesh.position.set(pp.x+1.2,pp.y,pp.z);m.hp=m.maxHp=5000;return m;};
  if(A.flare){const f=A.S('flare');f.meter=99;const m=near();A.flareAdd(5);o.flareFull=f.meter===100;await T(1600);o.hubBtn=!!document.querySelector('#flowbtns [data-q="ventures"]');o.flareBtn=!!document.querySelector('#flowbtns [data-q="flare"]');
   const hp0=m.hp;o.flareFired=!!A.flare();await T(1200);o.flareHit=m.hp<hp0;o.flareReset=f.meter<5;}
  for(const t of A.tabs){A.open(t.id);await T(30);}A.close();o.fit=document.getElementById('flowbtns').dataset.fit;
  // tests added per feature
  if(A.vtests)for(const [k,fn] of Object.entries(A.vtests)){try{o[k]=await fn(g,A,near,T);}catch(e){o[k]='ERR '+e.message;}}
  const sv=JSON.parse(SV.getSaveData(g.skills,P,g.pm));o.ver=sv.version;o.savedAdapt=!!sv.player.adapt&&Object.keys(sv.player.adapt).length;
  if(old){const s=JSON.parse(old);const ok=SV.applySaveData(s,g.skills,P,g.pm);o.oldLoad=ok;o.oldVer=s.version;o.oldAdapt=Object.keys(P.adapt||{}).sort().join(',');}
  return o;},old,tier);
 console.log(JSON.stringify(r,null,1));console.log('errors:',errs.length?errs:'none');await b.close();process.exit(errs.length?1:0);})();
