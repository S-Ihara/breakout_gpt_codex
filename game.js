const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const restartBtn = document.getElementById('restartBtn');

// Game variables
const INITIAL_LIVES = 3;
const POINTS_PER_BRICK = 10;
let score = 0;
let lives = INITIAL_LIVES;
let gameStarted = false;
let gameOver = false;
let comboCount = 0;
let comboTimer = 0;

// Audio
let audioCtx = null;
let audioUnlocked = false;

// Visual effects
let particles = [];
let shockwaves = [];
let floatingTexts = [];
let ballTrails = [];
let shakeIntensity = 0;
let shakeFrames = 0;
let hitFlashAlpha = 0;

// Paddle properties
const PADDLE_NORMAL_WIDTH = 80;
const PADDLE_WIDE_WIDTH = 140;
const PADDLE_WIDE_DURATION = 600; // frames (~10 seconds at 60fps)
const paddle = {
    width: PADDLE_NORMAL_WIDTH,
    height: 12,
    x: canvas.width / 2 - PADDLE_NORMAL_WIDTH / 2,
    y: canvas.height - 40,
    dx: 0,
    speed: 6
};
let paddleWideTimer = 0;

// Ball initial state constants
const BALL_INITIAL_X = canvas.width / 2;
const BALL_INITIAL_Y = canvas.height - 60;
const BALL_RADIUS = 8;
const BALL_SPEED = 3;

// Balls array (supports multi-ball)
let balls = [];
function resetBall() {
    balls = [{
        x: BALL_INITIAL_X,
        y: BALL_INITIAL_Y,
        radius: BALL_RADIUS,
        dx: BALL_SPEED,
        dy: -BALL_SPEED,
        speed: BALL_SPEED
    }];
}

// Items (power-ups that fall from destroyed bricks)
const ITEM_DROP_CHANCE = 0.3;
const ITEM_SIZE = 16;
const ITEM_SPEED = 2;
const ITEM_TYPES = ['multiball', 'widePaddle', 'beam'];
const ITEM_COLORS = { multiball: '#6BCF7F', widePaddle: '#4ECDC4', beam: '#FF6B6B' };
const ITEM_LABELS = { multiball: '●●', widePaddle: '━━', beam: '⚡' };
let items = [];

// Beams (shots fired upward from paddle)
const BEAM_SPEED = 8;
let beams = [];
let beamAvailable = false;

// Brick properties
const brick = {
    rows: 8,
    cols: 10,
    width: 40,
    height: 20,
    padding: 5,
    offsetTop: 60,
    offsetLeft: 15,
    colors: ['#FF6B6B', '#FF8C42', '#FFA500', '#FFD93D', '#C8E66B', '#6BCF7F', '#4ECDC4', '#4D96FF']
};

