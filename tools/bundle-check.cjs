// Bundle check: bundle/aerondel.js is fresh (matches js/), boots with no errors and no source-module requests,
// and the game it builds matches the js/ sources (same API, world counts, save version, save fixture restored the same).
// Usage: node tools/bundle-check.cjs [low|high] [save.json]
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');const {execFileSync}=require('child_process');
const [,,tier='low',savef]=process.argv;
try{execFileSync('node',[__dirname+'/build-bundle.cjs','--check'],{stdio:'inherit'});}catch(e){process.exit(1);}
async function run(mode){
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const req=[],errs=[];p.on('request',r=>req.push(r.url()));p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 if(savef){await p.goto('http://localhost:8811/manifest.json',{waitUntil:'load'}).catch(()=>{});await p.evaluate(s=>{localStorage.clear();localStorage.setItem('aerondel3d',s)},fs.readFileSync(savef,'utf8'));}
 else{await p.goto('http://localhost:8811/manifest.json',{waitUntil:'load'}).catch(()=>{});await p.evaluate(()=>localStorage.clear());}
 req.length=0;errs.length=0;
 await p.goto(`http://localhost:8811/?${mode}&gfx=${tier}`,{waitUntil:'load',timeout:90000});await new Promise(r=>setTimeout(r,15000));
 const r=await p.evaluate(async()=>{const g=window.gielinor,S=ms=>new Promise(r=>setTimeout(r,ms));if(!g)return{boot:false};
  const P=g.player,x0=g.pm.mesh.position.x,z0=g.pm.mesh.position.z;
  const o={boot:true,api:Object.keys(g).sort().join(','),skills:Object.values(g.skills).reduce((a,s)=>a+s.level,0),
   inv:JSON.stringify(P.inventory),quests:Object.keys(P.quests||{}).length,nodes:(g.nodes||[]).length,gp:P.gp??null};
  window.dispatchEvent(new Event('pagehide'));const sv=JSON.parse(localStorage.getItem('aerondel3d')||'{}');o.saveVersion=sv.version;
  g.walkTo?.(x0+4,z0+4);await S(4000);o.moved=Math.hypot(g.pm.mesh.position.x-x0,g.pm.mesh.position.z-z0)>0.5;
  return o;});
 r.errs=errs;r.bundleReq=req.filter(u=>/\/bundle\/aerondel\.js/.test(u)).length;r.srcReq=req.filter(u=>/localhost:8811\/js\//.test(u)).length;r.reqs=req.length;
 await b.close();return r;
}
(async()=>{
 const B=await run('bundle'),D=await run('dev');const fail=[];
 if(!B.boot)fail.push('bundle did not boot');if(B.errs.length)fail.push('bundle errors: '+B.errs.slice(0,3).join(' | '));
 if(B.bundleReq<1)fail.push('bundle/aerondel.js not requested');if(B.srcReq)fail.push(B.srcReq+' js/ source requests in bundle mode');
 if(D.bundleReq)fail.push('dev mode fetched the bundle');
 for(const k of ['api','skills','inv','quests','nodes','gp','saveVersion','moved'])if(B[k]!==D[k])fail.push(`${k} differs: bundle=${String(B[k]).slice(0,80)} dev=${String(D[k]).slice(0,80)}`);
 console.log(JSON.stringify({tier,save:savef||null,bundle:{reqs:B.reqs,srcReq:B.srcReq,skills:B.skills,quests:B.quests,nodes:B.nodes,saveVersion:B.saveVersion,moved:B.moved},dev:{reqs:D.reqs,srcReq:D.srcReq}}));
 if(fail.length){console.log('FAIL\n- '+fail.join('\n- '));process.exit(1);}console.log('ok');
})();
