window.__errs=[];window.addEventListener('error',e=>__errs.push(e.message+':'+e.lineno));
// RoboForge Lab — client: parts library, assembly, diagnostics, DSL compiler, runtime, telemetry, AI chat
'use strict';

/* ============================== PARTS LIBRARY ============================== */
const PARTS = [
  // COMPUTE
  { id: 'pi5', cat: 'compute', name: 'Raspberry Pi 5', desc: 'Main SBC · runs your program', req: true, protocols: [], volts: 5 },
  { id: 'jetson', cat: 'compute', name: 'Jetson Orin Nano', desc: 'AI compute · vision-ready', req: true, protocols: [], volts: 5 },
  { id: 'esp32', cat: 'compute', name: 'ESP32', desc: 'Compact microcontroller', req: true, protocols: [], volts: 3.3 },
  { id: 'candriver', cat: 'compute', name: 'CAN Controller', desc: 'CAN bus interface for motors', req: false, protocols: ['can'], volts: 5 },
  // ACTUATORS
  { id: 'qdd', cat: 'actuators', name: 'QDD Motor', desc: 'High-torque actuator · needs CAN', req: false, protocols: ['can'], volts: 24, torque: 20 },
  { id: 'servo', cat: 'actuators', name: 'Servo Motor', desc: 'Precise positional actuator', req: false, protocols: [], volts: 5, torque: 4 },
  { id: 'linear', cat: 'actuators', name: 'Linear Actuator', desc: 'Push/pull motion', req: false, protocols: [], volts: 12, torque: 8 },
  // STRUCTURE
  { id: 'frame', cat: 'structure', name: 'Frame Links', desc: 'Skeleton of the robot', req: true, protocols: [], volts: 0 },
  { id: 'joint', cat: 'structure', name: 'Joint Housings', desc: 'Connects limbs to motors', req: false, protocols: [], volts: 0 },
  { id: 'feet', cat: 'structure', name: 'Feet', desc: 'Ground contact · balance', req: false, protocols: [], volts: 0 },
  // POWER
  { id: 'battery', cat: 'power', name: 'Battery Pack', desc: 'Energy source · required to run', req: true, protocols: [], volts: 24 },
  { id: 'bms', cat: 'power', name: 'BMS', desc: 'Protects and monitors the battery', req: false, protocols: [], volts: 0 },
  { id: 'regulator', cat: 'power', name: 'Voltage Regulator', desc: 'Feeds safe voltage to boards', req: false, protocols: [], volts: 0 },
  { id: 'estop', cat: 'power', name: 'E-Stop Switch', desc: 'Cuts power instantly', req: false, protocols: [], volts: 0 },
  // SENSORS
  { id: 'imu', cat: 'sensors', name: 'IMU', desc: 'Tilt + orientation sensing', req: false, protocols: [], volts: 3.3 },
  { id: 'encoder', cat: 'sensors', name: 'Joint Encoder', desc: 'Measures joint angles', req: false, protocols: [], volts: 5 },
  { id: 'lidar', cat: 'sensors', name: 'LiDAR', desc: 'Distance to obstacles', req: false, protocols: [], volts: 5 },
  { id: 'camera', cat: 'sensors', name: 'Camera', desc: 'Vision · pairs with Jetson', req: false, protocols: [], volts: 5 },
  { id: 'tempsensor', cat: 'sensors', name: 'Temperature Sensor', desc: 'Monitors heat', req: false, protocols: [], volts: 3.3 },
  // END EFFECTORS
  { id: 'gripper', cat: 'effectors', name: 'Gripper', desc: 'Picks up objects', req: false, protocols: [], volts: 12 },
  { id: 'suction', cat: 'effectors', name: 'Suction Attachment', desc: 'Magnetic/suction pickup', req: false, protocols: [], volts: 12 },
];

const CATS = [
  ['all', 'ALL'], ['compute', 'COMPUTE'], ['actuators', 'ACTUATORS'], ['structure', 'STRUCTURE'],
  ['power', 'POWER'], ['sensors', 'SENSORS'], ['effectors', 'EFFECTORS'],
];

/* ============================== STATE / WORKSPACES ============================== */
const WORKSPACES_KEY = 'roboforge.workspaces.v1';
let workspaces = load();
let activeWs = 0;