// Create bricks array
let bricks = [];
function initBricks() {
    bricks = [];
    for (let row = 0; row < brick.rows; row++) {
        bricks[row] = [];
        for (let col = 0; col < brick.cols; col++) {
            bricks[row][col] = { x: 0, y: 0, status: 1 };
        }
    }

    function initAudio() {
        if (audioCtx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        audioCtx = new AudioContext();
    }

    function unlockAudio() {
        initAudio();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        audioUnlocked = true;
    }

    function playTone({ freq, duration = 0.08, type = 'sine', volume = 0.08, endFreq = null }) {
        if (!audioCtx || !audioUnlocked) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq) {
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
        }
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    function playSound(name) {
        switch (name) {
            case 'brick':
                playTone({ freq: 520, endFreq: 760, duration: 0.05, type: 'square', volume: 0.05 });
                break;
            case 'paddle':
                playTone({ freq: 220, endFreq: 340, duration: 0.07, type: 'triangle', volume: 0.06 });
                break;
            case 'wall':
                playTone({ freq: 170, endFreq: 120, duration: 0.05, type: 'sine', volume: 0.04 });
                break;
            case 'item':
                playTone({ freq: 440, duration: 0.05, type: 'triangle', volume: 0.06 });
                playTone({ freq: 660, duration: 0.07, type: 'triangle', volume: 0.05 });
                break;
            case 'beam':
                playTone({ freq: 300, endFreq: 1200, duration: 0.12, type: 'sawtooth', volume: 0.04 });
                break;
            case 'loseLife':
                playTone({ freq: 300, endFreq: 120, duration: 0.2, type: 'sawtooth', volume: 0.07 });
                break;
            case 'clear':
                playTone({ freq: 523, duration: 0.1, type: 'triangle', volume: 0.06 });
                playTone({ freq: 659, duration: 0.13, type: 'triangle', volume: 0.06 });
                playTone({ freq: 784, duration: 0.18, type: 'triangle', volume: 0.06 });
                break;
            default:
                break;
        }
    }

    function addShake(intensity, frames) {
        shakeIntensity = Math.max(shakeIntensity, intensity);
        shakeFrames = Math.max(shakeFrames, frames);
    }

    function addHitFlash(alpha = 0.25) {
        hitFlashAlpha = Math.min(0.45, Math.max(hitFlashAlpha, alpha));
    }

    function spawnShockwave(x, y, color) {
        shockwaves.push({ x, y, radius: 4, maxRadius: 40, life: 14, color });
    }

    function spawnBrickParticles(x, y, color) {
        const count = 14;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
            const speed = 1 + Math.random() * 3.2;
            particles.push({
                x,
                y,
                dx: Math.cos(angle) * speed,
                dy: Math.sin(angle) * speed - 0.3,
                size: 2 + Math.random() * 2.5,
                life: 26 + Math.floor(Math.random() * 12),
                color
            });
        }
    }

    function addFloatingText(text, x, y, color = '#fff') {
        floatingTexts.push({ text, x, y, dy: -1.1, life: 55, color });
    }

    function triggerVibration(pattern) {
        if (navigator.vibrate) navigator.vibrate(pattern);
    }
}

// Draw balls
function drawBalls() {
    balls.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#9be7ff';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.closePath();
        ctx.shadowBlur = 0;
    });
}

