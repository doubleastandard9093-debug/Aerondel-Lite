// CC0 model streaming check. Usage: node tools/models-check.cjs [path] [low|high] [WxH] [shot.png]
// Teleports to a climate camp and a village, waits for chunk loads, and reports models fetched/dressed/folk animating.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');
const [,,path='',tier='high',sz='1280x720',shot]=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const req=[],errs=[]; p.on('request',r=>req.push(r.url())); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 const q=path.includes('webgpu')?'&backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}?gfx=${tier}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,12000));
 const r=await p.evaluate(async(VIL)=>{const g=window.gielinor,S=ms=>new Promise(r=>setTimeout(r,ms));const {REGION_DATA}=await import('/js/regiondata.js');
  const V=VIL&&(await import('/js/villagedata.js')).VILLAGES.find(v=>v.kind===VIL);const R=REGION_DATA.find(R=>R.id==='sunscour');const x=V?V.x:R.x+R.camp.dx,z=V?V.z-14:R.z+R.camp.dz;g.pm.mesh.position.set(x+2,g.pm.mesh.position.y,z+14);for(let i=0;i<40&&!(window.modelStats().loaded>3);i++)await S(1000);await S(4000);
  let dressed=0,folk=0,anim=0;g.scene.traverse(o=>{if(o.userData.dressed)dressed++;if(o.userData.folk){folk++;if(o.userData.folk.mixer&&o.visible)anim++;}});
  return {pos:[g.pm.mesh.position.x|0,g.pm.mesh.position.z|0],want:[x|0,z|0],stats:window.modelStats(),dressed,folk,anim,chunks:window.chunkStats().loaded};},process.env.VILLAGE||'');
 if(shot)await p.screenshot({path:shot});
 const glb=req.filter(u=>/\.glb/.test(u));
 const ok=r.stats.failed===0&&(tier==='low'?r.anim===0:r.dressed>0)&&!errs.length;
 console.log(JSON.stringify({ok,tier,path,sz,r,glbRequests:glb.length,glbs:glb.slice(0,5),errs:errs.slice(0,4)}));
 await b.close();})();
