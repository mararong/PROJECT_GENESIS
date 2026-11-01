// Dependency-free QA for this local application using a dedicated headless Chrome.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function openBrowser() {
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const port = 9400 + Math.floor(Math.random() * 1000);
  const profile = resolve('tmp', `qa-chrome-${port}`);
  await mkdir(profile, { recursive: true });
  const child = spawn(chrome, ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--in-process-gpu', '--no-sandbox', '--disable-extensions', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let target;
  for (let i = 0; i < 80; i++) { try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); target = list.find(t => t.type === 'page'); if (target) break; } catch {} await delay(100); }
  if (!target) { child.kill(); throw new Error('Headless Chrome did not expose a local QA target'); }
  const socket = new WebSocket(target.webSocketDebuggerUrl), pending = new Map(), errors = []; let sequence = 0;
  socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id) { const p = pending.get(data.id); pending.delete(data.id); if (data.error) p?.reject(new Error(JSON.stringify(data.error))); else p?.resolve(data.result); } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text); else if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text); });
  await new Promise((res, rej) => { socket.addEventListener('open', res, { once: true }); socket.addEventListener('error', rej, { once: true }); });
  socket.addEventListener('close', e => { for (const p of pending.values()) p.reject(new Error(`Chrome QA connection closed: ${e.code} ${e.reason}`)); pending.clear(); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000); pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: issue => { clearTimeout(timeout); reject(issue); } }); socket.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description); return result.result.value; };
  const waitFor = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error(`Timed out: ${expression}`); };
  const click = async label => { await evaluate(`(() => {const b = [...document.querySelectorAll('button,a')].find(b => {const copy=b.cloneNode(true);copy.querySelectorAll('kbd').forEach(k=>k.remove());return b.getAttribute('aria-label') === ${JSON.stringify(label)} || copy.textContent.trim() === ${JSON.stringify(label)} || (b.getAttribute('role') === 'tab' && b.textContent.trim().startsWith(${JSON.stringify(label)}));}); if (!b || b.disabled) throw new Error('Button not available: ' + ${JSON.stringify(label)}); b.click();})()`); await delay(120); };
  const viewport = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  const navigate = async (url = 'http://127.0.0.1:5173/') => { await send('Page.navigate', { url }); await waitFor(`document.querySelector('.app-shell') !== null`); };
  const screenshot = async filename => { await delay(180); const result = await send('Page.captureScreenshot', { format: 'png' }); await mkdir(resolve('docs/qa'), { recursive: true }); await writeFile(resolve('docs/qa', filename), Buffer.from(result.data, 'base64')); };
  const close = async () => { try { await send('Browser.close'); } catch {} socket.close(); child.kill(); };
  return { send, evaluate, click, viewport, navigate, screenshot, waitFor, errors, close };
}
