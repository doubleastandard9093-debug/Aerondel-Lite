// Perf guard rails (headless). Usage: node tools/perf-check.cjs [low|high]
// 1) Any object frozen with matrixAutoUpdate=false must never go stale: after walking and depleting/respawning a tree and a rock,
//    every frozen object's matrix must still equal compose(position, quaternion, scale).
// 2) No material may flip its shader key frame to frame (plain vs instanced, receiveShadow, instance colours).
// 3) Prints main-thread rAF time, heap and draw-call numbers for before/after comparisons. Does not touch saves on disk.
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');
const [,,tier='low']=process.argv;
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); if(tier==='low')await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});else await p.setViewport({width:1280,height:800});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 await p.evaluateOnNewDocument(()=>{const R=window.__pc={cb:[]};const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>raf(t=>{const s=performance.now();f(t);R.cb.push(performance.now()-s);});});
 await p.goto('http://localhost:8811/',{waitUntil:'load'}).catch(()=>{});await p.evaluate(()=>localStorage.clear());
 await p.goto('http://localhost:8811/?gfx='+tier,{waitUntil:'load',timeout:90000});
 await p.waitForFunction(()=>window.aerondel&&window.aerondel.renderer,{timeout:120000}).catch(()=>{});await new Promise(r=>setTimeout(r,12000));
 const r=await p.evaluate(async()=>{const g=window.aerondel,o={};if(!g){return {boot:false};}o.boot=true;const T=await import('three');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // shader-key flips over ~6 s
  const P=g.renderer.properties,K=['instancing','skinning','receiveShadow','instancingColor','vertexAlphas','morphTargetsCount','outputColorSpace','numClippingPlanes','toneMapping'];
  const snap=m=>{const q=P.get(m);return q.programs||q.currentProgram?K.map(k=>q[k]).join('|'):null;}; /* null = not compiled yet: a first compile is not a flip */const before=new WeakMap(),flips={};
  T.Mesh.prototype.onBeforeRender=function(r,s,c,geo,m){before.set(this,snap(m));};
  T.Mesh.prototype.onAfterRender=function(r,s,c,geo,m){const a=before.get(this);if(s&&s.overrideMaterial===m)return; /* a whole-scene override (GTAO normal pass on High) is one material for every mesh by design */ if(a!=null&&a!==snap(m)){const k='mat#'+m.id+' '+m.type+(this.isInstancedMesh?' (instanced)':'');flips[k]=(flips[k]||0)+1;}};
  window.__pc.cb.length=0;const h0=performance.memory?performance.memory.usedJSHeapSize:0;
  await sleep(6000);delete T.Mesh.prototype.onBeforeRender;delete T.Mesh.prototype.onAfterRender;
  const cb=window.__pc.cb.slice().sort((a,b)=>a-b);o.frames=cb.length;o.rafAvgMs=+(cb.reduce((a,b)=>a+b,0)/(cb.length||1)).toFixed(2);o.rafP95Ms=+(cb[Math.floor(cb.length*.95)]||0).toFixed(2);
  o.heapMB=+((performance.memory?performance.memory.usedJSHeapSize:0)/1048576).toFixed(1);o.drawCalls=g.renderer.info.render.calls;
  o.flips=flips;
  // stale-matrix check after moving around and depleting nodes
  const pos=g.pm.mesh.position;g.walkTo&&g.walkTo(pos.x+12,pos.z+6);await sleep(4000);
  for(const type of ['tree','rock']){const n=g.nodes.find(n=>n.type===type&&n.alive);if(!n)continue;n.alive=false;n.syncInstance&&n.syncInstance(n);if(n.depleted)n.depleted.visible=true;await sleep(300);n.alive=true;n.syncInstance&&n.syncInstance(n);if(n.depleted)n.depleted.visible=false;}
  await sleep(1500);
  const m4=new T.Matrix4();let frozen=0,stale=[];g.scene.traverse(x=>{if(x.matrixAutoUpdate)return;frozen++;m4.compose(x.position,x.quaternion,x.scale);for(let i=0;i<16;i++)if(Math.abs(m4.elements[i]-x.matrix.elements[i])>1e-5){stale.push(x.type+':'+(x.name||x.parent&&x.parent.name||''));break;}});
  o.frozen=frozen;o.stale=stale.slice(0,10);o.staleN=stale.length;
  return o;});
 const fail=[];if(!r.boot)fail.push('game did not boot');
 if(r.staleN)fail.push(r.staleN+' frozen objects have stale matrices: '+r.stale.join(', '));
 if(r.flips&&Object.keys(r.flips).length)fail.push('shader key flips: '+JSON.stringify(r.flips));
 if(errs.length)fail.push('page errors: '+errs.slice(0,3).join(' | '));
 console.log(JSON.stringify(r));
 if(r.boot&&r.frames<3)console.log('WARN: only '+r.frames+' frames in the 6 s window (software GL at this tier); flip and rAF numbers are thin. Re-run on a GPU for real numbers.');
 console.log(fail.length?'FAIL: '+fail.join('; '):'PASS perf-check ('+tier+')');
 await b.close();process.exit(fail.length?1:0);})();
