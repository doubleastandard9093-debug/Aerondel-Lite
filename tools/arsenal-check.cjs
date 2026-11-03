// Arsenal (v22) headless check. Usage: node tools/arsenal-check.cjs [low|high] [save.json]
const puppeteer=require('/workspace/pptr/node_modules/puppeteer-core');const fs=require('fs');
const [,,tier='low',savef]=process.argv;
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))errs.push(m.text())});
 await p.goto('http://localhost:8811/',{waitUntil:'load'}).catch(()=>{});
 await p.evaluate(s=>{localStorage.clear();if(s)localStorage.setItem('aerondel3d',s);},savef?fs.readFileSync(savef,'utf8'):null);
 await p.goto(`http://localhost:8811/?gfx=${tier}`,{waitUntil:'load',timeout:90000}); await new Promise(r=>setTimeout(r,15000));
 const r=await p.evaluate(async(sv0)=>{const g=window.gielinor,P=g.player,o={};
  if(sv0){const SV=await import('/js/save.js');SV.applySaveData(JSON.parse(sv0),g.skills,P,g.pm);}
  const A=await import('/js/arsenal.js'),I=await import('/js/items.js'),SK=await import('/js/skills.js'),AB=await import('/js/abilities.js');
  o.sword=g.skills.Swordsmanship&&g.skills.Swordsmanship.level;o.atk=g.skills.Attack.level;
  o.perks=SK.PERKS.Attack.length;o.uniq=I.FRONTIER_UNIQUES.length;
  const mon=g.monsters[0]||{name:'Dummy',hp:100,maxHp:100};const res={};
  for(const w of ['Steel katana','Steel scimitar','Steel glaive','Steel war fan','Steel chakram','Vexmar, the Last Eclipse']){
   P.equipment.weapon=w;g.applyLook();
   for(const id of ['iaido','crescent','whirl','gale','ricochet','eclipse','thousand']){const sw=[{acc:0,dmg:0}];A.arsenalSwing(P,g.skills,mon,sw,false,id,{tick:g.tick,log:()=>{},gain:()=>{}});res[w+':'+id]=sw.length;}}
  o.swings=res;o.blade=A.isBlade('Steel katana')&&!A.isBlade('Steel war fan');
  o.swLoaded=g.skills.Swordsmanship.level;P.equipment.body='Rimeplate cuirass';P.equipment.head='Eclipse Sovereign helm';g.applyLook();o.tint=g.pm.parts.bodyMat.color.getHex().toString(16);
  o.recipes=g.RECIPES.filter(x=>x.group==='Arsenal').length;o.cape=!!I.ITEMS['Swordsmanship cape'];o.magic=['frostspire','leyrend','astralnova','voidcollapse'].every(id=>AB.abilityById(id));
  g.giveXP('Swordsmanship',5e6);o.swordAfter=g.skills.Swordsmanship.level;
  g.invUI&&g.invUI.render&&g.invUI.render();
  const sv=JSON.parse((await import('/js/save.js')).getSaveData(g.skills,P,g.pm));o.ver=sv.version;o.savedSword=!!sv.skills.Swordsmanship;
  return o;},savef?fs.readFileSync(savef,'utf8'):null);
 console.log(JSON.stringify(r,null,1));console.log('errors:',errs.length?errs:'none');await b.close();})();
