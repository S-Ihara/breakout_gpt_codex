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

// Ball properties
const ball = {
    x: canvas.width / 2,
    y: canvas.height - 60,
    radius: 8,
    dx: 3,
    dy: -3,
    speed: 3
};

// Paddle properties
const paddle = {
    width: 80,
    height: 12,
    x: canvas.width / 2 - 40,
    y: canvas.height - 40,
    dx: 0,
    speed: 6
};

// Brick properties
const brick = {
    rows: 6,
    cols: 8,
    width: 55,
    height: 20,
    padding: 5,
    offsetTop: 60,
    offsetLeft: 15,
    colors: ['#FF6B6B', '#FFA500', '#FFD93D', '#6BCF7F', '#4ECDC4', '#4D96FF']
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
}

// Draw ball
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();
}

// Draw paddle
function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = '#fff';
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

// Draw score and lives
function drawInfo() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
}

// Collision detection with bricks
function collisionDetection() {
    for (let row = 0; row < brick.rows; row++) {
        for (let col = 0; col < brick.cols; col++) {
            const b = bricks[row][col];
            if (b.status === 1) {
                if (ball.x + ball.radius > b.x && 
                    ball.x - ball.radius < b.x + brick.width && 
                    ball.y + ball.radius > b.y && 
                    ball.y - ball.radius < b.y + brick.height) {
                    ball.dy = -ball.dy;
                    b.status = 0;
                    score += POINTS_PER_BRICK;
                    
                    // Check if all bricks are destroyed
                    if (score === brick.rows * brick.cols * POINTS_PER_BRICK) {
                        drawWinMessage();
                        gameOver = true;
                    }
                }
            }
        }
    }
}

// Update ball position
function updateBall() {
    if (!gameStarted || gameOver) return;
    
    ball.x += ball.dx;
    ball.y += ball.dy;
    
    // Wall collision (left and right)
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.dx = -ball.dx;
    }
    
    // Wall collision (top)
    if (ball.y - ball.radius < 0) {
        ball.dy = -ball.dy;
    }
    
    // Paddle collision
    if (ball.y + ball.radius > paddle.y && 
        ball.x > paddle.x && 
        ball.x < paddle.x + paddle.width) {
        // Add some variation based on where the ball hits the paddle
        const hitPos = (ball.x - paddle.x) / paddle.width;
        ball.dx = (hitPos - 0.5) * ball.speed * 2;
        // Ensure minimum horizontal velocity to prevent straight up/down bouncing
        if (Math.abs(ball.dx) < 1) {
            ball.dx = ball.dx >= 0 ? 1 : -1;
        }
        ball.dy = -Math.abs(ball.dy);
    }
    
    // Ball falls below paddle
    if (ball.y + ball.radius > canvas.height) {
        lives--;
        if (lives === 0) {
            drawGameOverMessage();
            gameOver = true;
        } else {
            resetBall();
            gameStarted = false;
        }
    }
    
    collisionDetection();
}

// Update paddle position
function updatePaddle() {
    paddle.x += paddle.dx;
    
    // Keep paddle within canvas
    if (paddle.x < 0) {
        paddle.x = 0;
    }
    if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }
}

// Reset ball position
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 60;
    ball.dx = ball.speed;
    ball.dy = -ball.speed;
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
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBricks();
    drawBall();
    drawPaddle();
    drawInfo();
    
    if (!gameStarted && !gameOver) {
        drawStartMessage();
    }
    
    updateBall();
    updatePaddle();
    
    requestAnimationFrame(draw);
}

// Keyboard controls
function startGame(e) {
    if (e) {
        e.preventDefault();
    }
    if (!gameOver) {
        gameStarted = true;
    }
}

function keyDown(e) {
    if (e.key === 'Right' || e.key === 'ArrowRight') {
        paddle.dx = paddle.speed;
    } else if (e.key === 'Left' || e.key === 'ArrowLeft') {
        paddle.dx = -paddle.speed;
    } else if (e.key === ' ' || e.key === 'Spacebar') {
        startGame();
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
    resetBall();
    initBricks();
    paddle.x = canvas.width / 2 - paddle.width / 2;
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
draw();
