const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const starsEl = document.getElementById('stars-display');
const inkBarBg = document.getElementById('ink-bar-bg');
const inkBarFill = document.getElementById('ink-bar-fill');
const drawHint = document.getElementById('draw-hint');
const finalScore = document.getElementById('final-score');

const W = () => window.innerWidth;
const H = () => window.innerHeight;
let s = 1;

const STATE = { MENU: 0, DRAW: 1, PROTECT: 2, WIN: 3, LOSE: 4, GAMEOVER: 5 };
let state = STATE.MENU;
let level = 1, score = 0, lives = 3, stars = 0, roundStars = 0;
let timeLeft = 10;
let frameCount = 0;
let gameTimer = 0;
let timerActive = false;
let roundActive = false;
let lastDrawPoint = null;
let drawStartPos = null;

const doge = { x: 0, y: 0, r: 0, hurtTimer: 0, blinkTimer: 0 };
const GROUND_H_RATIO = 0.08;

let bees = [];
let drawnPoints = [];
let lineSegments = [];
let inkUsed = 0;
const MAX_INK = 600;
const particles = [];
const clouds = [];
const flowers = [];

function resize() {
  canvas.width = W();
  canvas.height = H();
  s = Math.min(W(), H()) / 800;
  doge.x = W() / 2;
  doge.y = H() - H() * GROUND_H_RATIO * 0.5 - 30 * s;
  doge.r = 28 * s;
  doge.hurtTimer = 0;
  doge.blinkTimer = 0;
  initClouds();
  initFlowers();
}

function initClouds() {
  clouds.length = 0;
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * W(),
      y: 30 + Math.random() * H() * 0.15,
      w: (60 + Math.random() * 80) * s,
      h: (20 + Math.random() * 30) * s,
      speed: 0.15 + Math.random() * 0.2,
      opacity: 0.3 + Math.random() * 0.3
    });
  }
}

function initFlowers() {
  flowers.length = 0;
  for (let i = 0; i < 8; i++) {
    flowers.push({
      x: W() * (0.05 + i * 0.12),
      y: H() - H() * GROUND_H_RATIO,
      color: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF69B4', '#FF9F43'][i % 6],
      size: (3 + Math.random() * 3) * s
    });
  }
}

function spawnBee() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const m = 40 * s;
  switch (side) {
    case 0: x = Math.random() * W(); y = -m; break;
    case 1: x = W() + m; y = Math.random() * H() * 0.5; break;
    case 2: x = Math.random() * W(); y = -m; break;
    case 3: x = -m; y = Math.random() * H() * 0.5; break;
  }
  bees.push({
    x, y,
    vx: 0, vy: 0,
    target: { x: doge.x + (Math.random() - 0.5) * 40 * s, y: doge.y },
    r: (14 + Math.random() * 3) * s,
    speed: (1.0 + Math.random() * 1.5 + level * 0.06) * s,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.015 + Math.random() * 0.02,
    stuck: 0,
    alive: true,
    animPhase: Math.random() * Math.PI * 2
  });
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function findNearestSeg(px, py, maxD) {
  let best = -1, bestD = maxD;
  for (let i = 0; i < lineSegments.length; i++) {
    const seg = lineSegments[i];
    if (seg.hp <= 0) continue;
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) continue;
    const t = clamp(((px - seg.x1) * dx + (py - seg.y1) * dy) / (len * len), 0, 1);
    const nx = seg.x1 + t * dx, ny = seg.y1 + t * dy;
    const d = Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function addParticle(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (1 + Math.random() * 3) * s;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1 * s,
      life: 20 + Math.random() * 20,
      maxLife: 40,
      r: (2 + Math.random() * 3) * s,
      color
    });
  }
}

