// Screenshot a page in a real STATE — hover, focus, selection, a menu left open — which plain
// `chrome --headless --screenshot` cannot reach, because it never sends an input event.
//
// WHY THIS EXISTS. Reviewing a hover state by reading classNames is guessing, and reading it back
// with getComputedStyle is worse than guessing, because it answers confidently and is often wrong.
// Both mistakes were made on the Library row before this existed. The rules that make browser
// measurement trustworthy, each learned by being burned:
//
//   1. Drive real input. Chrome only resolves :hover after it has seen a mouse MOVE; a screenshot
//      taken straight after navigate is always the rest state, however long you wait.
//   2. Read computed style only AFTER the transition. `transition-opacity` means a synchronous read
//      after .focus() returns the value at t=0 — which is the OLD value. A control that is about to
//      appear reads as opacity 0, and you will report the opposite of the truth.
//   3. A --patch may only use classes that already exist in the bundle. Tailwind v4 compiles what it
//      finds in source, so previewing `-left-8` when nothing in the repo says `-left-8` applies
//      NOTHING, silently. Set geometry inline, or check the class is compiled.
//   4. Read back what you applied. A patch that matched no elements returns cleanly and screenshots
//      beautifully. Every patch here ends by reporting the boxes it produced.
//   5. When the picture and the number disagree, say so and name which one you trusted. Headless
//      capture does not always hold keyboard focus through the capture, so some states are
//      measurable but not photographable.
//
// USAGE
//   node scripts/shot.mjs <url> <out.png> [--patch p.js] [--probe q.js] [action ...]
//     action:  x,y            move the mouse there (this is what produces :hover)
//              click=x,y      move, then press and release
//              key=Tab:3      press a key n times
//   --patch runs after load, before the actions.   --probe runs after the actions, before capture.
//   VW / VH set the viewport (default 1440x900); TOUCH=1 emulates a mobile device.
//
// Coordinates are CSS px.
// Drives Chrome over CDP with genuine input events, so the browser resolves :hover itself rather
// than us guessing which rules would have applied. Node 26 has a native WebSocket, so no deps.
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

// A --patch <file.js> is evaluated in the page after load and before any input. Express a patch as
// the SAME className strings the source change would use, so the browser resolves the same Tailwind
// rules and the screenshot is a faithful preview — not a mock-up of one. This is how a change can be
// seen before it is written, which matters when the file belongs to someone else.
const argv = process.argv.slice(2)
const pi = argv.indexOf('--patch')
const patchFile = pi >= 0 ? argv[pi + 1] : null
if (pi >= 0) argv.splice(pi, 2)
// --probe runs AFTER the input actions, so it can report the state a hover or a Tab produced.
// --patch runs before them, so it can change the page the actions then act on.
// --clip x,y,w,h in CSS px. Capture the region you mean rather than cropping afterwards and
// guessing whether the crop tool measures from a corner or from the centre.
const ci = argv.indexOf('--clip')
const clip = ci >= 0 ? argv[ci + 1].split(',').map(Number) : null
if (ci >= 0) argv.splice(ci, 2)
const qi = argv.indexOf('--probe')
const probeFile = qi >= 0 ? argv[qi + 1] : null
if (qi >= 0) argv.splice(qi, 2)
const [url, out, ...acts] = argv
const PORT = 9333 + (process.pid % 200)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--hide-scrollbars', `--window-size=${process.env.VW||1440},${process.env.VH||900}`, '--user-data-dir=/tmp/cdp-shot-' + PORT,
  '--no-first-run', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function targets() {
  for (let i = 0; i < 60; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { await sleep(250) }
  }
  throw new Error('chrome never came up')
}

const page = (await targets()).find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))

let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
}
const send = (method, params = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: +(process.env.VW||1440), height: +(process.env.VH||900), deviceScaleFactor: 2, mobile: process.env.TOUCH === '1' })
await send('Page.navigate', { url })
await sleep(3500)

if (patchFile) {
  const src = readFileSync(patchFile, 'utf8')
  const r = await send('Runtime.evaluate', { expression: src, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) { console.error('PATCH FAILED:', JSON.stringify(r.exceptionDetails).slice(0, 600)); process.exit(1) }
  console.log('patch:', JSON.stringify(r.result && r.result.value))
  await send('Runtime.evaluate', { expression: 'document.body.offsetHeight' }) // force a layout flush
  await sleep(400)
}

// A mouse MOVE is what puts the page in :hover. Chrome only tracks a hover target once it has seen
// a move event, so an immediate screenshot after navigate is always the rest state.
for (const act of acts) {
  const [kind, xy] = act.includes('=') ? act.split('=') : ['hover', act]
  if (kind === 'key') {
    // Tab-walk the page with real key events, so focus and :focus-visible resolve the way they do
    // for a keyboard user rather than the way a .focus() call would.
    const [name, times] = xy.split(':')
    for (let k = 0; k < Number(times || 1); k++) {
      for (const type of ['rawKeyDown', 'keyUp']) {
        await send('Input.dispatchKeyEvent', { type, key: name, code: name, windowsVirtualKeyCode: name === 'Tab' ? 9 : 13, nativeVirtualKeyCode: name === 'Tab' ? 9 : 13 })
      }
      await sleep(80)
    }
    await sleep(400)
    continue
  }
  const [x, y] = xy.split(',').map(Number)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 })
  if (kind === 'click') {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 })
  }
  await sleep(600)
}

if (probeFile) {
  const r = await send('Runtime.evaluate', { expression: readFileSync(probeFile, 'utf8'), awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) console.error('PROBE FAILED:', JSON.stringify(r.exceptionDetails).slice(0, 500))
  else console.log('probe:', JSON.stringify(r.result && r.result.value))
}

const shotOpts = { format: 'png', captureBeyondViewport: false }
if (clip) shotOpts.clip = { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 2 }
const { data } = await send('Page.captureScreenshot', shotOpts)
writeFileSync(out, Buffer.from(data, 'base64'))
console.log('wrote', out, acts.length ? `after ${acts.join(' ')}` : '(rest)')
ws.close(); chrome.kill(); process.exit(0)
