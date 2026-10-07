// RoboForge Lab — server: static frontend + multi-brain AI assistant
// Brains: each persona runs on a DIFFERENT model, so they genuinely think differently.
// Team Talk: two personas converse with each other; each hears the other's messages.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'roboforge' }));

app.get('/api/ai-status', (req, res) => res.json({
  gemini: !!process.env.GEMINI_API_KEY,
  groq: !!process.env.GROQ_API_KEY,
}));

/* ============================== PERSONAS & BRAINS ============================== */
const PERSONAS = {
  atlas: {
    name: 'Atlas',
    voiceHint: /Google UK English Male|Daniel|male/i,
    pitch: 0.9, rate: 0.95,
    brain: { provider: 'groq', model: process.env.GROQ_MODEL_A || 'openai/gpt-oss-120b' },
    system: 'You are Atlas, a calm, precise robotics engineer. You think in systems: power budgets, torque, control loops. You speak concisely and technically, max 3 short sentences per turn.',
  },
  nova: {
    name: 'Nova',
    voiceHint: /Google UK English Female|Samantha|female|Zira/i,
    pitch: 1.25, rate: 1.05,
    brain: { provider: 'groq', model: process.env.GROQ_MODEL_B || 'qwen/qwen3.8-27b' },
    system: 'You are Nova, a curious, energetic inventor. You love clever ideas and bold experiments. You speak with excitement, max 3 short sentences per turn.',
  },
  sentinel: {
    name: 'Sentinel',
    voiceHint: /Google UK English Male|Daniel|male/i,
    pitch: 0.7, rate: 0.9,
    brain: { provider: 'groq', model: process.env.GROQ_MODEL_C || 'openai/gpt-oss-20b' },
    system: 'You are Sentinel, a safety-focused robotics operator. You always check power, heat, and stability before anything moves. You speak briefly and firmly, max 3 short sentences per turn.',
  },
  pixel: {
    name: 'Pixel',
    voiceHint: /Google UK English Female|female|Zira/i,
    pitch: 1.45, rate: 1.1,
    brain: { provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-3.8-flash', fallback: { provider: 'groq', model: 'qwen/qwen3.8-27b' } },
    system: 'You are Pixel, a playful teacher. You explain robotics with fun analogies a beginner understands. You are warm and encouraging, max 3 short sentences per turn.',
  },
};

/* ============================== PROVIDERS ============================== */
async function callGemini(key, model, messages, system) {
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 600, temperature: 1.0 } }),
  });
  if (!r.ok) throw new Error('gemini ' + r.status);
  const d = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('gemini empty');
  return text;
}

async function callGroq(key, model, messages, system) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 700, temperature: 0.9 }),
  });
  if (!r.ok) throw new Error('groq ' + r.status);
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content;
  if (!text) throw new Error('groq empty');
  return text;
}

const GEMINI_STYLES = {
  single: 'You are the AI assistant inside RoboForge, a browser robotics lab. The user builds virtual robots from parts (compute boards, motors, sensors, batteries, frames, grippers) and programs them in a simple language. Answer helpfully and concisely.',
  talk: 'Two AI personas are having a short engineering discussion about a virtual robot in RoboForge, a browser robotics lab. Keep it collaborative and technical. IMPORTANT: reply with ONLY your spoken line — no name prefix, no stage directions, max 3 short sentences.',
};

const ROBOFORGE_CONTEXT = `RoboForge programs use a simple language: WHEN START ... END blocks, IF <SENSOR> <OP> <VALUE> ... ELSE ... END, commands: SET MOTORS ON/OFF, STOP or STOP MOTORS, MOVE FORWARD/BACK/LEFT/RIGHT [SPEED n] [TIME n], TURN LEFT/RIGHT, WAIT n, SAY "text", RESTART.
Sensors: IMU (tilt degrees), DISTANCE (cm), BATTERY (%), TEMPERATURE (C), OBSTACLE (true/false).
Parts: Raspberry Pi 5 / Jetson Orin Nano / ESP32 (compute), QDD (needs CAN controller) / Servo / Linear (motors), Frame, Battery + BMS + Regulator + E-Stop (power), IMU / Encoder / LiDAR / Camera (needs Jetson) / Temperature (sensors), Gripper / Suction (end effectors).`;