function updateBees() {
  const maxBeelines = Math.min(2 + Math.floor(level * 0.8), 10);
  if (bees.length < maxBeelines && frameCount % Math.max(28, 55 - level * 2) === 0) spawnBee();

  for (const bee of bees) {
    if (!bee.alive) continue;
    if (bee.stuck > 0) { bee.stuck--; continue; }

    bee.wobble += bee.wobbleSpeed;
    bee.animPhase += 0.12;
    const wx = Math.sin(bee.wobble) * 1.5 * s;
    const wy = Math.cos(bee.wobble * 0.7) * 0.8 * s;
    const dx = bee.target.x - bee.x + wx;
    const dy = bee.target.y - bee.y + wy;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 3 * s) {
      bee.vx += (dx / d) * 0.14;
      bee.vy += (dy / d) * 0.14;
      const spd = Math.sqrt(bee.vx * bee.vx + bee.vy * bee.vy);
      if (spd > bee.speed) { bee.vx = (bee.vx / spd) * bee.speed; bee.vy = (bee.vy / spd) * bee.speed; }
      bee.x += bee.vx;
      bee.y += bee.vy;
    }

    const segIdx = findNearestSeg(bee.x, bee.y, bee.r + 4 * s);
    if (segIdx >= 0) {
      const seg = lineSegments[segIdx];
      seg.hp--;
      if (seg.hp <= 0) { seg.hp = 0; addParticle((seg.x1 + seg.x2) / 2, (seg.y1 + seg.y2) / 2, '#FF6B6B', 4); }
      if (bee.stuck <= 0) { bee.stuck = 5; bee.vx *= -0.25; bee.vy *= -0.25; bee.x += bee.vx * 2; bee.y += bee.vy * 2; }
    } else {
      bee.target = { x: doge.x + (Math.random() - 0.5) * 50 * s, y: doge.y };
    }

    const dd = Math.sqrt((bee.x - doge.x) ** 2 + (bee.y - doge.y) ** 2);
    if (dd < doge.r * 0.5 + bee.r) {
      bee.alive = false;
      doge.hurtTimer = 25;
      addParticle(bee.x, bee.y, '#FF6B6B', 8);
      lives--;
      updateHUD();
      if (lives <= 0) { gameOver(); return; }
    }
  }

  bees = bees.filter(b => b.alive);
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function roundEnd() {
  roundActive = false;
  timerActive = false;
  state = STATE.WIN;
  const totalHp = lineSegments.reduce((sum, seg) => sum + seg.hp, 0);
  const maxHp = lineSegments.length * (6 + Math.floor(level / 2));
  const health = maxHp > 0 ? totalHp / maxHp : 0;
  roundStars = health > 0.65 && inkUsed < MAX_INK * 0.3 ? 3 : health > 0.35 && inkUsed < MAX_INK * 0.6 ? 2 : 1;
  stars += roundStars;
  score++;
  if (lives < 3) lives++;
  updateHUD();
  showMessage(`Level ${level} Clear!\n${'⭐'.repeat(roundStars)}${'☆'.repeat(3 - roundStars)}`);
  setTimeout(() => { if (state === STATE.WIN) { level++; resetRound(); state = STATE.DRAW; } }, 2200);
}

function gameOver() {
  state = STATE.GAMEOVER;
  timerActive = false;
  roundActive = false;
  finalScore.textContent = `Level ${level}\n${score} Saved\n${stars} Stars`;
  finalScore.style.display = 'block';
  showMessage('Bees Got the Doge! 💔', true);
}

function resetRound() {
  bees = [];
  lineSegments = [];
  drawnPoints = [];
  particles.length = 0;
  inkUsed = 0;
  lastDrawPoint = null;
  drawStartPos = null;
  timeLeft = 10;
  gameTimer = 0;
  frameCount = 0;
  timerActive = false;
  roundActive = false;
  timerEl.textContent = '10';
  inkBarFill.style.width = '100%';
  inkBarBg.style.display = 'block';
  drawHint.classList.remove('hidden');
  drawHint.textContent = '✏️ Draw a line to protect the doge!';
  starsEl.textContent = '';
  levelEl.textContent = 'Level ' + level;
  updateHUD();
  hideMessage();
  finalScore.style.display = 'none';
}