function defaultWorkspace(name) {
  return { name, parts: [], power: 'off', running: false, estopped: false, program: '', telemetry: {}, aiPersona: 'atlas' };
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(WORKSPACES_KEY));
    if (Array.isArray(d) && d.length) return d;
  } catch {}
  return [defaultWorkspace('ExplorerBot'), defaultWorkspace('HelperBot')];
}
function save() { localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces)); }
const ws = () => workspaces[activeWs];
const has = (id) => ws().parts.includes(id);
const partById = (id) => PARTS.find(p => p.id === id);

/* ============================== DIAGNOSTICS & COMPATIBILITY ============================== */
function diagnose() {
  const d = [];
  const hasCompute = has('pi5') || has('jetson') || has('esp32');
  d.push(hasCompute ? ['ok', (partById(ws().parts.find(p => ['pi5','jetson','esp32'].includes(p))) || {}).name || 'Main Controller', 'CONNECTED'] : ['bad', 'Main Controller', 'MISSING']);
  d.push(has('battery') ? ['ok', 'Battery', 'CONNECTED'] : ['bad', 'Battery', 'MISSING']);
  d.push(has('frame') ? ['ok', 'Frame', 'CONNECTED'] : ['bad', 'Frame', 'MISSING']);
  const motors = ws().parts.filter(p => ['qdd','servo','linear'].includes(p));
  if (motors.includes('qdd')) {
    d.push(has('candriver') ? ['ok', 'CAN Controller', 'CONNECTED'] : ['bad', 'CAN Controller', 'REQUIRED BY QDD MOTOR']);
  }
  if (motors.length) d.push(has('regulator') ? ['ok', 'Voltage Regulator', 'CONNECTED'] : ['warn', 'Voltage Regulator', 'RECOMMENDED']);
  if (has('battery') && !has('bms')) d.push(['warn', 'BMS', 'RECOMMENDED FOR SAFETY']);
  const incompat = [];
  for (const id of ws().parts) {
    const p = partById(id);
    if (p?.protocols.includes('can') && id !== 'candriver' && !has('candriver')) incompat.push(p.name + ' needs CAN');
  }
  if (has('camera') && !has('jetson')) incompat.push('Camera needs Jetson for vision');
  if (incompat.length) d.push(['bad', 'COMPATIBILITY', incompat.join(' · ')]);
  const complete = !d.some(x => x[0] === 'bad');
  return { rows: d, complete };
}

