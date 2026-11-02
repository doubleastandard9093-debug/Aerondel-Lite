// Close-up realism check: node tools/realism-check.cjs [path] [real 1|0] [shotPrefix]  env TYPES="Goblin,Cow"
// Puts the camera close to each rigged monster and reports whether the rich (physical) set is active.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');
const [,,path='',real='1',shot='']=process.argv;
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:900,height:600});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 await p.goto(`http://localhost:8811/${path}?gfx=high&real=${real}${path.includes('webgpu')?'&backend=webgl':''}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,10000));
 const out=[];
 for(const T of (process.env.TYPES||'Goblin,Cow').split(',')){
  const r=await p.evaluate(async T=>{const g=window.gielinor,S=ms=>new Promise(r=>setTimeout(r,ms));const m=g.monsters.find(m=>m.typeName===T&&m.alive);if(!m)return{T,none:true};
   const mp=m.mesh.position;g.pm.mesh.position.set(mp.x+1.5,mp.y,mp.z+2.5);m.state='idle';m.aggro=false;g.rig.targetDist=g.rig.dist=7;g.rig.targetPitch=g.rig.pitch=0.35;
   for(let i=0;i<150&&!(m.rig&&m.rig.on);i++)await S(400);await S(2500);const R=m.rig;
   return{T,on:R&&R.on,rich:R&&R.rich,mats:R&&R.meshes.map(M=>[].concat(M.o.material).map(x=>x.type+':'+(x.userData.kind||'')).join(',')).join(' | ')};},T);
  if(shot&&!r.none)await p.screenshot({path:`${shot}-${T.replace(/ /g,'_')}.png`}); out.push(r);}
 console.log(JSON.stringify({real,out,errs:errs.slice(0,5)}));await b.close();})();
