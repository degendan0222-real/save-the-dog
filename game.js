const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const startTitle = document.getElementById('start-title');
const startSub = document.getElementById('start-sub');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const inkContainer = document.getElementById('ink-container');
const inkFill = document.getElementById('ink-fill');
const drawHint = document.getElementById('draw-hint');
const finalScore = document.getElementById('final-score');

let W, H, s;
let gameState = 'menu';
let phase = 'draw';
let level = 1;
let score = 0;
let lives = 3;
let timeLeft = 10;
let frameCount = 0;
let stars = 0;

const lines = [];
const bees = [];
const lineSegments = [];
const doge = {};
const GROUND_H = 60;
const DOGE_SIZE = 36;
const MAX_INK = 800;

let drawing = false;
let currentLine = null;
let inkUsed = 0;
let gameTimer = 0;
let timerActive = false;
let roundActive = false;
let beeSpawnTimer = 0;
let lastDrawPoint = null;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  s = Math.min(W, H) / 800;
  doge.x = W / 2;
  doge.y = H - GROUND_H * s - DOGE_SIZE * s * 0.7;
  doge.r = DOGE_SIZE * s;
  doge.hurtTimer = 0;
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getDogeCenter() {
  return { x: doge.x, y: doge.y - doge.r * 0.3 };
}

function spawnBee() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const margin = 50 * s;
  switch (side) {
    case 0: x = Math.random() * W; y = -margin; break;
    case 1: x = W + margin; y = Math.random() * H * 0.6; break;
    case 2: x = Math.random() * W; y = -margin; break;
    case 3: x = -margin; y = Math.random() * H * 0.6; break;
  }
  const target = getDogeCenter();
  bees.push({
    x, y, vx: 0, vy: 0, target,
    r: (16 + Math.random() * 4) * s,
    speed: (1.2 + Math.random() * 1.5 + level * 0.08) * s,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.02 + Math.random() * 0.02,
    stuck: 0, alive: true
  });
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function findNearestSegment(x, y, maxDist) {
  let nearest = -1, nearDist = maxDist;
  for (let i = 0; i < lineSegments.length; i++) {
    const seg = lineSegments[i];
    if (seg.hp <= 0) continue;
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) continue;
    const t = clamp(((x - seg.x1) * dx + (y - seg.y1) * dy) / (len * len), 0, 1);
    const px = seg.x1 + t * dx, py = seg.y1 + t * dy;
    const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
    if (d < nearDist) { nearDist = d; nearest = i; }
  }
  return nearest;
}

function updateBees() {
  const maxBees = Math.min(3 + Math.floor(level / 2), 12);
  if (bees.length < maxBees && frameCount % Math.max(25, 60 - level * 2) === 0) {
    spawnBee();
  }

  for (const bee of bees) {
    if (!bee.alive) continue;
    if (bee.stuck > 0) { bee.stuck--; continue; }

    bee.wobble += bee.wobbleSpeed;
    const wx = Math.sin(bee.wobble) * 1.5 * s;
    const wy = Math.cos(bee.wobble * 0.7) * 1 * s;
    const dx = bee.target.x - bee.x + wx;
    const dy = bee.target.y - bee.y + wy;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 3 * s) {
      bee.vx += (dx / d) * 0.15;
      bee.vy += (dy / d) * 0.15;
      const spd = Math.sqrt(bee.vx * bee.vx + bee.vy * bee.vy);
      const maxSpd = bee.speed;
      if (spd > maxSpd) { bee.vx = (bee.vx / spd) * maxSpd; bee.vy = (bee.vy / spd) * maxSpd; }
      bee.x += bee.vx;
      bee.y += bee.vy;
    }

    const segIdx = findNearestSegment(bee.x, bee.y, bee.r + 4 * s);
    if (segIdx >= 0) {
      const seg = lineSegments[segIdx];
      seg.hp--;
      if (seg.hp <= 0) { seg.hp = 0; }
      bee.stuck = 6;
      bee.vx *= -0.3; bee.vy *= -0.3;
      bee.x += bee.vx; bee.y += bee.vy;
    } else {
      bee.target = getDogeCenter();
    }

    const dx2 = bee.x - doge.x;
    const dy2 = bee.y - (doge.y - doge.r * 0.2);
    if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < doge.r * 0.5 + bee.r) {
      bee.alive = false;
      lives--;
      doge.hurtTimer = 30;
      updateUI();
      if (lives <= 0) { gameOver(); return; }
    }
  }

  for (let i = bees.length - 1; i >= 0; i--) {
    if (!bees[i].alive) bees.splice(i, 1);
  }
}