/* ============================== ROBOFORGE DSL: PARSER + COMPILER ============================== */
/* Grammar:
   WHEN START ... END            main program block
   IF <SENSOR> <OP> <VALUE> ... (nested END or inline action)
   SET MOTORS ON|OFF | STOP | MOVE FORWARD|BACK|LEFT|RIGHT [SPEED n] [TIME n]
   TURN LEFT|RIGHT | WAIT n | SAY "text" | RESTART
*/
function compile(src) {
  const lines = (src || '').split('\n').map(l => l.replace(/--.*$/, '').trim()).filter(Boolean);
  const prog = [];
  const stack = [{ type: 'root' }];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]; const U = ln.toUpperCase();
    const cur = () => stack[stack.length - 1];
    if (U === 'WHEN START') {
      if (stack.length > 1) return { err: `Line ${i + 1}: WHEN START inside another block` };
      stack.push({ type: 'when-start', body: [] }); continue;
    }
    if (U === 'END') {
      if (stack.length < 2) return { err: `Line ${i + 1}: END without a block` };
      const closed = stack.pop();
      if (closed.type === 'when-start') prog.push({ op: 'when-start', body: closed.body });
      continue;
    }
    let m;
    if ((m = /^IF\s+(IMU(?:\s+TILT)?|DISTANCE|BATTERY|TEMPERATURE|OBSTACLE)\s*(=|<|>|<=|>=)\s*([0-9.]+|TRUE|FALSE)$/i.exec(ln))) {
      const sensor = m[1].toLowerCase().replace(/\s+tilt$/, '');
      stack.push({ type: 'if', sensor, op: m[2], value: m[3].toLowerCase() === 'true' ? true : m[3].toLowerCase() === 'false' ? false : parseFloat(m[3]), body: [], line: i + 1 });
      continue;
    }
    if ((m = /^IF\s+(OBSTACLE)$/i.exec(ln))) {
      stack.push({ type: 'if', sensor: 'obstacle', op: '=', value: true, body: [], line: i + 1 });
      continue;
    }
    if (U === 'ELSE') {
      if (cur().type !== 'if') return { err: `Line ${i + 1}: ELSE without IF` };
      cur().inElse = true; cur().elseBody = []; continue;
    }
    const target = () => { const c = cur(); const arr = c.inElse ? (c.elseBody) : (c.body); return arr || null; };
    if ((m = /^SET\s+MOTORS\s+(ON|OFF)$/i.exec(ln))) { const a = { op: 'motors', on: m[1].toUpperCase() === 'ON' }; target()?.push(a) || prog.push(a); continue; }
    if (/^STOP(\s+MOTORS)?$/i.test(ln)) { const a = { op: 'stop' }; target()?.push(a) || prog.push(a); continue; }
    if ((m = /^MOVE\s+(FORWARD|BACK|LEFT|RIGHT)(?:\s+SPEED\s+([0-9.]+))?(?:\s+TIME\s+([0-9.]+))?$/i.exec(ln))) {
      const a = { op: 'move', dir: m[1].toLowerCase(), speed: m[2] ? Math.min(100, parseFloat(m[2])) : 50, time: m[3] ? parseFloat(m[3]) : 1 };
      target()?.push(a) || prog.push(a); continue;
    }
    if ((m = /^TURN\s+(LEFT|RIGHT)$/i.exec(ln))) { const a = { op: 'turn', dir: m[1].toLowerCase() }; target()?.push(a) || prog.push(a); continue; }
    if ((m = /^WAIT\s+([0-9.]+)$/i.exec(ln))) { const a = { op: 'wait', time: parseFloat(m[1]) }; target()?.push(a) || prog.push(a); continue; }
    if ((m = /^SAY\s+"(.*)"$/i.exec(ln))) { const a = { op: 'say', text: m[1] }; target()?.push(a) || prog.push(a); continue; }
    if (U === 'RESTART') { const a = { op: 'restart' }; target()?.push(a) || prog.push(a); continue; }
    return { err: `Line ${i + 1}: unknown command "${ln}"` };
  }
  if (stack.length > 1) return { err: `Missing END for ${stack[stack.length - 1].type}` };
  const whenStart = prog.find(a => a.op === 'when-start');
  if (!whenStart) return { err: 'Program must start with WHEN START' };
  return { prog: whenStart.body };
}

/* ============================== RUNTIME ============================== */
let runtime = null;
const TELEMETRY_BASE = { imu: 0, distance: 250, battery: 100, temperature: 30, jointSpeed: 0 };

function startRun() {
  const diag = diagnose();
  if (!diag.complete) { toast('BUILD INCOMPLETE — check diagnostics', true); return; }
  const compiled = compile(ws().program);
  if (compiled.err) { compileStatus.className = 'err'; compileStatus.textContent = compiled.err; toast(compiled.err, true); return; }
  if (has('estop') && ws().estopped) ws().estopped = false;
  ws().running = true;
  runtime = {
    prog: compiled.prog, pc: 0, waitUntil: 0, actionUntil: 0, current: null,
    telemetry: { ...TELEMETRY_BASE, battery: has('battery') ? 100 : 0 },
    loops: 0,
  };
  renderPowerState();
  toast('ROBOT RUNNING');
}

function stopRun(estop = false) {
  ws().running = false;
  if (estop) ws().estopped = true;
  runtime = null;
  renderPowerState();
  if (estop) toast('EMERGENCY STOP — power cut', true); else toast('robot stopped');
}

