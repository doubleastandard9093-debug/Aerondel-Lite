// Rigged characters check. Usage: node tools/rigs-check.cjs [path] [low|high] [WxH] [shotPrefix]   env TYPES="Wolf,Goblin"
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');
const [,,path='',gfx='high',sz='1280x800',shot='']=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1])); p.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/favicon|404/.test(t)||/\[models\] failed/.test(t))errs.push(t)});
 const q=(path.includes('webgpu')?'?backend=webgl&':'?')+'gfx='+gfx;
 await p.goto(`http://localhost:8811/${path}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,10000)); await p.evaluate(g=>window.gielinor.setGfx(g),gfx);
 const types=(process.env.TYPES||'Wolf,Goblin,Skeleton,Giant Spider,Ogre,Green Dragon,Cow,Bandit').split(',');const out=[];
 for(const T of types){
  const r=await p.evaluate(async(T)=>{const g=window.gielinor,S=ms=>new Promise(r=>setTimeout(r,ms));const m=g.monsters.find(m=>m.typeName===T&&m.alive);if(!m)return{T,none:true};
   const mp=m.mesh.position;g.pm.mesh.position.set(mp.x,mp.y,mp.z-5);m.state='idle';for(let i=0;i<150&&!(m.rig&&m.rig.on);i++)await S(500);await S(1000);
   const R=m.rig;if(!R)return{T,rig:String(m.rig),stats:window.rigStats()};const s0=R.curSt;m.state='fight';m.lungeT=1;let s1;for(let i=0;i<20&&!s1;i++){await S(100);if(R.curSt==='attack')s1='attack';}m.state='idle';m.hitT=1;m.lungeT=0;await S(1500);
   return{T,model:R.name,on:R.on,idle:s0,attack:s1,clips:Object.keys(R.acts).filter(k=>R.acts[k]).join('/'),loHidden:!(m._lod||{lo:{visible:1}}).lo.visible,stats:window.rigStats()};},T);
  if(shot&&!r.none)await p.screenshot({path:`${shot}-${T.replace(/ /g,'_')}.png`});
  out.push(r);}
 // death on the last one
 const d=await p.evaluate(async()=>{const g=window.gielinor,S=ms=>new Promise(r=>setTimeout(r,ms));const m=g.monsters.find(m=>m.rig&&m.rig.on&&m.alive);if(!m)return'no rig';m.alive=false;m.dying=true;m.deathT=0;m.state='dead';for(let i=0;i<30;i++){await S(100);if(m.rig.curSt==='death')return 'death';}return m.rig.curSt;});
 console.log(JSON.stringify({path,gfx,sz,out,death:d,errs:errs.slice(0,6)},null,0));await b.close();})();