function roundEnd(success) {
  roundActive = false;
  timerActive = false;
  if (success) {
    const totalHp = lineSegments.reduce((sum, seg) => sum + seg.hp, 0);
    const maxHp = lineSegments.length * (8 + Math.floor(level / 2));
    const lineHealth = maxHp > 0 ? totalHp / maxHp : 0;
    let roundStars = 1;
    if (lineHealth > 0.6 && inkUsed < MAX_INK * 0.35) roundStars = 3;
    else if (lineHealth > 0.3 && inkUsed < MAX_INK * 0.65) roundStars = 2;
    stars += roundStars;
    score++;
    if (lives < 3) lives++;
    updateUI();
    showMessage(`Level ${level} Clear!\n${'⭐'.repeat(roundStars)}${'☆'.repeat(3 - roundStars)}`);
  }
  setTimeout(() => {
    if (gameState === 'playing') {
      level++;
      resetRound();
    }
  }, 2000);
}

function gameOver() {
  gameState = 'over';
  timerActive = false;
  roundActive = false;
  finalScore.textContent = `Level ${level} | ${score} Saved | ${stars}⭐`;
  finalScore.style.display = 'block';
  showMessage('Game Over! 💔', true);
}

function resetRound() {
  bees.length = 0;
  lineSegments.length = 0;
  lines.length = 0;
  currentLine = null;
  inkUsed = 0;
  drawing = false;
  lastDrawPoint = null;
  phase = 'draw';
  timerActive = false;
  roundActive = false;
  gameTimer = 0;
  timeLeft = 10;
  frameCount = 0;
  timerEl.textContent = '10';
  inkFill.style.width = '100%';
  inkContainer.classList.add('show');
  drawHint.style.display = 'block';
  drawHint.textContent = 'Draw a line to protect the doge!';
  levelEl.textContent = 'Level ' + level;
  updateUI();
  hideMessage();
  finalScore.style.display = 'none';
}

function startGame() {
  gameState = 'playing';
  level = 1; score = 0; lives = 3; stars = 0;
  startBtn.style.display = 'none';
  startTitle.style.display = 'none';
  startSub.style.display = 'none';
  document.getElementById('hud').style.display = 'flex';
  finalScore.style.display = 'none';
  resetRound();
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  let x, y;
  if (e.touches) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  return { x: x * (canvas.width / rect.width), y: y * (canvas.height / rect.height) };
}

function startDraw(pos) {
  if (phase !== 'draw' || gameState !== 'playing' || drawing) return;
  drawing = true;
  currentLine = { points: [{ x: pos.x, y: pos.y }] };
  lastDrawPoint = pos;
}

function moveDraw(pos) {
  if (!drawing || phase !== 'draw') return;
  const dx = pos.x - lastDrawPoint.x;
  const dy = pos.y - lastDrawPoint.y;
  if (Math.sqrt(dx * dx + dy * dy) > 3 * s) {
    const inkCost = Math.sqrt(dx * dx + dy * dy);
    inkUsed += inkCost;
    const pct = Math.min(inkUsed / MAX_INK, 1);
    inkFill.style.width = (1 - pct) * 100 + '%';
    if (inkUsed >= MAX_INK) {
      endDraw();
      return;
    }
    currentLine.points.push({ x: pos.x, y: pos.y });
    lastDrawPoint = pos;
  }
}

