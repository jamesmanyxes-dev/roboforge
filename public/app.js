// RoboForge Lab — HUD client. Engine: parts, diagnostics, RoboForge DSL compiler, runtime, Team Talk AI.
'use strict';
window.__errs = []; window.addEventListener('error', e => __errs.push(e.message + ':' + e.lineno));

/* ============================== PARTS ============================== */
const PARTS = [
  { id: 'pi5',      cat: 'compute',  name: 'Raspberry Pi 5',      desc: 'Main SBC · runs your program', specs: ['5V', '2A'],        cost: 80,  kg: 0.1, protocols: [] },
  { id: 'jetson',   cat: 'compute',  name: 'Jetson Orin Nano',    desc: 'AI compute · vision-ready',    specs: ['5V', '15W'],       cost: 250, kg: 0.2, protocols: [] },
  { id: 'esp32',    cat: 'compute',  name: 'ESP32',               desc: 'Compact microcontroller',      specs: ['3.3V', '0.5A'],    cost: 10,  kg: 0.02, protocols: [] },
  { id: 'candriver',cat: 'compute',  name: 'CAN Controller',      desc: 'CAN bus interface',            specs: ['CAN', '5V'],       cost: 25,  kg: 0.05, protocols: ['can'] },
  { id: 'qdd',      cat: 'actuators',name: 'QDD Motor (Unitree)', desc: 'High-torque actuator',         specs: ['24V', '180 Nm', '1.2 kg', 'CAN', '12mm shaft'], cost: 900, kg: 1.2, protocols: ['can'], joint: 'arms' },
  { id: 'servo',    cat: 'actuators',name: 'Servo Motor (Dynamixel)', desc: 'Precise positional actuator', specs: ['12V', '15 Nm', 'PWM'], cost: 60, kg: 0.25, protocols: [], joint: 'arms' },
  { id: 'linear',   cat: 'actuators',name: 'Linear Actuator',     desc: 'Push/pull motion',             specs: ['24V', '500N', 'CAN'], cost: 120, kg: 1.1, protocols: ['can'], joint: 'legs' },
  { id: 'gearbox',  cat: 'actuators',name: 'Gearbox (Harmonic)',  desc: 'Torque multiplier',            specs: ['100 Nm', '0.6 kg', '12mm shaft'], cost: 180, kg: 0.6, protocols: [] },
  { id: 'bearing',  cat: 'structure',name: 'Joint Bearing',       desc: 'Smooth joint rotation',        specs: ['0.2 kg'],          cost: 12,  kg: 0.2, protocols: [] },
  { id: 'frame',    cat: 'structure',name: 'Frame Links',         desc: 'Skeleton of the robot',        specs: ['torso + legs'],    cost: 90,  kg: 2.0, protocols: [], fills: ['torso', 'legL', 'legR'] },
  { id: 'feet',     cat: 'structure',name: 'Feet',                desc: 'Ground contact · balance',     specs: ['rubber'],          cost: 20,  kg: 0.4, protocols: [], fills: ['legL', 'legR'] },
  { id: 'battery',  cat: 'power',    name: 'Battery Pack',        desc: 'Energy source · required',     specs: ['24V', '10A'],      cost: 150, kg: 1.8, protocols: [], fills: ['torso'] },
  { id: 'bms',      cat: 'power',    name: 'BMS',                 desc: 'Protects the battery',         specs: ['24V'],             cost: 35,  kg: 0.1, protocols: [] },
  { id: 'regulator',cat: 'power',    name: 'Voltage Regulator',   desc: 'Safe voltage for boards',      specs: ['24V → 5V'],        cost: 18,  kg: 0.05, protocols: [] },
  { id: 'estop',    cat: 'power',    name: 'E-Stop Switch',       desc: 'Cuts power instantly',         specs: ['safety'],          cost: 15,  kg: 0.05, protocols: [] },
  { id: 'imu',      cat: 'sensors',  name: 'IMU',                 desc: 'Tilt + orientation',           specs: ['0.02 g', 'I2C'],   cost: 22,  kg: 0.02, protocols: [], callout: 'co-imu' },
  { id: 'encoder',  cat: 'sensors',  name: 'Joint Encoder',       desc: 'Measures joint angles',        specs: ['12-bit'],          cost: 30,  kg: 0.03, protocols: [] },
  { id: 'lidar',    cat: 'sensors',  name: 'LiDAR',               desc: 'Distance to obstacles',        specs: ['12m', 'scanning'], cost: 110, kg: 0.15, protocols: [], callout: 'co-lidar' },
  { id: 'camera',   cat: 'sensors',  name: 'Camera',              desc: 'Vision · needs Jetson',        specs: ['1080p'],           cost: 45,  kg: 0.05, protocols: [], callout: 'co-camera', needs: 'jetson' },
  { id: 'tempsensor',cat: 'sensors', name: 'Temperature Sensor',  desc: 'Monitors heat',                specs: ['I2C'],             cost: 8,   kg: 0.01, protocols: [] },
  { id: 'gripper',  cat: 'effectors',name: 'Gripper',             desc: 'Picks up objects',             specs: ['12V', 'PWM'],      cost: 85,  kg: 0.5, protocols: [], joint: 'arms', callout: 'co-grip' },
  { id: 'suction',  cat: 'effectors',name: 'Suction Attachment',  desc: 'Magnetic/suction pickup',      specs: ['12V'],             cost: 55,  kg: 0.3, protocols: [], joint: 'arms' },
];
const CATS = [
  ['all', '🧩', 'All Parts'], ['compute', '🧠', 'Compute & Brain'], ['actuators', '⚙️', 'Actuators (Joints)'],
  ['structure', '🦴', 'Structure'], ['power', '🔋', 'Power'], ['sensors', '📡', 'Sensors'], ['effectors', '🦾', 'End Effectors'],
];