function startGame() {
  state = STATE.DRAW;
  level = 1; score = 0; lives = 3; stars = 0; roundStars = 0;
  startScreen.style.opacity = '0';
  setTimeout(() => { startScreen.style.display = 'none'; }, 400);
  document.getElementById('hud').style.display = 'flex';
  resetRound();
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  let x, y;
  if (e.touches) { x = e.touches[0].clientX - rect.left; y = e.touches[0].clientY - rect.top; }
  else { x = e.clientX - rect.left; y = e.clientY - rect.top; }
  return { x: x * (canvas.width / rect.width), y: y * (canvas.height / rect.height) };
}

function startDraw(pos) {
  if (state !== STATE.DRAW) return;
  drawStartPos = { x: pos.x, y: pos.y };
  lastDrawPoint = pos;
  drawnPoints = [{ x: pos.x, y: pos.y }];
}

function moveDraw(pos) {
  if (!drawnPoints.length || state !== STATE.DRAW) return;
  const dx = pos.x - lastDrawPoint.x;
  const dy = pos.y - lastDrawPoint.y;
  const dd = Math.sqrt(dx * dx + dy * dy);
  if (dd < 2 * s) return;
  inkUsed += dd;
  const pct = Math.min(inkUsed / MAX_INK, 1);
  inkBarFill.style.width = ((1 - pct) * 100) + '%';
  if (inkUsed >= MAX_INK) { endDraw(); return; }
  drawnPoints.push({ x: pos.x, y: pos.y });
  lastDrawPoint = pos;
}

function endDraw() {
  if (drawnPoints.length < 5) { drawnPoints = []; return; }
  for (let i = 0; i < drawnPoints.length - 1; i++) {
    const p1 = drawnPoints[i], p2 = drawnPoints[i + 1];
    lineSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, hp: 5 + Math.floor(level / 2) });
  }
  state = STATE.PROTECT;
  roundActive = true;
  timerActive = true;
  drawHint.classList.add('hidden');
  inkBarBg.style.display = 'none';
  drawHint.textContent = '🛡️ Hold on!';
}

// Touch/Mouse events
canvas.addEventListener('mousedown', e => startDraw(getPos(e)));
canvas.addEventListener('mousemove', e => moveDraw(getPos(e)));
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);

canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(getPos(e)); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); moveDraw(getPos(e)); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); endDraw(); }, { passive: false });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function updateHUD() {
  let h = '';
  for (let i = 0; i < 3; i++) h += i < lives ? '❤️' : '🖤';
  livesEl.textContent = h;
  scoreEl.textContent = '🐝 ' + score;
  levelEl.textContent = 'Level ' + level;
  starsEl.textContent = '⭐'.repeat(stars % 10);
}

function showMessage(text, isOver) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  if (isOver) restartBtn.style.display = 'block';
}

function hideMessage() {
  messageEl.classList.remove('show');
  restartBtn.style.display = 'none';
}

// ======== DRAWING ========

