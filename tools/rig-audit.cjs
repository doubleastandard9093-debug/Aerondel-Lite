// Rig audit (dev tool): node tools/rig-audit.cjs [gfx] [shotDir]  env TYPES="A,B" (default: every MONSTER_RIGS type)
// Finds each monster type (teleporting to its region when needed), frames it, screenshots it and reports the rig's world size.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');
const [,,gfx='high',dir='/tmp/aud']=process.argv;
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:800,height:560}); const errs=[]; p.on('pageerror',e=>errs.push(e.message+' @ '+(e.stack||'').split('\n').slice(1,3).join(' ')));
 await p.goto(`http://localhost:8811/?gfx=${gfx}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,10000));
 const types=process.env.TYPES?process.env.TYPES.split(','):await p.evaluate(async()=>Object.keys((await import('./js/rigs.js')).MONSTER_RIGS));
 for(const T of types){
  const r=await p.evaluate(async T=>{const g=window.gielinor,S=ms=>new Promise(r=>setTimeout(r,ms));
   let m=g.monsters.find(m=>m.typeName===T&&m.alive);
   if(!m){const {REGION_DATA}=await import('./js/regiondata.js');const R=REGION_DATA.find(R=>(R.mobs||[]).some(x=>x[0]===T));
     if(R){const mb=R.mobs.find(x=>x[0]===T);g.pm.mesh.position.set(R.x+mb[1]+6,0,R.z+mb[2]+6);for(let i=0;i<25&&!m;i++){await S(600);m=g.monsters.find(m=>m.typeName===T&&m.alive);}}}
   if(!m)return{T,none:true};
   const mp=m.mesh.position;g.pm.mesh.position.set(mp.x+4,mp.y,mp.z+6);m.aggro=false;m.state='idle';
   for(let i=0;i<60&&!(m.rig&&m.rig.on);i++)await S(400);await S(2000);
   const sz=o=>{let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];o.updateMatrixWorld(true);o.traverse(c=>{if(!c.isMesh||!c.visible)return;c.geometry.computeBoundingBox();const bb=c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);['x','y','z'].forEach((k,j)=>{mn[j]=Math.min(mn[j],bb.min[k]);mx[j]=Math.max(mx[j],bb.max[k]);});});return mx.map((v,j)=>+(v-mn[j]).toFixed(2)).concat(+(mn[1]-mp.y).toFixed(2));};
   const on=!!(m.rig&&m.rig.on),s=sz(on?m.rig.obj:m.body);g.rig.targetDist=g.rig.dist=Math.min(40,Math.max(6,s[1]*2.6+4));g.rig.targetPitch=g.rig.pitch=0.3;await S(1500);
   return{T,lvl:m.level,on,size_xyz_footY:s};},T);
  if(!r.none)await p.screenshot({path:`${dir}/${gfx}-${T.replace(/ /g,'_')}.png`}); console.log(JSON.stringify(r));}
 console.log(JSON.stringify({errs:errs.slice(0,5)}));await b.close();})();