/* ============================== STATE ============================== */
const WORKSPACES_KEY = 'roboforge.workspaces.v1';
let workspaces = load();
let activeWs = 0;
function defaultWorkspace(name) { return { name, parts: [], running: false, estopped: false, program: `WHEN START\n  MOVE FORWARD SPEED 60 TIME 3\n  IF OBSTACLE\n    STOP\n  END\n  SAY "hello"\nEND` }; }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(WORKSPACES_KEY));
    if (Array.isArray(d) && d.length) return d.map((w, i) => Object.assign(defaultWorkspace(w.name || `Bot ${i + 1}`), w));
  } catch {}
  return [defaultWorkspace('Main Bot'), defaultWorkspace('Helper Bot')];
}
function save() { localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces)); }
const ws = () => workspaces[activeWs];
const other = () => workspaces[1 - activeWs];
const has = (id) => ws().parts.includes(id);
const has2 = (id) => other().parts.includes(id);
const partById = (id) => PARTS.find(p => p.id === id);

/* ============================== DIAGNOSTICS ============================== */
function diagnose() {
  const hints = [];
  const hasCompute = has('pi5') || has('jetson') || has('esp32');
  if (!hasCompute) hints.push(['bad', 'Incorrect part', 'No main controller. Install a Raspberry Pi 5, Jetson, or ESP32.']);
  if (!has('battery')) hints.push(['bad', 'Power system', 'No battery installed — the robot cannot power on.']);
  if (!has('frame')) hints.push(['bad', 'Structure', 'No frame links — add the skeleton first.']);
  if (has('qdd') && !has('candriver')) hints.push(['bad', 'Incorrect part', 'The QDD motor requires a CAN controller. Install one or pick servo motors instead.']);
  if (has('camera') && !has('jetson')) hints.push(['warn', 'Hint', 'The camera needs a Jetson for vision processing.']);
  if (has('battery') && !has('bms')) hints.push(['warn', 'Hint', 'Add a BMS to protect the battery pack.']);
  if (has('battery') && !has('regulator')) hints.push(['warn', 'Hint', 'Add a voltage regulator — 24V would damage 5V boards.']);
  if (has('linear') && !has('candriver')) hints.push(['bad', 'Incorrect part', 'The linear actuator speaks CAN — install a CAN controller.']);
  if (!hints.some(h => h[0] === 'bad') && hints.length) hints.push(['warn', 'Hint', 'Consider a foot force sensor to improve balance and walking stability.']);
  if (!hints.some(h => h[0] !== 'ok')) hints.push(['ok', 'Correct!', 'All required parts are installed. Ready for calibration.']);
  const complete = !hints.some(h => h[0] === 'bad');
  return { hints, complete };
}
function stats(list) {
  let kg = 0, cost = 0, volts = new Set(), amps = 0;
  for (const id of list) { const p = partById(id); if (!p) continue; kg += p.kg; cost += p.cost; }
  const hasBat = list.includes('battery');
  const motors = list.filter(id => ['qdd','servo','linear'].includes(id)).length;
  return { kg: kg.toFixed(1), cost: '$' + cost.toLocaleString(), power: hasBat ? `24V / ${Math.max(10, motors * 2 + 2)}A` : '—' };
}

