const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const startTitle = document.getElementById('start-title');
const startSub = document.getElementById('start-sub');
const livesEl = document.getElementById('lives');

let W, H, scale;
let gameState = 'menu';
let score = 0;
let lives = 3;
let timeLeft = 10;
let frameCount = 0;

const lines = [];
const bees = [];
const doge = { x: 0, y: 0, r: 0 };
const GROUND_H = 60;
const DOGE_SIZE = 40;
const BEE_SIZE = 18;
const SPAWN_RATE = 60;
const MAX_BEES = 8;

let drawing = false;
let currentLine = null;
let lastDrawPoint = null;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  scale = Math.min(W, H) / 800;
  doge.x = W / 2;
  doge.y = H - GROUND_H * scale - DOGE_SIZE * scale;
  doge.r = DOGE_SIZE * scale;
}

function getRandomBeeTarget() {
  return {
    x: doge.x + (Math.random() - 0.5) * 60 * scale,
    y: doge.y + 10 * scale
  };
}

function spawnBee() {
  if (bees.length >= MAX_BEES) return;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  switch (side) {
    case 0: x = Math.random() * W; y = -30 * scale; break;
    case 1: x = W + 30 * scale; y = Math.random() * H * 0.5; break;
    case 2: x = Math.random() * W; y = -30 * scale; break;
    case 3: x = -30 * scale; y = Math.random() * H * 0.5; break;
  }
  const target = getRandomBeeTarget();
  bees.push({
    x, y,
    vx: 0, vy: 0,
    target,
    r: BEE_SIZE * scale,
    speed: (1.5 + Math.random() * 1.5) * scale,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.02 + Math.random() * 0.02,
    stuck: 0
  });
}

function beeHitLine(bee, l) {
  for (let i = 0; i < l.points.length - 1; i++) {
    const ax = l.points[i].x, ay = l.points[i].y;
    const bx = l.points[i + 1].x, by = l.points[i + 1].y;
    const dx = bx - ax, dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const t = Math.max(0, Math.min(1, ((bee.x - ax) * dx + (bee.y - ay) * dy) / (len * len)));
    const px = ax + t * dx, py = ay + t * dy;
    const d = Math.sqrt((bee.x - px) ** 2 + (bee.y - py) ** 2);
    if (d < bee.r + 4 * scale) return true;
  }
  return false;
}

function updateBees() {
  for (const bee of bees) {
    if (bee.stuck > 0) {
      bee.stuck--;
      continue;
    }
    bee.wobble += bee.wobbleSpeed;
    const wobbleX = Math.sin(bee.wobble) * 2 * scale;
    const wobbleY = Math.cos(bee.wobble) * 1.5 * scale;
    const dx = bee.target.x - bee.x + wobbleX;
    const dy = bee.target.y - bee.y + wobbleY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5 * scale) {
      bee.vx += (dx / dist) * 0.2;
      bee.vy += (dy / dist) * 0.2;
      const maxSpeed = bee.speed;
      const spd = Math.sqrt(bee.vx * bee.vx + bee.vy * bee.vy);
      if (spd > maxSpeed) {
        bee.vx = (bee.vx / spd) * maxSpeed;
        bee.vy = (bee.vy / spd) * maxSpeed;
      }
      bee.x += bee.vx;
      bee.y += bee.vy;
    }
    let hitLine = false;
    for (const l of lines) {
      if (beeHitLine(bee, l)) {
        hitLine = true;
        break;
      }
    }
    if (hitLine) {
      bee.stuck = 20;
      bee.vx *= -0.5;
      bee.vy *= -0.5;
      bee.x += bee.vx;
      bee.y += bee.vy;
    }
    bee.target = getRandomBeeTarget();
  }
  for (let i = bees.length - 1; i >= 0; i--) {
    const bee = bees[i];
    const dx = bee.x - doge.x;
    const dy = bee.y - doge.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < doge.r + bee.r) {
      bees.splice(i, 1);
      lives--;
      updateLives();
      if (lives <= 0) {
        gameOver();
        return;
      }
    }
  }
}