function robotStateText(robotState) {
  if (!robotState) return '';
  try {
    const parts = Array.isArray(robotState.parts) ? robotState.parts : [];
    const st = robotState.power === 'running' ? 'currently RUNNING' : 'powered off';
    return `Current robot: ${parts.join(', ') || 'no parts yet'}; ${st}.` + (robotState.telemetry ? ` Telemetry: ${JSON.stringify(robotState.telemetry).slice(0, 300)}.` : '');
  } catch { return ''; }
}

async function think(personaId, messages, mode, robotState) {
  const p = PERSONAS[personaId] || PERSONAS.atlas;
  const sys = (mode === 'talk' ? p.system + ' ' + GEMINI_STYLES.talk : `${p.system}\n${GEMINI_STYLES.single}\n${ROBOFORGE_CONTEXT}\n${robotStateText(robotState)}`);
  const attempts = [p.brain, ...(p.brain.fallback ? [p.brain.fallback] : [])];
  let lastErr = null;
  for (const brain of attempts) {
    try {
      if (brain.provider === 'gemini' && process.env.GEMINI_API_KEY) {
        const text = await callGemini(process.env.GEMINI_API_KEY, brain.model, messages, sys);
        return { text, brain: 'gemini/' + brain.model.split('/').pop() };
      }
      if (brain.provider === 'groq' && process.env.GROQ_API_KEY) {
        const text = await callGroq(process.env.GROQ_API_KEY, brain.model, messages, sys);
        return { text, brain: 'groq/' + brain.model.split('/').pop() };
      }
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(lastErr || 'no provider configured');
}

/* single chat */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, personality, robotState } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'invalid_request' });
    const { text, brain } = await think(personality, messages, 'single', robotState);
    res.json({ answer: text, brain, persona: PERSONAS[personality]?.name || 'Atlas' });
  } catch (e) {
    console.error('chat:', e.message);
    res.status(503).json({ error: 'ai_unavailable', hint: 'Check GROQ_API_KEY / GEMINI_API_KEY in Render → Environment' });
  }
});

/* Team Talk: two personas converse, each hearing the other */
app.post('/api/roundtable', async (req, res) => {
  try {
    const { personaA, personaB, topic, turns = 4, robotState } = req.body || {};
    const A = PERSONAS[personaA], B = PERSONAS[personaB];
    if (!A || !B || A === B) return res.status(400).json({ error: 'invalid_personas' });
    const shared = [];
    const lines = [];
    let speaker = personaA, listener = personaB;
    for (let i = 0; i < Math.max(1, Math.min(8, turns)); i++) {
      const opening = shared.length === 0;
      const myMsgs = opening
        ? [{ role: 'user', content: `${topic}\n(You are ${A.name} talking with your teammate ${B.name}. Give your first take.)` }]
        : [{ role: 'user', content: `Your teammate ${PERSONAS[listener].name} just said:\n"${shared[shared.length - 1].text}"\nRespond to that.` }];
      const { text, brain } = await think(speaker, myMsgs, 'talk', robotState);
      const clean = text.replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 600);
      shared.push({ persona: speaker, text: clean });
      lines.push({ persona: speaker, name: PERSONAS[speaker].name, text: clean, brain });
      [speaker, listener] = [listener, speaker];
    }
    res.json({ lines });
  } catch (e) {
    console.error('roundtable:', e.message);
    res.status(503).json({ error: 'ai_unavailable', hint: 'Check GROQ_API_KEY / GEMINI_API_KEY in Render → Environment' });
  }
});

/* static frontend */
const pub = path.join(__dirname, 'public');
app.use(express.static(pub, { etag: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(pub, 'index.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`RoboForge Lab listening on :${PORT}`));