/* ============================== ROBOFORGE DSL ============================== */
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
    if ((m = /^IF\s+(OBSTACLE)$/i.exec(ln))) { stack.push({ type: 'if', sensor: 'obstacle', op: '=', value: true, body: [], line: i + 1 }); continue; }
    if (U === 'ELSE') {
      if (cur().type !== 'if') return { err: `Line ${i + 1}: ELSE without IF` };
      cur().inElse = true; cur().elseBody = []; continue;
    }
    const target = () => { const c = cur(); return c.inElse ? c.elseBody : c.body; };
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
const TELEMETRY_BASE = { imu: 0, distance: 250, battery: 100, temperature: 30, jointSpeed: 0, cameraObjects: 0 };
let lastCompiled = null;

function startRun() {
  const diag = diagnose();
  if (!diag.complete) { toast('BUILD INCOMPLETE — check the Error/Hint panel', true); return; }
  const compiled = compile(ws().program);
  if (compiled.err) { setCompileStatus(false, compiled.err); toast(compiled.err, true); return; }
  if (ws().estopped) ws().estopped = false;
  ws().running = true;
  runtime = { prog: compiled.prog, pc: 0, waitUntil: 0, actionUntil: 0, current: null, telemetry: { ...TELEMETRY_BASE, battery: 100, cameraObjects: has('camera') ? 3 : 0 }, loops: 0 };
  renderPowerState(); renderConn();
  toast('ROBOT RUNNING');
}
function stopRun(estop = false) {
  ws().running = false; if (estop) ws().estopped = true;
  runtime = null; renderPowerState(); renderConn();
  if (estop) toast('EMERGENCY STOP — power cut', true); else toast('robot stopped');
}
function stepRuntime(dt) {
  if (!ws().running || !runtime) return;
  const t = runtime.telemetry;
  const motorCount = ws().parts.filter(p => ['qdd','servo','linear'].includes(p)).length;
  let drain = 0.02 + motorCount * 0.05;
  if (runtime.current) drain += 0.4 * (runtime.current.speed || 50) / 100;
  t.battery = Math.max(0, t.battery - drain * dt);
  if (t.battery <= 0) { stopRun(); toast('BATTERY DEPLETED', true); return; }
  if (has('tempsensor') && runtime.current) t.temperature = Math.min(85, t.temperature + dt * 1.5);
  else t.temperature = Math.max(30, t.temperature - dt * 0.5);
  const now = performance.now();
  if (runtime.current) {
    if (runtime.current.op === 'move') {
      const s = runtime.current.speed / 100, dir = runtime.current.dir;
      if (dir === 'forward') t.distance = Math.max(8, t.distance - dt * 60 * s);
      else if (dir === 'back') t.distance = Math.min(400, t.distance + dt * 40 * s);
      t.jointSpeed = s * 30;
      if (dir === 'left' || dir === 'right') t.imu = clamp(t.imu + dt * 6, -12, 12);
    } else if (runtime.current.op === 'turn') { t.imu = clamp(t.imu + dt * (runtime.current.dir === 'left' ? 20 : -20), -180, 180); t.jointSpeed = 12; }
    else t.jointSpeed = 0;
    if (now >= runtime.actionUntil) runtime.current = null;
    return;
  }
  if (now < runtime.waitUntil) return;
  execStep();
}
function execStep() {
  if (!runtime) return;
  const a = runtime.prog[runtime.pc];
  if (!a) { runtime.pc = 0; runtime.loops++; if (runtime.loops > 200) stopRun(); return; }
  runtime.pc++;
  if (a.type === 'if') {
    const branch = evalIf(a) ? (a.body || []) : (a.elseBody || []);
    for (const b of branch) exec(b);
  } else exec(a);
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
  }
}
function evalIf(a) {
  const t = runtime.telemetry;
  let left;
  if (a.sensor === 'obstacle') left = t.distance < 40;
  else if (a.sensor === 'imu') left = Math.abs(t.imu);
  else left = t[a.sensor] ?? 0;
  switch (a.op) { case '=': return left === a.value; case '<': return left < a.value; case '>': return left > a.value; case '<=': return left <= a.value; case '>=': return left >= a.value; default: return false; }
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ============================== RENDER ============================== */
const $ = (s) => document.querySelector(s);
const CAT_ICONS = Object.fromEntries(CATS);

let libCat = 'all', libQuery = '';
function renderLibrary() {
  $('#libTabs').innerHTML = CATS.map(([id, ico, label]) =>
    `<button data-cat="${id}" class="${id === libCat ? 'active' : ''}">${ico} ${label}</button>`).join('');
  const list = PARTS.filter(p => (libCat === 'all' || p.cat === libCat) && (!libQuery || p.name.toLowerCase().includes(libQuery) || p.desc.toLowerCase().includes(libQuery)));
  $('#libList').innerHTML = list.map(p => {
    const installed = has(p.id);
    const compat = [];
    if (p.protocols.includes('can') && !has('candriver')) compat.push('<span class="chip warn">needs CAN</span>');
    if (p.needs && !has(p.needs)) compat.push('<span class="chip warn">needs ' + partById(p.needs).name.split(' ')[0] + '</span>');
    return `<div class="part" data-id="${p.id}">
      <div class="p-name">${p.name}${installed ? ' ✓' : ''}</div>
      <div class="p-specs">${p.specs.join(' · ')}</div>
      <div class="p-chips">${compat.join('')}<span class="chip">${p.cat}</span></div>
    </div>`;
  }).join('');
  document.querySelectorAll('#libTabs button').forEach(b => b.onclick = () => { libCat = b.dataset.cat; renderLibrary(); });
  document.querySelectorAll('#libList .part').forEach(el => el.onclick = () => addPart(el.dataset.id));
}
function addPart(id) {
  if (has(id)) return toast('already installed — remove it first', true);
  ws().parts.push(id); save(); renderAll();
  toast(partById(id).name + ' installed');
}
function removePart(id) { ws().parts = ws().parts.filter(p => p !== id); save(); renderAll(); }

function renderStage() {
  const on = (cls, cond) => { const el = document.querySelector(`#robotBody .seg.${cls}`); if (el) el.classList.toggle('on', cond); };
  on('head', has('pi5') || has('jetson') || has('esp32'));
  on('torso', has('frame') && has('battery'));
  on('armL', has('servo') || has('qdd') || has('gripper'));
  on('armR', has('servo') || has('qdd') || has('gripper'));
  on('legL', has('linear') || (has('frame') && has('feet')));
  on('legR', has('linear') || (has('frame') && has('feet')));
  const callouts = { 'co-compute': has('pi5') || has('jetson') || has('esp32'), 'co-power': has('battery'), 'co-imu': has('imu'), 'co-camera': has('camera'), 'co-lidar': has('lidar'), 'co-actuators': has('servo') || has('qdd') };
  for (const [id, show] of Object.entries(callouts)) document.getElementById(id)?.classList.toggle('show', show);
  const s = stats(ws().parts);
  $('#statWeight').textContent = s.kg + ' kg';
  $('#statCost').textContent = s.cost;
  $('#statPower').textContent = s.power;
  $('#ws1name').textContent = `Workspace ${activeWs + 1} – ${ws().name}`;
  $('#ws1state').textContent = ws().running ? '● Running' : ws().estopped ? '● E-stopped' : '● Idle';
  $('#ws1state').className = 'ws-state' + (ws().running ? ' active' : '');
}
function renderWs2() {
  const s = stats(other().parts);
  $('#stat2Weight').textContent = s.kg + ' kg';
  $('#stat2Cost').textContent = s.cost;
  $('#stat2Power').textContent = s.power;
  $('#ws2name').textContent = `Workspace ${2 - activeWs} – ${other().name}`;
  $('#ws2state').textContent = other().running ? '● Running' : '● Ready';
  $('#ws2state').className = 'ws-state' + (other().running ? ' active' : '');
  const sensors = [['📷', 'Camera', has2('camera')], ['🧭', 'IMU', has2('imu')], ['🔦', 'LiDAR', has2('lidar')], ['🎤', 'Microphone', has2('esp32')], ['🔋', 'Battery', has2('battery')]];
  $('#ws2Sensors').innerHTML = sensors.map(([ico, name, ok]) => `<div class="mrow"><span>${ico} ${name}</span><span class="${ok ? 'ok' : 'st'}" style="color:${ok ? 'var(--green)' : 'var(--dim)'}">${ok ? '● Online' : '○ Not installed'}</span></div>`).join('');
  $('#btnWs2Edit').textContent = `Switch to ${other().name}`;
}
function renderConn() {
  const link = ws().parts.length > 0 && other().parts.length > 0;
  $('#connStatus').innerHTML = `
    <div class="mrow"><span>🔵 Bot 1 (${ws().name})</span><span class="${ws().parts.length ? 'ok' : ''}" style="color:${ws().parts.length ? 'var(--green)' : 'var(--dim)'}">${ws().parts.length ? '● Online' : '○ Empty'}</span></div>
    <div class="mrow"><span>🟣 Bot 2 (${other().name})</span><span style="color:${other().parts.length ? 'var(--green)' : 'var(--dim)'}">${other().parts.length ? '● Online' : '○ Empty'}</span></div>
    <div class="mrow"><span>🔗 Link</span><span class="${link ? 'ok' : ''}" style="color:${link ? 'var(--green)' : 'var(--dim)'}">${link ? '● Active' : '○ Inactive'}</span></div>`;
}
function renderBuild() {
  $('#buildList').innerHTML = ws().parts.map(id => {
    const p = partById(id);
    return `<div class="bpart ${p.cat === 'power' ? 'power' : p.cat === 'compute' ? 'core' : ''}">${p.name}<button class="rm" data-id="${id}" title="Remove">✕</button></div>`;
  }).join('') || '<p style="color:var(--dim);font-size:12px">No parts yet — install from the Parts Library.</p>';
  document.querySelectorAll('#buildList .rm').forEach(b => b.onclick = (e) => { e.stopPropagation(); removePart(b.dataset.id); });
}
function renderDiagnostics() {
  const diag = diagnose();
  $('#hints').innerHTML = diag.hints.map(([lvl, title, msg]) =>
    `<div class="hint-card ${lvl}"><b>${lvl === 'bad' ? '⛔' : lvl === 'warn' ? '💡' : '✅'} ${title}</b><br>${msg}</div>`).join('');
  const chip = $('#buildStatus');
  chip.textContent = diag.complete ? 'BUILD READY' : 'BUILD INCOMPLETE';
  chip.classList.toggle('ready', diag.complete);
  $('#btnRun').disabled = !diag.complete;
  // progress ring: required systems
  const steps = [
    ['Frame Assembly', has('frame')],
    ['Motors & Joints', has('servo') || has('qdd') || has('linear')],
    ['Wiring & CAN', !ws().parts.some(p => partById(p)?.protocols.includes('can')) || has('candriver')],
    ['Sensors', has('imu') || has('lidar') || has('camera')],
    ['Power System', has('battery') && has('bms') && has('regulator')],
    ['Software & Calibration', diag.complete],
  ];
  const pct = Math.round(steps.filter(s => s[1]).length / steps.length * 100);
  $('#progRing').style.setProperty('--p', pct);
  $('#progPct').textContent = pct + '%';
  $('#progList').innerHTML = steps.map(([label, done]) => `<span class="${done ? 'done' : 'todo'}">${done ? '✓' : '○'} ${label}${pct === 100 ? '' : done ? '' : ' …'}</span>`).join('');
}
function renderTelemetry() {
  const t = runtime?.telemetry || TELEMETRY_BASE;
  const rows = [
    ['🧭', 'IMU', Math.abs(t.imu ?? 0) > 10 ? 'warn' : 'ok', (t.imu ?? 0).toFixed(2) + ' g'],
    ['⚙️', 'Joint Encoders', t.jointSpeed > 0 ? 'ok' : 'ok', (t.jointSpeed ?? 0).toFixed(1) + '°'],
    ['📷', 'Camera', has('camera') ? (t.cameraObjects ? 'warn' : 'ok') : 'bad', has('camera') ? `objects: ${t.cameraObjects ?? 0}` : 'offline'],
    ['🔦', 'LiDAR', has('lidar') ? (t.distance < 40 ? 'warn' : 'ok') : 'bad', has('lidar') ? (t.distance / 100).toFixed(1) + ' m' : 'offline'],
    ['🔋', 'Battery', t.battery < 25 ? 'bad' : 'ok', Math.round(t.battery) + '% · 24.1 V'],
    ['🌡️', 'Temperature', t.temperature > 60 ? 'warn' : 'ok', Math.round(t.temperature) + '°C'],
  ];
  $('#liveSensors').innerHTML = rows.map(([ico, name, st, val]) =>
    `<div class="lrow"><span class="ico">${ico}</span><span>${name}</span><span class="st ${st}">${st === 'ok' ? 'normal' : st === 'warn' ? 'active' : 'offline'}</span><span class="val">${val}</span></div>`).join('');
}
function renderCodeView() {
  const compiled = compile(ws().program);
  const view = $('#codeView');
  if (compiled.err) { view.innerHTML = `<span style="color:var(--red)"># ${compiled.err}</span>`; return; }
  const lines = ws().program.split('\n');
  view.innerHTML = lines.map(l => {
    const esc = l.replace(/</g, '&lt;');
    if (/^\s*(WHEN|IF|ELSE|END)/.test(l)) return `<span class="kw">${esc}</span>`;
    if (/^\s*#/.test(l)) return `<span class="cm">${esc}</span>`;
    return esc;
  }).join('\n');
  // visual blocks
  const blocks = [];
  const vb = (a, depth) => {
    if (a.type === 'if') {
      blocks.push(`<div style="margin-left:${depth * 16}px"><span class="vblock ev-if">if ${a.sensor} ${a.op} ${a.value} then</span></div>`);
      (a.body || []).forEach(x => vb(x, depth + 1));
      if (a.elseBody) { blocks.push(`<div style="margin-left:${depth * 16}px"><span class="vblock ev-else">else</span></div>`); a.elseBody.forEach(x => vb(x, depth + 1)); }
      blocks.push(`<div style="margin-left:${depth * 16}px"><span class="vblock ev-end">end</span></div>`);
    } else {
      const label = a.op === 'move' ? `move ${a.dir} <b>${a.time}s</b>` : a.op === 'say' ? `say "${a.text}"` : a.op;
      blocks.push(`<div style="margin-left:${depth * 16}px"><span class="vblock ev-act">${label}</span></div>`);
    }
  };
  blocks.push(`<div><span class="vblock ev-start">when · start</span></div>`);
  (compiled.prog || []).forEach(a => vb(a, 1));
  $('#visualCode').innerHTML = blocks.join('');
}
function renderPowerState() {
  const rb = $('#robotBody'), stage = $('#robotStage');
  rb.classList.toggle('running', !!ws().running);
  stage.classList.toggle('estopped', !!ws().estopped && !ws().running);
  $('#btnRun').textContent = ws().running ? '▶ RUNNING…' : '▶ RUN ROBOT';
}
function renderPersonas() {
  const list = [['atlas', '🛰 Atlas'], ['nova', '🚀 Nova'], ['sentinel', '🛡 Sentinel'], ['pixel', '🎮 Pixel']];
  $('#personas').innerHTML = list.map(([id, label]) => `<button data-p="${id}" class="${ws().aiPersona === id ? 'active' : ''}">${label}</button>`).join('');
  document.querySelectorAll('#personas button').forEach(b => b.onclick = () => { ws().aiPersona = b.dataset.p; save(); renderPersonas(); });
}
function renderAll() { renderLibrary(); renderStage(); renderWs2(); renderConn(); renderBuild(); renderDiagnostics(); renderTelemetry(); renderCodeView(); renderPowerState(); renderPersonas(); }

/* ============================== AI + TEAM TALK ============================== */
const chatLog = [];
let voiceOn = true, talkAbort = false;
const PERSONAS_CLIENT = {
  atlas:    { name: 'Atlas',    voiceHint: /Google UK English Male|Daniel|male/i, pitch: 0.9,  rate: 0.95 },
  nova:     { name: 'Nova',     voiceHint: /Google UK English Female|Samantha|female|Zira/i, pitch: 1.25, rate: 1.05 },
  sentinel: { name: 'Sentinel', voiceHint: /Google US English|male/i, pitch: 0.7,  rate: 0.9 },
  pixel:    { name: 'Pixel',    voiceHint: /Google UK English Female|female|Zira/i, pitch: 1.45, rate: 1.1 },
};
function speak(text, persona) {
  if (!voiceOn || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[🤖🎙🚀🛰🛡🎮⚡🔵🟣🔗]/gu, ''));
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find(v => persona?.voiceHint?.test(v.name)) || voices.find(v => v.lang.startsWith('en')) || null;
    u.pitch = persona?.pitch ?? 1; u.rate = persona?.rate ?? 1;
    speechSynthesis.speak(u);
  } catch {}
}
async function sendChat() {
  const box = $('#chatBox'); const text = box.value.trim(); if (!text) return;
  box.value = '';
  chatLog.push({ role: 'user', content: text });
  addMsg('user', text);
  const persona = PERSONAS_CLIENT[ws().aiPersona] || PERSONAS_CLIENT.atlas;
  const thinking = addMsg('ai', `${persona.name} is thinking…`, persona);
  try {
    const state = { parts: ws().parts.map(id => partById(id)?.name).filter(Boolean), power: ws().running ? 'running' : 'off', telemetry: runtime?.telemetry || null };
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: chatLog.slice(-10), personality: ws().aiPersona, robotState: state }) });
    const d = await r.json();
    const answer = d.answer || '⚠️ AI unavailable right now — try again in a moment.';
    chatLog.push({ role: 'assistant', content: answer });
    renderAiMsg(thinking, answer, d.brain, persona);
  } catch { renderAiMsg(thinking, 'Connection problem — try again.', null, persona); }
}
function addMsg(role, text, persona) {
  const el = document.createElement('div'); el.className = 'msg ' + role;
  if (role === 'ai' && persona) { const who = document.createElement('strong'); who.textContent = persona.name + ' '; el.appendChild(who); }
  el.appendChild(document.createTextNode(text));
  $('#chatLog').appendChild(el); $('#chatLog').scrollTop = 1e6; return el;
}
function renderAiMsg(el, text, brain, persona) {
  el.textContent = '';
  if (persona) { const who = document.createElement('strong'); who.textContent = persona.name + ' '; el.appendChild(who); }
  const withoutCode = text.replace(/```[\s\S]*?```/g, ' ');
  for (const part of withoutCode.split(/\n/)) { if (part.trim()) el.appendChild(document.createTextNode(part + ' ')); }
  const codeMatch = text.match(/```(?:roboforge)?\n?([\s\S]*?)```/);
  if (codeMatch) { const pre = document.createElement('pre'); pre.textContent = codeMatch[1].trim(); el.appendChild(pre); }
  if (brain) { const tag = document.createElement('span'); tag.className = 'brain-tag'; tag.textContent = brain; el.appendChild(tag); }
  speak(withoutCode.replace(/\n/g, ' '), persona);
  if ('speechSynthesis' in window) {
    const sp = document.createElement('button'); sp.className = 'speak-btn'; sp.textContent = '🔊'; sp.title = 'Play voice';
    sp.onclick = () => speak(withoutCode.replace(/\n/g, ' '), persona); el.appendChild(sp);
  }
  const pre = el.querySelector('pre');
  if (pre) {
    const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '⬇ LOAD INTO EDITOR';
    btn.onclick = () => { $('#program').value = pre.textContent; compileEditor(); $('#program').closest('details').open = true; };
    el.appendChild(document.createElement('br')); el.appendChild(btn);
  }
  $('#chatLog').scrollTop = 1e6;
}
async function startTalk() {
  const a = $('#talkA').value, b = $('#talkB').value;
  const topic = $('#talkTopic').value.trim() || 'How should we improve this robot?';
  if (a === b) return toast('pick two different robots to talk', true);
  talkAbort = false;
  $('#talkStart').style.display = 'none'; $('#talkStop').style.display = '';
  addMsg('system-note', `🎙 ${PERSONAS_CLIENT[a].name} and ${PERSONAS_CLIENT[b].name} are discussing: “${topic}”`);
  const state = { parts: ws().parts.map(id => partById(id)?.name).filter(Boolean), power: ws().running ? 'running' : 'off' };
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
        renderAiMsg(addMsg('ai', '', persona), line.text, line.brain, persona);
        await new Promise(res => setTimeout(res, 1800));
      }
    } catch { addMsg('ai', 'Connection problem — conversation paused.'); break; }
    turn += 2;
  }
  $('#talkStart').style.display = ''; $('#talkStop').style.display = 'none';
}

