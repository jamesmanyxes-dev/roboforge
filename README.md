# ⚡ RoboForge Lab

A browser-based virtual robotics laboratory — Stage 1 (Functional Lab).

**Assemble. Diagnose. Program. Run. Watch it think.**

## Features
- **Parts Library** — 21 components across 6 categories (compute, actuators, structure, power, sensors, end effectors)
- **Assembly Chamber** — build up to 4 robots in separate workspaces (saved in your browser)
- **Diagnostics** — live build checks: missing parts, dependency rules (QDD motor needs CAN, Camera needs Jetson), safety recommendations
- **RoboForge Language** — a simple robot DSL: `WHEN START / IF OBSTACLE / MOVE FORWARD SPEED 60 TIME 3 / STOP / SAY "hello"` with IF/ELSE, nesting, and validation
- **Runtime + Telemetry** — simulated IMU, distance, battery drain, temperature, joint speed; battery depletes, robots overheat, E-STOP cuts everything
- **4 AI Personalities, 4 different brains** — Atlas (deep reasoning), Nova (fast+creative), Sentinel (safety), Pixel (teacher). Each runs on a different model.
- **🎙 Team Talk** — two AI robots discuss a design goal with each other. Each hears the other's last message and responds with its own brain. **Spoken out loud** with distinct voices per robot (toggle 🔊).
- **AI loads programs** — ask an AI "make my robot avoid walls" and load its program straight into the editor with one click.

## Run locally
```bash
npm install
GROQ_API_KEY=xxx GEMINI_API_KEY=xxx node server.js
# open http://localhost:3001
```

## Deploy (Render)
1. Push to GitHub → Render → New Web Service → connect the repo
2. Environment: `GROQ_API_KEY`, `GEMINI_API_KEY` (optional — Groq covers everything; Gemini adds a 4th brain)
3. `render.yaml` included for one-click blueprint deploys

## Security
API keys are server-side only (`process.env`). The browser never sees them.

## Roadmap (Stages 2–7)
3D lab (Three.js) → physics engine → IK/PID/walking → multi-robot networking → cloud accounts → hardware bridge.
