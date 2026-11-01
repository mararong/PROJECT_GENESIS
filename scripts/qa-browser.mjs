import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openBrowser, delay } from './browser.mjs';
import { DEFAULT_CONFIG, generateWorld } from '../src/simulation/worldGenerator.ts';
const b = await openBrowser(), results = [];
const check = (label, value) => { assert.equal(value, true, label); results.push({ label, passed: true }); console.log(`PASS ${label}`); };
const rect = selector => b.evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};})()`);
const tick = () => b.evaluate(`Number(document.querySelector('[data-testid=header-tick]').textContent)`);
async function pointer(type, x, y, extra = {}) { await b.send('Input.dispatchMouseEvent', { type, x, y, ...extra }); await delay(60); }
try {
  await b.viewport(1440, 900); await b.navigate(); await b.evaluate('localStorage.clear()'); await b.navigate();
  await b.screenshot('p1-start-desktop.png');
  check('P1: empty library is real', await b.evaluate(`document.body.textContent.includes('아직 생성한 세계가 없습니다')`));
  await b.click('새로운 세계 만들기'); await b.screenshot('p1-create-desktop.png');
  await b.click('다음'); await b.click('다음'); await b.click('세계 생성');
  await b.waitFor(`document.querySelector('.pixi-host canvas') || document.querySelector('.renderer-error')`);
  check('P2: real Pixi canvas without renderer error', await b.evaluate(`!!document.querySelector('.pixi-host canvas') && !document.querySelector('.renderer-error')`));
  await b.click('튜토리얼 건너뛰기'); await b.screenshot('p2-world-desktop.png');
  const initial = generateWorld(DEFAULT_CONFIG);
  const bounds = await rect('.pixi-host');
  const camera = await b.evaluate(`({...document.querySelector('.world-renderer').dataset})`);
  const candidates = initial.creatures.map(c => ({ id:c.id,x:bounds.x+bounds.width/2+(c.x-Number(camera.cameraX))*16*Number(camera.cameraZoom),y:bounds.y+bounds.height/2+(c.y-Number(camera.cameraY))*16*Number(camera.cameraZoom) })).filter(c => c.x > bounds.x+100 && c.x < bounds.x+bounds.width-160 && c.y > bounds.y+140 && c.y < bounds.y+bounds.height-80);
  const c = candidates[0]; assert.ok(c, 'a visible organism must exist');
  await pointer('mousePressed', c.x, c.y, { button:'left', clickCount:1 }); await pointer('mouseReleased', c.x, c.y, { button:'left', clickCount:1 });
  check('P3: canvas click selects the exact specimen ID', await b.evaluate(`document.querySelector('.world-renderer').dataset.selectedId === '${c.id}' && document.querySelector('.specimen-name').textContent.includes('#${String(c.id).padStart(3,'0')}')`));
  await b.click('유전자'); check('P3: genome reflects data', await b.evaluate(`document.querySelector('.genome-list').textContent.includes('${initial.creatures.find(x=>x.id===c.id).genome.moveSpeed.toFixed(3)}')`));
  await b.screenshot('p3-genome-desktop.png'); await b.click('개요'); await b.click('이 개체 추적');
  check('P3: tracking centers the real position', await b.evaluate(`Math.abs(Number(document.querySelector('.world-renderer').dataset.cameraX)-${initial.creatures.find(x=>x.id===c.id).x})<.001`));
  await b.click('추적 중단');
  const oldZoom = await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraZoom)`);
  await b.click('확대'); check('P2: zoom button changes camera', await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraZoom)>${oldZoom}`));
  const oldX = await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraX)`);
  await pointer('mousePressed', bounds.x+300, bounds.y+200, {button:'left',clickCount:1}); await pointer('mouseMoved', bounds.x+360, bounds.y+240, {button:'left',buttons:1}); await pointer('mouseReleased', bounds.x+360, bounds.y+240,{button:'left',clickCount:1});
  check('P2: drag pans without clearing selection', await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraX)!==${oldX} && document.querySelector('.world-renderer').dataset.selectedId==='${c.id}'`));
  const before = await tick(); await b.click('다음 틱'); check('P4: single step is exact', await tick() === before+1);
  const frozen = await tick(); await delay(450); check('P4: paused tick stays fixed', await tick() === frozen);
  await b.click('재생'); await delay(1000); await b.click('일시정지'); const oneX = await tick();
  await b.click('10배속'); await b.click('재생'); await delay(1000); await b.click('일시정지'); const tenX = await tick();
  check('P4: real ticks increase faster at 10×', tenX-oneX > (oneX-frozen)*4);
  await b.click('섭취');
  check('P4: actual feeding events recorded', await b.evaluate(`!!document.querySelector('.event-card.event-eat') && document.querySelector('.event-card.event-eat').textContent.includes('먹이 섭취')`));
  const eventTick = await tick();
  await b.evaluate(`document.querySelector('.event-card.event-eat').click()`); await delay(100);
  check('P4: timeline selects actual event without rewinding', await tick()===eventTick && await b.evaluate(`!!document.querySelector('.event-card.selected') && !!document.querySelector('.specimen-name')`));
  await b.click('전체');
  await b.screenshot('p4-running-desktop.png');
  for (const [width,height,label] of [[1440,900,'desktop'],[768,1024,'tablet'],[390,844,'mobile']]) {
    await b.viewport(width,height); await delay(500);
    check(`P5: ${label} has no page overflow`, await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    const bar = await rect('.transport'); check(`P5: ${label} transport visible`, bar.bottom<=height+1 && bar.y>=0);
    if (width < 768) {
      for (let i=0;i<3;i++) { const panel=await rect('.inspector'); check(`P5: mobile sheet ${i+1} does not cover transport`, panel.bottom<=bar.y+1); await b.screenshot(`p5-mobile-sheet-${i+1}.png`); await b.click('시트 높이 변경'); }
      await b.click('정보 패널 닫기');
      await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
      const cameraBefore = await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraX)`);
      await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:180,y:260}]});
      await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:220,y:280}]});
      await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await delay(150);
      check('P5: emulated touch pans the camera',await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraX)!==${cameraBefore}`));
      const zoomBefore = await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraZoom)`);
      await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:100,y:300},{id:2,x:260,y:300}]});
      await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:70,y:300},{id:2,x:290,y:300}]});
      await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await delay(150);
      check('P5: emulated pinch changes zoom',await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraZoom)>${zoomBefore}`));
      check('P5: touch navigation preserves selected specimen',await b.evaluate(`document.querySelector('.world-renderer').dataset.selectedId!==''`));
      await b.screenshot('p5-mobile-touch.png');
    }
    await b.screenshot(`p5-${label}.png`);
  }
  check('P5: browser has no uncaught application errors', b.errors.length===0);
  await writeFile('docs/qa/browser-results.json', JSON.stringify({ checkedAt:new Date().toISOString(), results, errors:b.errors },null,2));
  console.log(`Browser QA: ${results.length} checks passed. Screenshots: docs/qa/`);
} catch (error) {
  await b.screenshot('failure.png').catch(()=>{});
  await writeFile('docs/qa/browser-results.json',JSON.stringify({checkedAt:new Date().toISOString(),results,errors:b.errors,failure:String(error)},null,2));
  throw error;
} finally { await b.close(); }