function drawDoge() {
  const x = doge.x, y = doge.y, r = doge.r;
  const s = scale;
  ctx.save();
  ctx.translate(x, y);

  const tongueWag = Math.sin(frameCount * 0.15) * 2 * s;
  const tailWag = Math.sin(frameCount * 0.2) * 0.3;

  ctx.save();
  ctx.translate(-r * 0.6, -r * 0.8);
  ctx.rotate(tailWag);
  ctx.fillStyle = '#C4956A';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.5, r * 0.5, r * 0.15, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#D4A574';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#C4956A';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.3, r * 0.3, r * 0.35, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.35, -r * 0.3, r * 0.3, r * 0.35, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8B6F47';
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.12, r * 0.15, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.25, -r * 0.3, r * 0.12, r * 0.15, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.38, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.2, -r * 0.38, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(-r * 0.17, -r * 0.41, r * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.23, -r * 0.41, r * 0.03, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FF9E9E';
  ctx.beginPath();
  ctx.arc(0, r * 0.15, r * 0.08, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = '#FF6B6B';
  ctx.beginPath();
  ctx.ellipse(0 + tongueWag, r * 0.2, r * 0.06, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBee(bee) {
  const x = bee.x, y = bee.y, r = bee.r;
  const s = scale;
  const buzz = Math.sin(frameCount * 0.3 + bee.wobble) * 2 * s;

  ctx.save();
  ctx.translate(x, y + buzz);

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, 0, r * 0.25, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.3, 0, r * 0.25, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const wingFlap = Math.sin(frameCount * 0.4 + bee.wobble) * 0.3 + 0.5;
  ctx.fillStyle = 'rgba(200,230,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-r * 1.1, -r * 0.3, r * 0.6, r * 0.2 * wingFlap, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 1.1, -r * 0.3, r * 0.6, r * 0.2 * wingFlap, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FF4444';
  ctx.beginPath();
  ctx.arc(-r * 0.5, -r * 0.15, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(r * 0.5, -r * 0.1);
  ctx.lineTo(r * 0.8, -r * 0.3);
  ctx.stroke();

  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(-r * 0.5, -r * 0.15, r * 0.04, 0, Math.PI * 2);
  ctx.fill();

  if (bee.stuck > 0) {
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

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
    ctx.strokeStyle = l.color;
    ctx.lineWidth = l.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4 * scale;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawGround() {
  const gh = GROUND_H * scale;
  const grad = ctx.createLinearGradient(0, H - gh, 0, H);
  grad.addColorStop(0, '#4CAF50');
  grad.addColorStop(1, '#388E3C');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - gh, W, gh);

  ctx.strokeStyle = '#2E7D32';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(0, H - gh);
  ctx.lineTo(W, H - gh);
  ctx.stroke();

  for (let i = 0; i < W; i += 40 * scale) {
    const gx = i + Math.sin(i * 0.1) * 5 * scale;
    ctx.fillStyle = '#66BB6A';
    ctx.beginPath();
    ctx.moveTo(gx, H - gh);
    ctx.lineTo(gx + 10 * scale, H - gh + 8 * scale);
    ctx.lineTo(gx - 5 * scale, H - gh + 8 * scale);
    ctx.fill();
  }
}

function drawClouds() {
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const clouds = [
    { x: (frameCount * 0.2) % (W + 200) - 100, y: 60 * scale, s: 1 },
    { x: (frameCount * 0.15 + 300) % (W + 200) - 100, y: 100 * scale, s: 0.8 },
    { x: (frameCount * 0.25 + 600) % (W + 200) - 100, y: 40 * scale, s: 1.2 }
  ];
  for (const c of clouds) {
    const r = 30 * scale * c.s;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.arc(c.x + r * 0.8, c.y - r * 0.3, r * 0.7, 0, Math.PI * 2);
    ctx.arc(c.x + r * 1.2, c.y, r * 0.8, 0, Math.PI * 2);
    ctx.arc(c.x + r * 0.5, c.y + r * 0.2, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBeehive() {
  const hx = W * 0.85, hy = H * 0.15;
  const hs = 40 * scale;
  ctx.fillStyle = '#D4A017';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3 - row; col++) {
      const ox = (row % 2) * hs * 0.5;
      ctx.beginPath();
      ctx.ellipse(hx + col * hs + ox - hs, hy + row * hs * 0.8, hs * 0.5, hs * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 2 * scale;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3 - row; col++) {
      const ox = (row % 2) * hs * 0.5;
      ctx.beginPath();
      ctx.ellipse(hx + col * hs + ox - hs, hy + row * hs * 0.8, hs * 0.5, hs * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#F5DEB3';
  ctx.font = `${20 * scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('🏠', hx - hs * 0.5, hy + hs * 0.5);
}

function updateLives() {
  let hearts = '';
  for (let i = 0; i < lives; i++) hearts += '❤️';
  livesEl.textContent = hearts;
}

function showMessage(text, isGameOver = false) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  if (isGameOver) {
    restartBtn.style.display = 'block';
  }
}

function hideMessage() {
  messageEl.classList.remove('show');
  restartBtn.style.display = 'none';
}

function gameOver() {
  gameState = 'over';
  showMessage('Game Over!\nSaved: ' + score + ' doges', true);
}

function resetRound() {
  timeLeft = 10;
  bees.length = 0;
  lines.length = 0;
  drawing = false;
  currentLine = null;
  lastDrawPoint = null;
  hideMessage();
  timerEl.textContent = timeLeft;
}

function startGame() {
  gameState = 'playing';
  score = 0;
  lives = 3;
  scoreEl.textContent = '🐝 0';
  updateLives();
  resetRound();
  startBtn.style.display = 'none';
  startTitle.style.display = 'none';
  startSub.style.display = 'none';
}

function roundComplete() {
  score++;
  scoreEl.textContent = '🐝 ' + score;
  if (lives < 3) lives++;
  updateLives();
  showMessage('Round ' + score + ' - Saved! 🎉');
  gameState = 'between';
  setTimeout(() => {
    if (gameState === 'between') {
      resetRound();
      gameState = 'playing';
    }
  }, 1500);
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

canvas.addEventListener('mousedown', (e) => {
  if (gameState !== 'playing') return;
  drawing = true;
  const pos = getPos(e);
  currentLine = { points: [pos], color: '#555', width: 8 * scale };
  lastDrawPoint = pos;
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing || gameState !== 'playing') return;
  const pos = getPos(e);
  const dx = pos.x - lastDrawPoint.x;
  const dy = pos.y - lastDrawPoint.y;
  if (Math.sqrt(dx * dx + dy * dy) > 5 * scale) {
    currentLine.points.push(pos);
    lastDrawPoint = pos;
  }
});

canvas.addEventListener('mouseup', () => {
  if (!drawing) return;
  drawing = false;
  if (currentLine && currentLine.points.length > 1) {
    lines.push(currentLine);
  }
  currentLine = null;
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState !== 'playing') return;
  drawing = true;
  const pos = getPos(e);
  currentLine = { points: [pos], color: '#555', width: 8 * scale };
  lastDrawPoint = pos;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!drawing || gameState !== 'playing') return;
  const pos = getPos(e);
  const dx = pos.x - lastDrawPoint.x;
  const dy = pos.y - lastDrawPoint.y;
  if (Math.sqrt(dx * dx + dy * dy) > 5 * scale) {
    currentLine.points.push(pos);
    lastDrawPoint = pos;
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!drawing) return;
  drawing = false;
  if (currentLine && currentLine.points.length > 1) {
    lines.push(currentLine);
  }
  currentLine = null;
}, { passive: false });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
  startGame();
});

resize();
window.addEventListener('resize', resize);

function update() {
  if (gameState === 'playing') {
    if (frameCount % Math.max(SPAWN_RATE, 60 - score * 2) === 0) {
      spawnBee();
    }
    updateBees();
    if (frameCount % 60 === 0) {
      timeLeft--;
      timerEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        roundComplete();
      }
    }
  }
  frameCount++;
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#87CEEB');
  grad.addColorStop(0.7, '#B0E0E6');
  grad.addColorStop(1, '#E0F7FA');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawClouds();
  drawBeehive();
  drawLines();

  if (currentLine && currentLine.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(currentLine.points[0].x, currentLine.points[0].y);
    for (let i = 1; i < currentLine.points.length; i++) {
      ctx.lineTo(currentLine.points[i].x, currentLine.points[i].y);
    }
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 8 * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4 * scale;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (const bee of bees) {
    drawBee(bee);
  }

  drawGround();
  drawDoge();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