function drawDoge() {
  const x = doge.x, y = doge.y, r = doge.r;
  const hurt = doge.hurtTimer > 0;
  if (doge.hurtTimer > 0) doge.hurtTimer--;
  doge.blinkTimer++;
  const blink = doge.blinkTimer % 120 < 3;
  const wag = Math.sin(frameCount * 0.1) * 5 * s;

  ctx.save();
  ctx.translate(x, y);

  // Tail
  ctx.save();
  ctx.translate(r * 0.5, -r * 0.7);
  ctx.rotate(Math.sin(frameCount * 0.08) * 0.3);
  ctx.fillStyle = hurt ? '#FF6B6B' : '#D4A574';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.4, r * 0.35, r * 0.12, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body
  ctx.fillStyle = hurt ? '#FF6B6B' : '#D4A574';
  ctx.shadowColor = 'rgba(139,92,246,0.12)';
  ctx.shadowBlur = 10 * s;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.8, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Belly
  ctx.fillStyle = '#FDEBD0';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.3, r * 0.55, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.save();
  ctx.translate(-r * 0.28, -r * 0.72);
  ctx.rotate(-0.15);
  ctx.fillStyle = hurt ? '#FF6B6B' : '#D4A574';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.22, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F5CBBE';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.14, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(r * 0.28, -r * 0.72);
  ctx.rotate(0.15);
  ctx.fillStyle = hurt ? '#FF6B6B' : '#D4A574';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.22, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F5CBBE';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.14, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Eyes
  if (!blink) {
    ctx.fillStyle = '#2D3436';
    ctx.beginPath(); ctx.arc(-r * 0.17, -r * 0.15, r * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.17, -r * 0.15, r * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(-r * 0.14, -r * 0.18, r * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.18, r * 0.025, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = '#2D3436';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(-r * 0.24, -r * 0.15); ctx.lineTo(-r * 0.1, -r * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.15); ctx.lineTo(r * 0.24, -r * 0.15); ctx.stroke();
  }

  // Nose
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.ellipse(0, r * 0.0, r * 0.05, r * 0.04, 0, 0, Math.PI * 2); ctx.fill();

  // Mouth
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath(); ctx.moveTo(0, r * 0.06); ctx.lineTo(-r * 0.08, r * 0.14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, r * 0.06); ctx.lineTo(r * 0.08, r * 0.14); ctx.stroke();

  // Tongue
  const tw = Math.sin(frameCount * 0.12) * 1.5 * s;
  ctx.fillStyle = '#FF8A8A';
  ctx.beginPath(); ctx.ellipse(tw, r * 0.17, r * 0.03, r * 0.09, 0, 0, Math.PI); ctx.fill();

  // Paws
  ctx.fillStyle = hurt ? '#FF6B6B' : '#B8895C';
  ctx.beginPath(); ctx.ellipse(-r * 0.35, r * 0.55, r * 0.1, r * 0.06, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.35, r * 0.55, r * 0.1, r * 0.06, 0.2, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawBee(bee) {
  const x = bee.x, y = bee.y, r = bee.r;
  const buzz = Math.sin(bee.animPhase) * 1.5 * s;

  ctx.save();
  ctx.translate(x, y + buzz);

  // Body shadow
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.ellipse(2 * s, 2 * s, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.68, 0, 0, Math.PI * 2); ctx.fill();

  // Stripes
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.ellipse(-r * 0.28, 0, r * 0.18, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.28, 0, r * 0.18, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();

  // Wings
  const wf = Math.sin(bee.animPhase * 2.5) * 0.3 + 0.5;
  ctx.fillStyle = 'rgba(200,225,255,0.45)';
  ctx.beginPath(); ctx.ellipse(-r * 0.95, -r * 0.3, r * 0.55, r * 0.14 * wf, -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.95, -r * 0.3, r * 0.55, r * 0.14 * wf, 0.25, 0, Math.PI * 2); ctx.fill();

  // Eye
  ctx.fillStyle = '#FF3333';
  ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.1, r * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(-r * 0.41, -r * 0.115, r * 0.02, 0, Math.PI * 2); ctx.fill();

  // Stinger
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.05); ctx.lineTo(r * 0.95, -r * 0.18); ctx.lineTo(r * 0.95, -r * 0.02); ctx.closePath(); ctx.fill();

  ctx.restore();
}

function drawDrawnLine() {
  if (drawnPoints.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#7C3AED';
  ctx.lineWidth = 9 * s;
  ctx.shadowColor = 'rgba(139,92,246,0.4)';
  ctx.shadowBlur = 6 * s;
  ctx.beginPath();
  ctx.moveTo(drawnPoints[0].x, drawnPoints[0].y);
  for (let i = 1; i < drawnPoints.length; i++) {
    ctx.lineTo(drawnPoints[i].x, drawnPoints[i].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawLineSegments() {
  for (const seg of lineSegments) {
    if (seg.hp <= 0) continue;
    const maxHp = 6 + Math.floor(level / 2);
    const pct = seg.hp / maxHp;
    const alpha = 0.4 + pct * 0.6;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = (8 + pct * 3) * s;
    ctx.shadowColor = 'rgba(139,92,246,0.3)';
    ctx.shadowBlur = 4 * s;
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, H() * 0.7);
  grad.addColorStop(0, '#E0F7FA');
  grad.addColorStop(0.4, '#B3E5FC');
  grad.addColorStop(0.7, '#81D4FA');
  grad.addColorStop(1, '#B3E5FC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W(), H());
}

function drawClouds() {
  for (const c of clouds) {
    c.x += c.speed;
    if (c.x > W() + c.w) c.x = -c.w;
    ctx.fillStyle = `rgba(255,255,255,${c.opacity})`;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 0.6, c.y - c.h * 0.2, c.w * 0.5, c.h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + c.w * 1.1, c.y, c.w * 0.5, c.h * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround() {
  const gh = H() * GROUND_H_RATIO;
  const grad = ctx.createLinearGradient(0, H() - gh, 0, H());
  grad.addColorStop(0, '#66BB6A');
  grad.addColorStop(0.35, '#4CAF50');
  grad.addColorStop(1, '#2E7D32');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H() - gh, W(), gh);

  ctx.fillStyle = '#A5D6A7';
  ctx.fillRect(0, H() - gh - 1 * s, W(), 2 * s);

  for (const f of flowers) {
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(f.x - s, f.y - 3 * s, 2 * s, 3 * s);
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(f.x, f.y - 4 * s, f.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD93D';
    ctx.beginPath(); ctx.arc(f.x, f.y - 4 * s, f.size * 0.4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawHive() {
  const hx = W() * 0.82;
  const hy = H() * 0.06;
  const hs = 22 * s;

  ctx.fillStyle = '#D4A017';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3 - row; col++) {
      const ox = (row % 2) * hs * 0.45;
      ctx.beginPath();
      ctx.ellipse(hx + col * hs + ox - hs, hy + row * hs * 0.75, hs * 0.45, hs * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 1.5 * s;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3 - row; col++) {
      const ox = (row % 2) * hs * 0.45;
      ctx.beginPath();
      ctx.ellipse(hx + col * hs + ox - hs, hy + row * hs * 0.75, hs * 0.45, hs * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#FFD54F';
  ctx.font = `${16 * s}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('🐝', hx - hs * 0.3, hy + hs * 0.35);
}

function drawSun() {
  const sx = W() * 0.12;
  const sy = H() * 0.08;
  const sr = 18 * s;
  ctx.fillStyle = '#FFE082';
  ctx.shadowColor = 'rgba(255,224,130,0.4)';
  ctx.shadowBlur = 20 * s;
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFF9C4';
  ctx.beginPath(); ctx.arc(sx, sy, sr * 0.6, 0, Math.PI * 2); ctx.fill();
}

function update() {
  if (state === STATE.PROTECT && roundActive) {
    updateBees();
    updateParticles();
    if (timerActive) {
      gameTimer++;
      if (gameTimer % 60 === 0) {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 0) { roundEnd(); return; }
      }
    }
    const hasDmg = lineSegments.some(s => s.hp <= 0);
    const aliveSegs = lineSegments.filter(s => s.hp > 0).length;
    if (aliveSegs === 0 && lineSegments.length > 0 && roundActive) {
      const nearBee = bees.some(b => Math.sqrt((b.x - doge.x) ** 2 + (b.y - doge.y) ** 2) < doge.r * 1.8);
      if (nearBee) {
        lives--;
        doge.hurtTimer = 20;
        updateHUD();
        if (lives <= 0) gameOver();
      }
    }
  }
  frameCount++;
}


function draw() {
  drawSky();
  drawSun();
  drawClouds();
  drawGround();
  drawHive();
  drawLineSegments();
  drawDrawnLine();
  drawParticles();
  for (const bee of bees) drawBee(bee);
  drawDoge();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
resize();
loop();
