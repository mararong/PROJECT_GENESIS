import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openBrowser, delay } from './browser.mjs';
const b=await openBrowser();
const results=[];
const check=(name,result)=>{assert.ok(result,name);results.push({name,passed:true});console.log('PASS',name)};
try{
  await b.viewport(1440,900);await b.navigate();
  check('P1 desktop: no horizontal overflow',await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await b.screenshot('p1-start-desktop.png');
  await b.viewport(390,844);await b.screenshot('p1-start-mobile.png');
  check('P1 mobile: no horizontal overflow',await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await b.viewport(1440,900);await b.click('새로운 세계 만들기');await b.screenshot('p1-create-desktop.png');
  await b.click('다음');await b.click('다음');await b.click('세계 생성');
  await b.waitFor('document.querySelector(".world-stage canvas")?.width>100');await delay(800);
  await b.click('튜토리얼 건너뛰기');
  check('P2: real Pixi canvas mounted',await b.evaluate('document.querySelector(".pixi-host canvas").width>100'));
  await b.screenshot('p2-world-desktop.png');
  // Click #013 using the same deterministic public model and coordinate contract.
  const {generateWorld,DEFAULT_CONFIG}=await import('../src/simulation/worldGenerator.ts');
  const initial=generateWorld(DEFAULT_CONFIG),creature=initial.creatures[12];
  const rect=await b.evaluate('(()=>{const r=document.querySelector(".pixi-host").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()');
  const x=rect.x+rect.width/2+(creature.x-64)*16*.8,y=rect.y+rect.height/2+(creature.y-64)*16*.8;
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(200);
  check('P3: canvas click matches inspector #013',await b.evaluate('document.querySelector(".specimen-name")?.textContent.includes("#013")'));
  await b.click('신체');await b.screenshot('p3-body-desktop.png');
  check('P3: body count matches model',await b.evaluate(`document.querySelectorAll('.parts-list button').length===${creature.bodyParts.length}`));
  await b.click('유전자');check('P3: genome matches selected model',await b.evaluate(`document.querySelector('.genome-list').textContent.includes('${creature.genome.moveSpeed.toFixed(3)}')`));
  await b.click('개요');await b.click('이 개체 추적F');
  check('P3: tracking starts',await b.evaluate('document.querySelector(".following-chip")?.textContent.includes("013")'));
  await b.click('추적 중단F');
  const tick=()=>b.evaluate('Number(document.querySelector(".transport-tick").textContent.replace(/\\D/g,""))');
  const t0=await tick();await delay(350);check('P4: paused tick stays fixed',(await tick())===t0);
  await b.click('다음 틱');check('P4: single step increments exactly one',(await tick())===t0+1);
  await b.click('재생');await delay(600);await b.click('일시정지');const t1=await tick();check('P4: playback advances',t1>t0+1);await delay(300);check('P4: pause remains fixed',(await tick())===t1);
  await b.click('10배속');await b.click('재생');await delay(600);await b.click('일시정지');check('P4: 10x advances more ticks',(await tick())-t1>=30);
  await b.screenshot('p4-running-desktop.png');
  await b.click('정보 패널 닫기');check('P3: close preserves selection',await b.evaluate('document.querySelector(".inspector")===null'));await b.click('정보 패널 열기');check('P3: reopening retains #013',await b.evaluate('document.querySelector(".specimen-name")?.textContent.includes("#013")'));
  for(const [width,height]of [[1440,900],[768,1024],[390,844]]){
    await b.viewport(width,height);await delay(150);await b.screenshot(`p5-${width}.png`);
    check(`P5 ${width}px: no horizontal overflow`,await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    check(`P5 ${width}px: transport fully visible`,await b.evaluate('(()=>{const r=document.querySelector(".transport").getBoundingClientRect();return r.bottom<=innerHeight+1&&r.x>=0&&r.right<=innerWidth+1})()'));
    check(`P5 ${width}px: sheet does not cover playback`,await b.evaluate('(()=>{const p=document.querySelector(".inspector").getBoundingClientRect(),t=document.querySelector(".transport").getBoundingClientRect();return p.bottom<=t.top+1})()'));
  }
  check('P5: no browser runtime errors',b.errors.length===0);
  await writeFile('docs/qa/results.json',JSON.stringify({results,errors:b.errors},null,2));
}finally{await b.close()}