function drawBallTrails() {
    ballTrails.forEach(trail => {
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(155, 231, 255, ${trail.life / 18})`;
        ctx.fill();
        ctx.closePath();
    });
}

// Draw paddle
function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = paddleWideTimer > 0 ? '#4ECDC4' : '#fff';
    ctx.fill();
    ctx.closePath();
}

// Draw bricks
function drawBricks() {
    for (let row = 0; row < brick.rows; row++) {
        for (let col = 0; col < brick.cols; col++) {
            if (bricks[row][col].status === 1) {
                const brickX = col * (brick.width + brick.padding) + brick.offsetLeft;
                const brickY = row * (brick.height + brick.padding) + brick.offsetTop;
                bricks[row][col].x = brickX;
                bricks[row][col].y = brickY;

                ctx.beginPath();
                ctx.rect(brickX, brickY, brick.width, brick.height);
                ctx.fillStyle = brick.colors[row];
                ctx.fill();
                ctx.closePath();
            }
        }
    }
}

// Draw falling items
function drawItems() {
    items.forEach(item => {
        ctx.beginPath();
        ctx.arc(item.x + ITEM_SIZE / 2, item.y + ITEM_SIZE / 2, ITEM_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = ITEM_COLORS[item.type];
        ctx.fill();
        ctx.closePath();
        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(ITEM_LABELS[item.type], item.x + ITEM_SIZE / 2, item.y + ITEM_SIZE / 2 + 3);
    });
}

// Draw beams
function drawBeams() {
    beams.forEach(beam => {
        ctx.beginPath();
        ctx.rect(beam.x, beam.y, beam.width, beam.height);
        ctx.fillStyle = '#FF6B6B';
        ctx.fill();
        ctx.closePath();
    });
}

// Draw score and lives
function drawInfo() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
}

// Draw beam ready indicator at bottom of canvas
function drawBeamIndicator() {
    if (beamAvailable) {
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#FF6B6B';
        ctx.textAlign = 'left';
        ctx.fillText('⚡ BEAM READY [Space]', 8, canvas.height - 8);
    }

    function drawParticles() {
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
    }

    function drawShockwaves() {
        shockwaves.forEach(sw => {
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${sw.color}, ${sw.life / 14})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();
        });
    }

    function drawFloatingTexts() {
        floatingTexts.forEach(ft => {
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = ft.color;
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
        });
    }

    function drawHitFlash() {
        if (hitFlashAlpha <= 0) return;
        ctx.fillStyle = `rgba(255, 255, 255, ${hitFlashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Destroy a brick, add score, and possibly drop an item
function destroyBrick(row, col) {
    const targetBrick = bricks[row][col];
    targetBrick.status = 0;
    score += POINTS_PER_BRICK;
    comboCount++;
    comboTimer = 120;
    playSound('brick');
    spawnBrickParticles(targetBrick.x + brick.width / 2, targetBrick.y + brick.height / 2, brick.colors[row]);
    spawnShockwave(targetBrick.x + brick.width / 2, targetBrick.y + brick.height / 2, '255, 255, 255');
    addFloatingText(`+${POINTS_PER_BRICK}`, targetBrick.x + brick.width / 2, targetBrick.y + 4, '#fff');
    addShake(3, 8);
    addHitFlash(0.15);
    triggerVibration(8);

    if (comboCount >= 3 && comboCount % 3 === 0) {
        addFloatingText(`x${comboCount} COMBO!`, canvas.width / 2, canvas.height - 70, '#FFD93D');
    }

    // Drop item with set probability
    if (Math.random() < ITEM_DROP_CHANCE) {
        const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
        items.push({
            x: targetBrick.x + brick.width / 2 - ITEM_SIZE / 2,
            y: targetBrick.y,
            type
        });
    }

    // Check if all bricks are destroyed
    let remaining = 0;
    for (let r = 0; r < brick.rows; r++) {
        for (let c = 0; c < brick.cols; c++) {
            if (bricks[r][c].status === 1) remaining++;
        }
    }
    if (remaining === 0) {
        playSound('clear');
        addShake(8, 20);
        addHitFlash(0.35);
        triggerVibration([30, 25, 30]);
        drawWinMessage();
        gameOver = true;
    }
}

// Collision detection: ball vs bricks
function ballBrickCollision(b) {
    for (let row = 0; row < brick.rows; row++) {
        for (let col = 0; col < brick.cols; col++) {
            const br = bricks[row][col];
            if (br.status === 1 &&
                b.x + b.radius > br.x &&
                b.x - b.radius < br.x + brick.width &&
                b.y + b.radius > br.y &&
                b.y - b.radius < br.y + brick.height) {
                b.dy = -b.dy;
                destroyBrick(row, col);
                return;
            }
        }
    }
}

// Collision detection: beam vs bricks; returns true if beam is consumed
function beamBrickCollision(beam) {
    for (let row = 0; row < brick.rows; row++) {
        for (let col = 0; col < brick.cols; col++) {
            const br = bricks[row][col];
            if (br.status === 1 &&
                beam.x + beam.width > br.x &&
                beam.x < br.x + brick.width &&
                beam.y < br.y + brick.height &&
                beam.y + beam.height > br.y) {
                destroyBrick(row, col);
                return true;
            }
        }
    }
    return false;
}

// Apply a collected item's effect
function applyItem(type) {
    playSound('item');
    addFloatingText(`GET ${ITEM_LABELS[type]}`, paddle.x + paddle.width / 2, paddle.y - 6, ITEM_COLORS[type]);
    spawnShockwave(paddle.x + paddle.width / 2, paddle.y + paddle.height / 2, '120, 230, 255');
    addHitFlash(0.2);
    triggerVibration(12);

    if (type === 'multiball') {
        const ref = balls[0] || { x: BALL_INITIAL_X, y: BALL_INITIAL_Y, radius: BALL_RADIUS, dx: BALL_SPEED, dy: -BALL_SPEED, speed: BALL_SPEED };
        balls.push({
            x: ref.x,
            y: ref.y,
            radius: ref.radius,
            dx: -ref.dx,
            dy: ref.dy,
            speed: ref.speed
        });
    } else if (type === 'widePaddle') {
        paddle.width = PADDLE_WIDE_WIDTH;
        paddleWideTimer = PADDLE_WIDE_DURATION;
    } else if (type === 'beam') {
        beamAvailable = true;
    }
}

// Update balls
function updateBalls() {
    if (!gameStarted || gameOver) return;

    balls = balls.filter(b => {
        ballTrails.push({ x: b.x, y: b.y, radius: Math.max(1.5, b.radius * 0.7), life: 18 });
        b.x += b.dx;
        b.y += b.dy;

        // Wall collision (left and right)
        if (b.x + b.radius > canvas.width || b.x - b.radius < 0) {
            b.dx = -b.dx;
            playSound('wall');
            addShake(2, 5);
            spawnShockwave(Math.max(b.radius, Math.min(canvas.width - b.radius, b.x)), b.y, '255, 255, 255');
        }

        // Wall collision (top)
        if (b.y - b.radius < 0) {
            b.dy = -b.dy;
            playSound('wall');
            addShake(1.5, 4);
        }

        // Paddle collision
        if (b.y + b.radius > paddle.y &&
            b.y + b.radius < paddle.y + paddle.height + b.radius &&
            b.x > paddle.x &&
            b.x < paddle.x + paddle.width) {
            const hitPos = (b.x - paddle.x) / paddle.width;
            b.dx = (hitPos - 0.5) * b.speed * 2;
            if (Math.abs(b.dx) < 1) {
                b.dx = b.dx >= 0 ? 1 : -1;
            }
            b.dy = -Math.abs(b.dy);
            playSound('paddle');
            addShake(2.5, 6);
            addHitFlash(0.12);
            spawnShockwave(b.x, paddle.y, '140, 220, 255');
            triggerVibration(6);
        }

        // Brick collision
        ballBrickCollision(b);

        // Remove ball if it fell off the bottom
        return b.y - b.radius < canvas.height;
    });

    // All balls lost
    if (balls.length === 0 && !gameOver) {
        lives--;
        beamAvailable = false;
        comboCount = 0;
        comboTimer = 0;
        playSound('loseLife');
        addShake(8, 18);
        addHitFlash(0.35);
        addFloatingText('MISS!', canvas.width / 2, canvas.height / 2, '#FF6B6B');
        triggerVibration([30, 20, 30]);
        if (lives === 0) {
            drawGameOverMessage();
            gameOver = true;
        } else {
            resetBall();
            gameStarted = false;
        }
    }
}

// Update paddle position and wide-paddle timer
function updatePaddle() {
    paddle.x += paddle.dx;

    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;

    if (paddleWideTimer > 0) {
        paddleWideTimer--;
        if (paddleWideTimer === 0) {
            paddle.width = PADDLE_NORMAL_WIDTH;
            if (paddle.x + paddle.width > canvas.width) {
                paddle.x = canvas.width - paddle.width;
            }
        }
    }
}

// Update falling items
function updateItems() {
    items = items.filter(item => {
        item.y += ITEM_SPEED;

        // Caught by paddle
        if (item.y + ITEM_SIZE > paddle.y &&
            item.x + ITEM_SIZE > paddle.x &&
            item.x < paddle.x + paddle.width) {
            applyItem(item.type);
            return false;
        }

        return item.y < canvas.height;
    });
}

// Update beams
function updateBeams() {
    beams = beams.filter(beam => {
        beam.y -= BEAM_SPEED;
        if (beam.y + beam.height < 0) return false;
        if (beamBrickCollision(beam)) return false;
        return true;
    });
}

function updateEffects() {
    particles = particles.filter(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.dy += 0.06;
        p.life--;
        return p.life > 0;
    });

    shockwaves = shockwaves.filter(sw => {
        sw.radius += (sw.maxRadius - sw.radius) * 0.25;
        sw.life--;
        return sw.life > 0;
    });

    floatingTexts = floatingTexts.filter(ft => {
        ft.y += ft.dy;
        ft.life--;
        return ft.life > 0;
    });

    ballTrails = ballTrails.filter(trail => {
        trail.life--;
        trail.radius *= 0.97;
        return trail.life > 0;
    });

    if (shakeFrames > 0) {
        shakeFrames--;
        shakeIntensity *= 0.88;
    } else {
        shakeIntensity = 0;
    }

    hitFlashAlpha *= 0.86;
    if (hitFlashAlpha < 0.02) hitFlashAlpha = 0;

    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) {
            comboCount = 0;
        }
    }
}

// Fire beam from paddle center
function fireBeam() {
    if (!beamAvailable || !gameStarted || gameOver) return;
    beamAvailable = false;
    playSound('beam');
    addShake(3, 6);
    spawnShockwave(paddle.x + paddle.width / 2, paddle.y, '255, 140, 140');
    triggerVibration(10);
    beams.push({
        x: paddle.x + paddle.width / 2 - 3,
        y: paddle.y,
        width: 6,
        height: 15
    });
}

// Draw win message
function drawWinMessage() {
    ctx.font = '40px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText('クリア！', canvas.width / 2, canvas.height / 2);
    ctx.font = '20px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('スコア: ' + score, canvas.width / 2, canvas.height / 2 + 40);
}

// Draw game over message
function drawGameOverMessage() {
    ctx.font = '40px Arial';
    ctx.fillStyle = '#FF6B6B';
    ctx.textAlign = 'center';
    ctx.fillText('ゲームオーバー', canvas.width / 2, canvas.height / 2);
    ctx.font = '20px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('スコア: ' + score, canvas.width / 2, canvas.height / 2 + 40);
}

// Draw start message
function drawStartMessage() {
    ctx.font = '20px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('スペースキーまたはタップで開始', canvas.width / 2, canvas.height / 2);
}

// Main draw function
function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const offsetX = shakeFrames > 0 ? (Math.random() - 0.5) * shakeIntensity : 0;
    const offsetY = shakeFrames > 0 ? (Math.random() - 0.5) * shakeIntensity : 0;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    drawBricks();
    drawShockwaves();
    drawBallTrails();
    drawBalls();
    drawPaddle();
    drawItems();
    drawBeams();
    drawParticles();
    drawFloatingTexts();
    drawBeamIndicator();
    drawHitFlash();
    drawInfo();

    if (!gameStarted && !gameOver) {
        drawStartMessage();
    }
    ctx.restore();

    updateBalls();
    updatePaddle();
    updateItems();
    updateBeams();
    updateEffects();

    requestAnimationFrame(draw);
}

// Keyboard controls
function startGame(e) {
    if (e) e.preventDefault();
    unlockAudio();
    if (!gameOver) {
        gameStarted = true;
    }
}

function keyDown(e) {
    unlockAudio();
    if (e.key === 'Right' || e.key === 'ArrowRight') {
        e.preventDefault();
        paddle.dx = paddle.speed;
    } else if (e.key === 'Left' || e.key === 'ArrowLeft') {
        e.preventDefault();
        paddle.dx = -paddle.speed;
    } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (gameStarted && beamAvailable) {
            fireBeam();
        } else {
            startGame();
        }
    }
}