function stepRuntime(dt) {
  if (!ws().running || !runtime) return;
  const t = runtime.telemetry;
  // battery drain depends on motors + sensors
  const motorCount = ws().parts.filter(p => ['qdd','servo','linear'].includes(p)).length;
  let drain = 0.02 + motorCount * 0.05;
  if (runtime.current) drain += 0.4 * (runtime.current.speed || 50) / 100;
  t.battery = Math.max(0, t.battery - drain * dt);
  if (t.battery <= 0) { stopRun(); toast('BATTERY DEPLETED', true); return; }
  if (has('tempsensor') && runtime.current) t.temperature = Math.min(85, t.temperature + dt * 1.5);
  else t.temperature = Math.max(30, t.temperature - dt * 0.5);

  // current timed action (move/turn/wait)
  const now = performance.now();
  if (runtime.current) {
    if (runtime.current.op === 'move') {
      const s = runtime.current.speed / 100;
      const dir = runtime.current.dir;
      if (dir === 'forward') t.distance = Math.max(8, t.distance - dt * 60 * s);
      else if (dir === 'back') t.distance = Math.min(400, t.distance + dt * 40 * s);
      t.jointSpeed = s * 30;
      t.imu = clamp(t.imu + (dir === 'left' || dir === 'right' ? dt * 6 : 0), -12, 12);
    } else if (runtime.current.op === 'turn') {
      t.imu = clamp(t.imu + dt * (runtime.current.dir === 'left' ? 20 : -20), -180, 180);
      t.jointSpeed = 12;
    } else { t.jointSpeed = 0; }
    if (now >= runtime.actionUntil) runtime.current = null;
    return;
  }
  if (now < runtime.waitUntil) return;

  // execute next instruction
  const a = runtime.prog[runtime.pc];
  if (!a) { // loop program
    runtime.pc = 0; runtime.loops++;
    if (runtime.loops > 200) { stopRun(); return; }
    return;
  }
  runtime.pc++;
  exec(a);
}

function exec(a) {
  const t = runtime.telemetry;
  switch (a.op) {
    case 'motors': t.jointSpeed = a.on ? 5 : 0; break;
    case 'stop': t.jointSpeed = 0; break;
    case 'move': runtime.current = a; runtime.actionUntil = performance.now() + a.time * 1000; break;
    case 'turn': runtime.current = a; runtime.actionUntil = performance.now() + 800; break;
    case 'wait': runtime.waitUntil = performance.now() + a.time * 1000; break;
    case 'say': toast('🤖 ' + a.text); break;
    case 'restart': runtime.pc = 0; break;
    default: break;
  }
}

function evalIf(a) {
  const t = runtime.telemetry;
  let left;
  if (a.sensor === 'obstacle') left = t.distance < 40;
  else if (a.sensor === 'imu') left = Math.abs(t.imu);
  else left = t[a.sensor] ?? 0;
  const v = a.value;
  switch (a.op) {
    case '=': return left === v; case '<': return left < v; case '>': return left > v;
    case '<=': return left <= v; case '>=': return left >= v; default: return false;
  }
}

