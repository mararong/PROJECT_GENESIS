import assert from 'node:assert/strict';
import { openBrowser } from './browser.mjs';
const b = await openBrowser();
try {
  await b.viewport(1440, 900); await b.navigate();
  await b.waitFor(`document.querySelector('.landing')`);
  await b.screenshot('p1-desktop-start.png');
  await b.click('새로운 세계 만들기');
  if (await b.evaluate(`document.body.textContent.includes('관측소 미리보기')`)) await b.click('관측소 미리보기');
  else { await b.click('다음'); await b.click('다음'); await b.click('세계 생성'); }
  await b.screenshot('p1-desktop.png');
  assert.equal(await b.evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  await b.viewport(390, 844); await b.screenshot('p1-mobile.png');
  assert.equal(await b.evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  assert.equal(await b.evaluate(`document.querySelector('.transport').getBoundingClientRect().bottom <= innerHeight`), true);
  assert.deepEqual(b.errors, []);
  console.log('P1: desktop 1440×900 / mobile 390×844 skeleton and control visibility passed.');
} finally { await b.close(); }