function keyUp(e) {
    if (e.key === 'Right' || e.key === 'ArrowRight' ||
        e.key === 'Left' || e.key === 'ArrowLeft') {
        paddle.dx = 0;
    }
}

// Mouse/Touch controls
function mouseMoveHandler(e) {
    const rect = canvas.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
    }
}

function touchMoveHandler(e) {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const relativeX = touch.clientX - rect.left;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
    }
    e.preventDefault();
}

// Restart game
function restartGame() {
    score = 0;
    lives = INITIAL_LIVES;
    gameStarted = false;
    gameOver = false;
    items = [];
    beams = [];
    particles = [];
    shockwaves = [];
    floatingTexts = [];
    ballTrails = [];
    comboCount = 0;
    comboTimer = 0;
    shakeIntensity = 0;
    shakeFrames = 0;
    hitFlashAlpha = 0;
    beamAvailable = false;
    paddleWideTimer = 0;
    paddle.width = PADDLE_NORMAL_WIDTH;
    paddle.x = canvas.width / 2 - PADDLE_NORMAL_WIDTH / 2;
    resetBall();
    initBricks();
}

// Event listeners
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);
canvas.addEventListener('mousemove', mouseMoveHandler);
canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });
canvas.addEventListener('touchstart', startGame, { passive: false });
canvas.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

// Initialize and start game
initBricks();
resetBall();
draw();