// runtime executor handles IF blocks with body/elseBody
function execStep() {
  if (!runtime) return;
  const a = runtime.prog[runtime.pc];
  if (!a) { runtime.pc = 0; runtime.loops++; if (runtime.loops > 200) stopRun(); return; }
  runtime.pc++;
  if (a.type === 'if' || a.sensor !== undefined) {
    const branch = evalIf(a) ? (a.body || []) : (a.elseBody || []);
    for (const b of branch) exec(b);
  } else exec(a);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ============================== RENDERING ============================== */
const $ = (s) => document.querySelector(s);
function renderLibrary() {
  const active = document.querySelector('#libTabs button.active')?.dataset.cat || 'all';
  $('#libTabs').innerHTML = CATS.map(([id, label]) => `<button data-cat="${id}" class="${id === active ? 'active' : ''}">${label}</button>`).join('');
  const list = PARTS.filter(p => active === 'all' || p.cat === active);
  $('#libList').innerHTML = list.map(p => `
    <div class="part" data-id="${p.id}">
      <div class="p-name">${p.name}${has(p.id) ? ' ✓' : ''}</div>
      <div class="p-cat">${p.cat.toUpperCase()}</div>
      <div class="p-desc">${p.desc}</div>
    </div>`).join('');
  document.querySelectorAll('#libTabs button').forEach(b => b.onclick = () => { document.querySelectorAll('#libTabs button').forEach(x => x.classList.remove('active')); b.classList.add('active'); renderLibrary(); });
  document.querySelectorAll('#libList .part').forEach(el => el.onclick = () => addPart(el.dataset.id));
}
function addPart(id) {
  if (has(id)) return toast('already installed — remove it first', true);
  ws().parts.push(id); save();
  renderAll();
}
function removePart(id) {
  ws().parts = ws().parts.filter(p => p !== id); save();
  renderAll();
}
function renderBuild() {
  $('#buildList').innerHTML = ws().parts.map(id => {
    const p = partById(id);
    return `<div class="bpart ${p.cat === 'power' ? 'power' : p.cat === 'compute' ? 'core' : ''}">${p.name}<button class="rm" data-id="${id}" title="Remove">✕</button></div>`;
  }).join('') || '<p style="color:var(--dim);font-size:12px">Click parts on the left to assemble your robot.</p>';
  document.querySelectorAll('#buildList .rm').forEach(b => b.onclick = (e) => { e.stopPropagation(); removePart(b.dataset.id); });
}
function renderDiagnostics() {
  const diag = diagnose();
  $('#diagnostics').innerHTML = diag.rows.map(([lvl, name, msg]) =>
    `<div class="drow"><span class="${lvl}">${lvl === 'ok' ? '✓' : lvl === 'warn' ? '!' : '✖'}</span><b>${name}</b><span style="color:var(--dim)">${msg}</span></div>`).join('');
  const chip = $('#buildStatus');
  chip.textContent = diag.complete ? 'BUILD READY' : 'BUILD INCOMPLETE';
  chip.classList.toggle('ready', diag.complete);
  $('#btnRun').disabled = !diag.complete;
}
function renderTelemetry() {
  const t = runtime?.telemetry || TELEMETRY_BASE;
  const rows = [
    ['IMU TILT', (t.imu ?? 0).toFixed(1) + '°'],
    ['DISTANCE', Math.round(t.distance ?? 0) + ' cm'],
    ['BATTERY', Math.round(t.battery ?? 100) + '%'],
    ['TEMPERATURE', Math.round(t.temperature ?? 30) + ' °C'],
    ['JOINT SPEED', (t.jointSpeed ?? 0).toFixed(1) + ' °/s'],
    ['POWER', ws().running ? 'RUNNING' : ws().estopped ? 'E-STOPPED' : 'OFF'],
  ];
  $('#telemetry').innerHTML = rows.map(([k, v]) => `<div class="trow"><b>${k}</b><span>${v}</span></div>`).join('');
}
function renderPowerState() {
  const rv = $('#robotView');
  rv.classList.toggle('running', !!ws().running);
  rv.classList.toggle('estopped', !!ws().estopped && !ws().running);
  $('#btnRun').textContent = ws().running ? '▶ RUNNING…' : '▶ RUN ROBOT';
}
function renderWorkspaces() {
  $('#workspaceTabs').innerHTML = workspaces.map((w, i) => `<button class="${i === activeWs ? 'active' : ''}" data-i="${i}">${w.name}</button>`).join('');
  document.querySelectorAll('#workspaceTabs button').forEach(b => b.onclick = () => {
    activeWs = +b.dataset.i;
    $('#program').value = ws().program || '';
    renderAll();
  });
}
function renderPersonas() {
  const list = [['atlas', '🛰 Atlas'], ['nova', '🚀 Nova'], ['sentinel', '🛡 Sentinel'], ['pixel', '🎮 Pixel']];
  $('#personas').innerHTML = list.map(([id, label]) => `<button data-p="${id}" class="${ws().aiPersona === id ? 'active' : ''}">${label}</button>`).join('');
  document.querySelectorAll('#personas button').forEach(b => b.onclick = () => { ws().aiPersona = b.dataset.p; save(); renderPersonas(); });
}
function renderAll() { renderLibrary(); renderBuild(); renderDiagnostics(); renderTelemetry(); renderPowerState(); renderWorkspaces(); renderPersonas(); }

/* ============================== AI CHAT ============================== */
const chatLog = [];
let voiceOn = true;
let talkAbort = false;
const BRAIN_LABEL = { atlas: '🧠 deep-core', nova: '🧠 qwen-core', sentinel: '🧠 fast-core', pixel: '🧠 gemini-core' };

function speak(text, persona) {
  if (!voiceOn || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[🤖🎙🚀🛰🛡🎮⚡]/gu, ''));
    const voices = speechSynthesis.getVoices();
    // each persona picks a distinct voice so you can tell who is talking
    const want = persona?.voiceHint;
    u.voice = voices.find(v => want && want.test(v.name)) || voices.find(v => v.lang.startsWith('en')) || null;
    u.pitch = persona?.pitch ?? 1;
    u.rate = persona?.rate ?? 1;
    speechSynthesis.speak(u);
  } catch {}
}

