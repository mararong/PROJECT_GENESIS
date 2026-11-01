import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { openBrowser, delay } from './browser.mjs';
import { SimulationEngine } from '../src/simulation/SimulationEngine.ts';
import { DEFAULT_CONFIG } from '../src/simulation/worldGenerator.ts';

const output = 'docs/qa/m0';
await mkdir(output, { recursive: true });
const b = await openBrowser(), checks = [], evidence = [];
const mirror = new SimulationEngine(DEFAULT_CONFIG);
const check = (label, condition) => { assert.ok(condition, label); checks.push({ label, passed: true }); console.log(`PASS ${label}`); };
const tick = () => b.evaluate(`Number(document.querySelector('[data-testid=header-tick]').textContent)`);
const rect = selector => b.evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};})()`);
const snapshot = () => b.evaluate(`(() => {
  // Read-only React props inspection: no global debug hook or production state mutation.
  const host=document.querySelector('.world-renderer'), key=Object.keys(host).find(k=>k.startsWith('__reactFiber$'));
  const tick=Number(document.querySelector('[data-testid=header-tick]').textContent);
  for(let f=host[key];f;f=f.return)for(const candidate of [f,f.alternate]){
    const p=candidate?.memoizedProps, w=p?.snapshot??p?.world;
    if(w?.creatures&&w?.resources&&w.tick===tick)return {tick:w.tick,creatures:w.creatures,resources:w.resources,statistics:w.statistics,events:w.events};
  }
  throw new Error('Could not inspect the committed engine snapshot');
})()`);
async function validateModel(label) {
  const actual = await snapshot();
  while (mirror.getSnapshot().tick < actual.tick) mirror.step();
  const expected = mirror.getSnapshot();
  assert.equal(actual.tick, expected.tick);
  assert.equal(actual.creatures.length, expected.creatures.length);
  for (const [i, c] of actual.creatures.entries()) {
    const e = expected.creatures[i];
    assert.equal(c.id, e.id); assert.equal(c.currentAction, e.currentAction); assert.equal(c.age, e.age); assert.equal(c.parentId, e.parentId);
    assert.ok(Math.abs(c.energy - e.energy) < 1e-7 && Math.hypot(c.x - e.x, c.y - e.y) < 1e-7);
  }
  for (const [i, r] of actual.resources.entries()) assert.ok(Math.abs(r.amount - expected.resources[i].amount) < 1e-7);
  for (const [key, value] of Object.entries(expected.statistics)) assert.ok(Math.abs(actual.statistics[key] - value) < 1e-6, key);
  check(`${label}: rendered snapshot matches independent seeded engine`, true);
  evidence.push({ label, tick: actual.tick, statistics: actual.statistics });
  return actual;
}
async function validateStats(label) {
  const actual = await validateModel(label), s = actual.statistics;
  const displayed = await b.evaluate(`Object.fromEntries(['population','total-births','total-deaths','average-energy','total-resources','simulation-time'].map(id=>[id,document.querySelector('[data-testid="'+id+'"]').textContent]))`);
  check(`${label}: population/birth/death totals match`, parseInt(displayed.population) === s.population && Number(displayed['total-births']) === s.totalBirths && Number(displayed['total-deaths']) === s.totalDeaths);
  check(`${label}: energy/resources/time match`, displayed['average-energy'] === s.averageEnergy.toFixed(1) && displayed['total-resources'] === s.totalResources.toFixed(1) && displayed['simulation-time'] === s.timeSeconds.toFixed(1) + ' s');
  return actual;
}
async function pointer(type, x, y, extra = {}) { await b.send('Input.dispatchMouseEvent', { type, x, y, ...extra }); await delay(60); }
let failure;
try {
  await b.viewport(1440, 900); await b.navigate(); await b.evaluate('localStorage.clear()'); await b.navigate();
  await b.click('새로운 세계 만들기'); await b.click('다음'); await b.click('다음'); await b.click('세계 생성');
  await b.waitFor(`document.querySelector('.pixi-host canvas')||document.querySelector('.renderer-error')`);
  check('Actual WebGL/Pixi canvas starts without renderer error', await b.evaluate(`!!document.querySelector('.pixi-host canvas')&&!document.querySelector('.renderer-error')`));
  await b.click('튜토리얼 건너뛰기');
  const initial = await validateStats('Initial paused world');
  const bounds = await rect('.pixi-host'), camera = await b.evaluate(`({...document.querySelector('.world-renderer').dataset})`);
  const visible = initial.creatures.map(c => ({ ...c, px: bounds.x + bounds.width / 2 + (c.x - Number(camera.cameraX)) * 16 * Number(camera.cameraZoom), py: bounds.y + bounds.height / 2 + (c.y - Number(camera.cameraY)) * 16 * Number(camera.cameraZoom) }))
    .find(c => c.px > bounds.x + 100 && c.px < bounds.x + bounds.width - 180 && c.py > bounds.y + 140 && c.py < bounds.y + bounds.height - 80);
  assert.ok(visible);
  // Mirror the actual nearest-creature pick rule, including overlapping initial spawns.
  const selected = initial.creatures.reduce((best, c) => Math.hypot(c.x - visible.x, c.y - visible.y) <= Math.hypot(best.x - visible.x, best.y - visible.y) ? c : best, visible);
  await pointer('mousePressed', visible.px, visible.py, { button: 'left', clickCount: 1 });
  await pointer('mouseReleased', visible.px, visible.py, { button: 'left', clickCount: 1 });
  const selectedId = await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.selectedId)`);
  const creature = initial.creatures.find(c => c.id === selectedId);
  check('Canvas pointer selects an organism at the real position', !!creature && Math.hypot(creature.x - visible.x, creature.y - visible.y) < 1.6);
  check('Inspector identity/energy/age/parent match actual organism', await b.evaluate(`document.querySelector('.specimen-name').textContent.includes('#${String(creature.id).padStart(3,'0')}')&&Number(document.querySelector('meter[aria-label="에너지"]').value)===${creature.energy}&&document.querySelector('.summary-list').textContent.includes('0 ticks')&&document.querySelector('.summary-list').textContent.includes('초기 배치')`));
  await b.click('유전자'); check('Genome tab matches real data', await b.evaluate(`document.querySelector('.genome-list').textContent.includes('${creature.genome.moveSpeed.toFixed(3)}')`));
  await b.click('신체'); check('Body tab shows actual parts', await b.evaluate(`document.querySelectorAll('.parts-list button').length===${creature.bodyParts.length}`));
  await b.click('개요'); await b.click('이 개체 추적');
  check('Follow camera centers real organism', await b.evaluate(`Math.abs(Number(document.querySelector('.world-renderer').dataset.cameraX)-${creature.x})<1e-8&&Math.abs(Number(document.querySelector('.world-renderer').dataset.cameraY)-${creature.y})<1e-8`));
  await b.click('추적 중단');
  const oldZoom = await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraZoom)`);
  await b.click('확대'); check('Camera zoom works', await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraZoom)>${oldZoom}`));
  const oldX = await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraX)`);
  await pointer('mousePressed', bounds.x + 300, bounds.y + 200, { button: 'left', clickCount: 1 });
  await pointer('mouseMoved', bounds.x + 360, bounds.y + 240, { button: 'left', buttons: 1 });
  await pointer('mouseReleased', bounds.x + 360, bounds.y + 240, { button: 'left', clickCount: 1 });
  check('Camera pan preserves selection', await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraX)!==${oldX}&&Number(document.querySelector('.world-renderer').dataset.selectedId)===${selectedId}`));
  await b.click('선택 해제');
  await b.click('다음 틱'); check('Single step advances exactly one tick', await tick() === 1);
  const first = await validateStats('After one tick');
  check('Actual organisms move', first.creatures.some((c, i) => Math.hypot(c.x - initial.creatures[i].x, c.y - initial.creatures[i].y) > 0));
  await delay(400); check('Pause freezes logical time', await tick() === 1);
  const deltas = {};
  for (const speed of [1, 2, 5, 10]) {
    await b.click(`${speed}배속`); const before = await tick();
    await b.click('재생'); await delay(1000); await b.click('일시정지');
    deltas[speed] = await tick() - before;
    check(`${speed}x playback advances time`, deltas[speed] > 0);
  }
  check('Real playback scales with speed', deltas[2] > deltas[1] * 1.3 && deltas[5] > deltas[1] * 3 && deltas[10] > deltas[1] * 6);
  await validateStats('After all playback speeds');
  await b.click('재생'); await b.waitFor(`Number(document.querySelector('[data-testid=header-tick]').textContent)>=500`); await b.click('일시정지');
  const evolved = await validateStats('Evolved world');
  check('Actual births/reproduction appear in UI and engine', evolved.statistics.totalReproductions > 0 && await b.evaluate(`!!document.querySelector('.event-reproduction')&&!!document.querySelector('.event-birth')`));
  await b.click('섭취'); check('Actual eating events appear in timeline', await b.evaluate(`!!document.querySelector('.event-eat')`));
  await b.evaluate(`document.querySelector('.event-eat').click()`); await b.waitFor(`document.querySelector('.event-detail-row')`);
  const timeBeforeEvent = await tick(); await b.evaluate(`document.querySelector('.event-detail-row').click()`);
  check('Timeline selects exact recorded organism without rewinding', await tick() === timeBeforeEvent && await b.evaluate(`!!document.querySelector('.specimen-name')&&!!document.querySelector('.event-card.selected')`));
  await validateModel('After event selection');
  await b.click('주요'); await b.screenshot('m0/desktop.png');
  for (const [width, height, name] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'mobile']]) {
    await b.viewport(width, height); await delay(350);
    check(`${name}: no page overflow`, await b.evaluate(`document.documentElement.scrollWidth<=innerWidth`));
    const transport = await rect('.transport'); check(`${name}: time controls visible`, transport.y >= 0 && transport.bottom <= height + 1);
    if (width < 768) {
      for (let i = 0; i < 3; i++) { const panel = await rect('.inspector'); check(`mobile sheet ${i + 1}: controls unobstructed`, panel.bottom <= transport.y + 1); await b.click('시트 높이 변경'); }
      await b.click('정보 패널 닫기');
      await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
      const before = await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraX)`);
      await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 180, y: 260 }] });
      await b.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 220, y: 280 }] });
      await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await delay(120);
      check('Emulated touch pans camera', await b.evaluate(`Number(document.querySelector('.world-renderer').dataset.cameraX)!==${before}`));
    }
    await b.screenshot(`m0/${name}.png`);
  }
  check('Browser has no uncaught application errors', b.errors.length === 0);
} catch (error) {
  failure = String(error); await b.screenshot('m0/browser-failure.png').catch(() => {}); throw error;
} finally {
  await writeFile(`${output}/browser-results.json`, JSON.stringify({ checkedAt: new Date().toISOString(), checks, evidence, errors: b.errors, failure }, null, 2));
  mirror.dispose(); await b.close();
}
