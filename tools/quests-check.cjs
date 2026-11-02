// Quest tab check. Usage: node tools/quests-check.cjs [path] [WxH]
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');
const [,,path='',sz='390x844']=process.argv;const [w,h]=sz.split('x').map(Number);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:w,height:h,isMobile:w<500,hasTouch:w<500});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1])); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 const q=path.includes('webgpu')?'?backend=webgl':'';
 await p.goto(`http://localhost:8811/${path}${q}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,12000));
 const r=await p.evaluate(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));const t=[...document.querySelectorAll('[data-tab]')].find(e=>e.dataset.tab==='quests');if(!t)return{noTab:true};
  const t0=performance.now();t.click();await S(1500);const ql=document.querySelectorAll('.quest').length;const qs=[...document.querySelectorAll('.quest[data-quest]')];const last=qs[qs.length-1];if(last){last.click();await S(800);}const j=!!document.querySelector('.journal');document.querySelector('.jback')?.click();await S(500);document.querySelector('[data-qmore]')?.click();await S(800);const more=document.querySelectorAll('.quest').length;return{quests:ql,journal:j,afterMore:more,ms:Math.round(performance.now()-t0),html:(document.querySelector('.questlist')||{}).innerHTML?.length||0};});
 console.log(JSON.stringify({path,sz,r,errs:errs.slice(0,5)}));await b.close();})();