async function sendChat() {
  const box = $('#chatBox');
  const text = box.value.trim();
  if (!text) return;
  box.value = '';
  chatLog.push({ role: 'user', content: text });
  const um = addMsg('user', text);
  const persona = PERSONAS_CLIENT[ws().aiPersona];
  const thinking = addMsg('ai', `${persona.name} is thinking…`, persona);
  try {
    const state = { parts: ws().parts.map(id => partById(id).name), power: ws().running ? 'running' : 'off', telemetry: runtime?.telemetry || null };
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: chatLog.slice(-10), personality: ws().aiPersona, robotState: state }) });
    const d = await r.json();
    const answer = d.answer || '⚠️ AI unavailable right now — try again in a moment.';
    chatLog.push({ role: 'assistant', content: answer });
    renderAiMsg(thinking, answer, d.brain, persona);
  } catch (e) {
    renderAiMsg(thinking, 'Connection problem — try again.', null, persona);
  }
}

function addMsg(role, text, persona) {
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  if (role === 'ai' && persona) {
    const who = document.createElement('strong');
    who.textContent = persona.name + ' ';
    el.appendChild(who);
  }
  el.appendChild(document.createTextNode(text));
  $('#chatLog').appendChild(el);
  $('#chatLog').scrollTop = 1e6;
  return el;
}

function renderAiMsg(el, text, brain, persona) {
  el.textContent = '';
  if (persona) { const who = document.createElement('strong'); who.textContent = persona.name + ' '; el.appendChild(who); }
  const html = text.replace(/```(?:roboforge)?\n([\s\S]*?)```/g, (m, code) => `\n${code}\n`);
  const parts = html.split(/\n/);
  let inCode = false;
  for (const part of parts) {
    if (part.trim() === '') continue;
    const isCode = /^\s{4}|^(WHEN|IF|SET|MOVE|TURN|WAIT|SAY|STOP|RESTART|END)/.test(part.trim());
    if (isCode) {
      const pre = document.createElement('pre');
      pre.textContent = part; el.appendChild(pre);
    } else {
      el.appendChild(document.createTextNode(part + ' '));
    }
  }
  if (brain) { const tag = document.createElement('span'); tag.className = 'brain-tag'; tag.textContent = brain; el.appendChild(tag); }
  // speak it + a replay button so you can hear any message again
  speak(text.replace(/```[\s\S]*?```/g, ' ').replace(/\n/g, ' '), persona);
  if ('speechSynthesis' in window) {
    const sp = document.createElement('button'); sp.className = 'speak-btn'; sp.textContent = '🔊'; sp.title = 'Play voice';
    sp.onclick = () => speak(text.replace(/```[\s\S]*?```/g, ' ').replace(/\n/g, ' '), persona);
    el.appendChild(sp);
  }
  const pre = el.querySelector('pre');
  if (pre) {
    const btn = document.createElement('button');
    btn.className = 'btn'; btn.textContent = '⬇ LOAD INTO EDITOR';
    btn.onclick = () => { $('#program').value = pre.textContent; compileEditor(); };
    el.appendChild(document.createElement('br')); el.appendChild(btn);
  }
  $('#chatLog').scrollTop = 1e6;
}