function endDraw() {
  if (!drawing) return;
  drawing = false;
  if (currentLine && currentLine.points.length > 5) {
    for (let i = 0; i < currentLine.points.length - 1; i++) {
      const p1 = currentLine.points[i];
      const p2 = currentLine.points[i + 1];
      lineSegments.push({
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        hp: 8 + Math.floor(level / 2)
      });
    }
    lines.push(currentLine);
    drawHint.textContent = 'Hold on! Protect the doge!';
    phase = 'protect';
    roundActive = true;
    timerActive = true;
  }
  currentLine = null;
}

canvas.addEventListener('mousedown', (e) => { startDraw(getPos(e)); });
canvas.addEventListener('mousemove', (e) => { moveDraw(getPos(e)); });
canvas.addEventListener('mouseup', () => { endDraw(); });
canvas.addEventListener('mouseleave', () => { endDraw(); });

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  startDraw({ x: t.clientX, y: t.clientY });
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  moveDraw({ x: t.clientX, y: t.clientY });
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  endDraw();
}, { passive: false });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function updateUI() {
  let h = '';
  for (let i = 0; i < 3; i++) h += i < lives ? '❤️' : '🖤';
  livesEl.textContent = h;
  scoreEl.textContent = '🐝 ' + score;
  levelEl.textContent = 'Level ' + level;
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

function drawDoge() {
  const x = doge.x, y = doge.y, r = doge.r;
  if (doge.hurtTimer > 0) doge.hurtTimer--;
  const hurt = doge.hurtTimer > 0;

  ctx.save();
  ctx.translate(x, y);
  const earFlap = Math.sin(frameCount * 0.08) * 1.5 * s;

  ctx.save();
  ctx.translate(-r * 0.5, -r * 0.7);
  ctx.fillStyle = '#C4956A';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-r * 0.15, -r * 0.45 + earFlap);
  ctx.lineTo(r * 0.15, -r * 0.4 + earFlap);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F5CBBE';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-r * 0.18, -r * 0.5 + earFlap);
  ctx.lineTo(r * 0.12, -r * 0.45 + earFlap);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(r * 0.5, -r * 0.7);
  ctx.fillStyle = '#C4956A';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-r * 0.15, -r * 0.45 + earFlap);
  ctx.lineTo(r * 0.15, -r * 0.4 + earFlap);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F5CBBE';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-r * 0.12, -r * 0.5 + earFlap);
  ctx.lineTo(r * 0.18, -r * 0.45 + earFlap);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  const bodyColor = hurt ? '#FF6B6B' : '#D4A574';
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.85, r * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F5DEB3';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.35, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#C4956A';
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.15, r * 0.3, r * 0.3, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.25, -r * 0.15, r * 0.3, r * 0.3, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(-r * 0.16, -r * 0.2, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.16, -r * 0.2, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(-r * 0.13, -r * 0.23, r * 0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.19, -r * 0.23, r * 0.02, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.12, 0, Math.PI);
  ctx.fill();

  const tw = Math.sin(frameCount * 0.12) * 1.5 * s;
  ctx.fillStyle = '#FF6B6B';
  ctx.beginPath();
  ctx.ellipse(0 + tw, r * 0.18, r * 0.04, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBee(bee) {
  if (!bee.alive) return;
  const x = bee.x, y = bee.y, r = bee.r;
  const buzz = Math.sin(frameCount * 0.3 + bee.wobble) * 1.5 * s;

  ctx.save();
  ctx.translate(x, y + buzz);

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, 0, r * 0.2, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.28, 0, r * 0.2, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  const w = Math.sin(frameCount * 0.4 + bee.wobble) * 0.25 + 0.5;
  ctx.fillStyle = 'rgba(200,230,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.9, -r * 0.3, r * 0.55, r * 0.15 * w, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.9, -r * 0.3, r * 0.55, r * 0.15 * w, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FF4444';
  ctx.beginPath();
  ctx.arc(-r * 0.45, -r * 0.12, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(-r * 0.46, -r * 0.13, r * 0.02, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(r * 0.5, -r * 0.1);
  ctx.lineTo(r * 0.8, -r * 0.25);
  ctx.stroke();

  ctx.restore();
}

function drawLines() {
  for (const l of lines) {
    if (l.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(l.points[0].x, l.points[0].y);
    for (let i = 1; i < l.points.length; i++) {
      ctx.lineTo(l.points[i].x, l.points[i].y);
    }
    ctx.strokeStyle = '#5C4033';
    ctx.lineWidth = 10 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 3 * s;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawCurrentLine() {
  if (!currentLine || currentLine.points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(currentLine.points[0].x, currentLine.points[0].y);
  for (let i = 1; i < currentLine.points.length; i++) {
    ctx.lineTo(currentLine.points[i].x, currentLine.points[i].y);
  }
  ctx.strokeStyle = '#5C4033';
  ctx.lineWidth = 10 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 3 * s;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawSegmentDamage() {
  for (const seg of lineSegments) {
    if (seg.hp <= 0) continue;
    const maxHp = 8 + Math.floor(level / 2);
    const pct = seg.hp / maxHp;
    if (pct < 0.5) {
      const mx = (seg.x1 + seg.x2) / 2;
      const my = (seg.y1 + seg.y2) / 2;
      ctx.fillStyle = `rgba(255, 50, 50, ${(0.5 - pct) * 0.6})`;
      ctx.beginPath();
      ctx.arc(mx, my, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGround() {
  const gh = GROUND_H * s;
  const grad = ctx.createLinearGradient(0, H - gh, 0, H);
  grad.addColorStop(0, '#66BB6A');
  grad.addColorStop(1, '#388E3C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - gh, W, gh);
  ctx.strokeStyle = '#2E7D32';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(0, H - gh);
  ctx.lineTo(W, H - gh);
  ctx.stroke();
}

function drawClouds() {
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const cs = [
    { x: (frameCount * 0.12) % (W + 200) - 100, y: 50 * s, sx: 1, sy: 1 },
    { x: (frameCount * 0.08 + 300) % (W + 200) - 100, y: 90 * s, sx: 0.7, sy: 0.6 },
    { x: (frameCount * 0.1 + 600) % (W + 200) - 100, y: 30 * s, sx: 1.2, sy: 0.9 },
  ];
  for (const c of cs) {
    const r = 30 * s * c.sx;
    const ry = 16 * s * c.sy;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, ry, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + r * 0.6, c.y - ry * 0.2, r * 0.5, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + r, c.y, r * 0.6, ry * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#4FC3F7');
  grad.addColorStop(0.5, '#81D4FA');
  grad.addColorStop(1, '#B3E5FC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawClouds();
  drawLines();
  if (phase === 'draw') drawCurrentLine();
  drawSegmentDamage();
  for (const bee of bees) drawBee(bee);
  drawGround();
  drawDoge();
}

function update() {
  if (gameState === 'playing' && phase === 'protect' && roundActive) {
    updateBees();
    if (timerActive) {
      gameTimer++;
      if (gameTimer % 60 === 0) {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 0) roundEnd(true);
      }
    }
    const anyAlive = lineSegments.some(s => s.hp > 0);
    if (!anyAlive && lineSegments.length > 0 && roundActive) {
      const danger = bees.some(b => b.alive && dist(b, { x: doge.x, y: doge.y - doge.r * 0.2 }) < doge.r * 1.5);
      if (danger) {
        lives--;
        doge.hurtTimer = 30;
        updateUI();
        if (lives <= 0) gameOver();
      }
    }
  }
  frameCount++;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

resize();
window.addEventListener('resize', resize);
loop();
