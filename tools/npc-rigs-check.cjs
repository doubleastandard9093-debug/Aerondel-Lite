// NPC / companion / ogre-folk rig check. Usage: node tools/npc-rigs-check.cjs [path] [low|high] [WxH] [shot.png]
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');
const [,,path='',gfx='high',sz='1280x800',shot='']=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1])); p.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/favicon|404/.test(t)||/\[models\] failed/.test(t))errs.push(t)});
 const q=(path.includes('webgpu')?'?backend=webgl&':'?')+'gfx='+gfx;
 await p.goto(`http://localhost:8811/${path}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,10000)); await p.evaluate(g=>window.gielinor.setGfx(g),gfx);
 const r=await p.evaluate(async()=>{const g=window.gielinor,S=ms=>new Promise(r=>setTimeout(r,ms));
  const cnt=()=>{const npcs=g.nodes.filter(n=>n.type==='npc');const on=npcs.filter(n=>n.rig&&n.rig.on);return{npcs:npcs.length,rigOn:on.length,models:[...new Set(on.map(n=>n.rig.name))].join(','),states:[...new Set(on.map(n=>n.rig.curSt))].join(',')};};
  for(let i=0;i<120&&cnt().rigOn<3;i++)await S(500);await S(3000);const town=cnt();
  const comp=Object.values(g.compEnts)[0];let c=null;if(comp){const cp=comp.mesh.position;g.pm.mesh.position.set(cp.x+2,cp.y,cp.z);for(let i=0;i<120&&!(comp.rig&&comp.rig.on);i++)await S(500);c={name:comp.name,model:comp.rig&&comp.rig.name,on:!!(comp.rig&&comp.rig.on)};}
  const {VILLAGES}=await import('/js/villagedata.js');const V=VILLAGES.find(v=>v.kind==='ogre');let og=null;
  if(V){g.pm.mesh.position.set(V.x,0,V.z);let f=0;for(let i=0;i<120;i++){await S(500);f=0;g.scene.traverse(o=>{const F=o.userData.folk;if(F&&/orc/.test(F.path)&&F.mixer)f++;});if(f)break;}await S(2000);og={village:V.name||V.id,ogreFolkAnimated:f};}
  return{town,companion:c,ogre:og,stats:window.rigStats()};});
 if(shot)await p.screenshot({path:shot});
 console.log(JSON.stringify({path,gfx,sz,...r,errs:errs.slice(0,6)}));await b.close();})();