/* ---------- TEAM TALK: two personas discuss, each hears the other, you hear both ---------- */
async function startTalk() {
  const a = $('#talkA').value, b = $('#talkB').value;
  const topic = $('#talkTopic').value.trim() || 'How should we improve this robot?';
  if (a === b) return toast('pick two different robots to talk', true);
  talkAbort = false;
  $('#talkStart').style.display = 'none'; $('#talkStop').style.display = '';
  const state = { parts: ws().parts.map(id => partById(id).name), power: ws().running ? 'running' : 'off' };
  addMsg('system-note', `🎙 ${PERSONAS_CLIENT[a].name} and ${PERSONAS_CLIENT[b].name} are discussing: “${topic}”`);
  let turn = 0;
  while (!talkAbort && turn < 6) {
    try {
      const r = await fetch('/api/roundtable', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personaA: a, personaB: b, topic: turn === 0 ? topic : `Continue your discussion about: ${topic}`, turns: 2, robotState: state }) });
      const d = await r.json();
      if (!d.lines) { addMsg('ai', '⚠️ ' + (d.hint || 'AI unavailable right now.')); break; }
      for (const line of d.lines) {
        if (talkAbort) break;
        const persona = PERSONAS_CLIENT[line.persona] || PERSONAS_CLIENT[a];
        const el = addMsg('ai', '', persona);
        renderAiMsg(el, line.text, line.brain, persona);
        await new Promise(res => setTimeout(res, 1600)); // let the voice finish a beat
      }
    } catch (e) { addMsg('ai', 'Connection problem — conversation paused.'); break; }
    turn += 2;
  }
  $('#talkStart').style.display = ''; $('#talkStop').style.display = 'none';
}

const PERSONAS_CLIENT = {
  atlas:    { name: 'Atlas',    voiceHint: /Google UK English Male|Daniel|male/i, pitch: 0.9,  rate: 0.95 },
  nova:     { name: 'Nova',     voiceHint: /Google UK English Female|Samantha|female|Zira/i, pitch: 1.25, rate: 1.05 },
  sentinel: { name: 'Sentinel', voiceHint: /Google US English|male/i, pitch: 0.7,  rate: 0.9 },
  pixel:    { name: 'Pixel',    voiceHint: /Google UK English Female|female|Zira/i, pitch: 1.45, rate: 1.1 },
};

/* ============================== MISC ============================== */
function compileEditor() {
  const compiled = compile($('#program').value);
  const st = $('#compileStatus');
  if (compiled.err) { st.className = 'err'; st.textContent = '✖ ' + compiled.err; return false; }
  st.className = 'ok'; st.textContent = '✓ PROGRAM VALID — ' + compiled.prog.length + ' instructions';
  ws().program = $('#program').value; save();
  return true;
}
let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = err ? 'err show' : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 2600);
}

/* boot */
$('#program').value = ws().program || '';
$('#program').addEventListener('input', () => { ws().program = $('#program').value; save(); });
$('#btnCompile').onclick = compileEditor;
$('#btnRun').onclick = () => { if (compileEditor()) startRun(); };
$('#btnStop').onclick = () => stopRun(false);
$('#btnEstop').onclick = () => stopRun(true);
$('#chatSend').onclick = sendChat;
$('#chatBox').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
// team talk wiring
$('#modeChat').onclick = () => { $('#modeChat').classList.add('active'); $('#modeTalk').classList.remove('active'); $('#talkPick').style.display = 'none'; };
$('#modeTalk').onclick = () => { $('#modeTalk').classList.add('active'); $('#modeChat').classList.remove('active'); $('#talkPick').style.display = 'flex'; };
$('#btnMute').onclick = () => { voiceOn = !voiceOn; if (!voiceOn) try { speechSynthesis.cancel(); } catch {} $('#btnMute').textContent = voiceOn ? '🔊 VOICE ON' : '🔇 VOICE OFF'; $('#btnMute').classList.toggle('active', voiceOn); };
for (const sel of ['#talkA', '#talkB']) {
  $(sel).innerHTML = Object.entries(PERSONAS_CLIENT).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('');
}
$('#talkA').value = 'atlas'; $('#talkB').value = 'nova';
$('#talkStart').onclick = startTalk;
$('#talkStop').onclick = () => { talkAbort = true; try { speechSynthesis.cancel(); } catch {} };
renderAll();

// 20 Hz loop
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  stepRuntime(dt);
  if (ws().running && runtime && !runtime.current && now >= runtime.waitUntil) execStep();
  if (ws().running) renderTelemetry();
}, 50);