/* ============================== MISC ============================== */
function setCompileStatus(ok, msg) { const st = $('#compileStatus'); st.className = ok ? 'ok' : 'err'; st.textContent = (ok ? '✓ ' : '✖ ') + msg; }
function compileEditor() {
  const compiled = compile($('#program').value);
  if (compiled.err) { setCompileStatus(false, compiled.err); renderCodeView(); return false; }
  setCompileStatus(true, `PROGRAM VALID — ${compiled.prog.length} instructions`);
  ws().program = $('#program').value; save(); renderCodeView();
  return true;
}
let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = err ? 'err show' : 'show';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = '', 2600);
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
$('#libSearch').addEventListener('input', e => { libQuery = e.target.value.toLowerCase(); renderLibrary(); });
$('#btnWs2Edit').onclick = () => { activeWs = 1 - activeWs; $('#program').value = ws().program || ''; renderAll(); toast(`now editing ${ws().name}`); };
$('#btnMerge').onclick = () => {
  const link = ws().parts.length && other().parts.length;
  toast(link ? '⚡ Workspaces merged — bots can exchange messages' : 'Both bots need parts before they can connect', !link);
  renderConn();
};
document.querySelectorAll('.subtab[data-tab]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.subtab[data-tab]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const live = b.dataset.tab === 'live';
  $('#liveSensors').style.display = live ? 'flex' : 'none';
  $('#codeView').style.display = live ? 'none' : 'block';
});
$('#modeChat').onclick = () => { $('#modeChat').classList.add('active'); $('#modeTalk').classList.remove('active'); $('#talkPick').style.display = 'none'; };
$('#modeTalk').onclick = () => { $('#modeTalk').classList.add('active'); $('#modeChat').classList.remove('active'); $('#talkPick').style.display = 'flex'; };
$('#btnMute').onclick = () => { voiceOn = !voiceOn; if (!voiceOn) try { speechSynthesis.cancel(); } catch {} $('#btnMute').textContent = voiceOn ? '🔊 VOICE ON' : '🔇 VOICE OFF'; $('#btnMute').classList.toggle('active', voiceOn); };
for (const sel of ['#talkA', '#talkB']) $(sel).innerHTML = Object.entries(PERSONAS_CLIENT).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('');
$('#talkA').value = 'atlas'; $('#talkB').value = 'nova';
$('#talkStart').onclick = startTalk;
$('#talkStop').onclick = () => { talkAbort = true; try { speechSynthesis.cancel(); } catch {} };
renderAll();

// 20 Hz loop
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  stepRuntime(dt);
  if (ws().running) { renderTelemetry(); renderStage(); }
}, 50);
