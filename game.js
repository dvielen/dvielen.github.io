const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 400;
canvas.height = 600;

let gravity = 800; // Gravity in pixels per second^2
let platformSpeed = 100; // Initial speed at which platforms move down (pixels per second)
const maxPlatformSpeed = 300; // Maximum speed for platforms (pixels per second)
let platformWidth = 100; // Initial platform width
let platformHeight = 30; // Platform height
const platformGap = 120; // Vertical gap between platforms
let numPlatforms = Math.ceil(canvas.height / platformGap) + 1;

let animationId;
let gameOver = false;
let gameStarted = false; // Track if the game has started
let gameStartTime = null;
const gracePeriod = 3000; // 3 seconds in milliseconds
let score = 0;
let coinCount = 0; // Track the number of coins collected
let coinSpawnInterval = 3000; // Time interval for new coin spawn (in ms)
const effects = []; // Array to store visual effects like "+10"
const levelTexts = []; // Array to store level-up text effects
let lastTime = 0; // Time of the previous frame
let milestonesReached = 0; // Track how many milestones have been reached
let debugMode = false; // Track if debug mode is active
let currentLevel = 1; // Track the current level

let isJumping = false;
let jumpStartTime = null;
const maxJumpDuration = 1300; // Maximum time the jump can be held (in ms)
const playerMaxJumpPower = 600; // Player's maximum jump power, should be above the max platform speed

const IMAGES = {
    player: new Image(),
    platform: new Image(),
    coinGold: new Image(),
    coinSilver: new Image(),
    coinBlue: new Image(),
    coinGreen: new Image(),
    cloud: new Image(),
    startScreen: new Image(),  // Add this line
    resultScreen: new Image()   // Add this line
};

IMAGES.player.src = 'images/box.png';
IMAGES.platform.src = 'path/to/platform.png';
IMAGES.coinGold.src = 'path/to/coin_gold.png';
IMAGES.coinSilver.src = 'path/to/coin_silver.png';
IMAGES.coinBlue.src = 'path/to/coin_blue.png';
IMAGES.coinGreen.src = 'path/to/coin_green.png';
IMAGES.cloud.src = 'images/cloud.png';
IMAGES.startScreen.src = 'images/box_hackathon.png';
IMAGES.resultScreen.src = 'images/box_hackathon.png';

class Player {
    constructor() {
        this.width = 57;
        this.height = 50;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = 0;
        this.dy = 0;
        this.dx = 0;
        this.speed = 300;
        this.baseJumpPower = 450;
        this.maxJumpPower = 750;
        this.jumping = false;
    }

    draw() {
        ctx.fillStyle = "red";
        ctx.drawImage(IMAGES.player, this.x, this.y, this.width, this.height);
    }

    update(deltaTime) {
        this.dy += gravity * deltaTime;
        this.y += this.dy * deltaTime;
        this.x += this.dx * deltaTime;

        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
        } else if (this.x < 0) {
            this.x = 0;
        }

        const elapsedTime = Date.now() - gameStartTime;
        if (elapsedTime > gracePeriod && this.y > canvas.height) {
            endGame();
        }

        this.draw();
    }

    moveLeft() {
        this.dx = -this.speed;
    }

    moveRight() {
        this.dx = this.speed;
    }

    stopMoving() {
        this.dx = 0;
    }

    jump() {
        if (!this.jumping && this.dy >= 0) {
            this.dy = -this.baseJumpPower;
            this.jumping = true;
            isJumping = true;
            jumpStartTime = Date.now();
        }
    }

    continueJump(deltaTime) {
        if (isJumping && this.jumping) {
            const elapsedJumpTime = Date.now() - jumpStartTime;
            if (elapsedJumpTime < maxJumpDuration) {
                const jumpForce = (this.maxJumpPower - this.baseJumpPower) / (maxJumpDuration / 10) * deltaTime;
                this.dy -= jumpForce;
            } else {
                isJumping = false; // Stop jumping if max jump duration is reached
            }
        }
    }

    endJump() {
        isJumping = false; // Stop the jump when the spacebar is released
        this.jumping = false;
    }

    land(platformSpeed) {
        this.jumping = false;
        this.dy = platformSpeed; // Set the player's vertical speed to match the platform's speed
    }

    collectCoin(coin) {
        if (
            this.x < coin.x + coin.width &&
            this.x + this.width > coin.x &&
            this.y < coin.y + coin.height &&
            this.y + this.height > coin.y
        ) {
            coinCount++;
            return true;
        }
        return false;
    }
}


class Platform {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.width = platformWidth;
        this.height = platformHeight;
        this.speed = speed || platformSpeed; // Speed in pixels per second
    }

    draw() {
        ctx.fillStyle = "brown";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update(deltaTime) {
        this.y += this.speed * deltaTime; // Move the platform down based on deltaTime
        this.draw();
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = Math.random() * 50 + 50; // Random speed between 50 and 100 pixels per second
        const result = this.determineValueAndColor();
        this.value = result.value;
        this.color = result.color;
    }

    determineValueAndColor() {
        const rand = Math.random();
        if (rand < 0.4) {
            return { value: 10, color: "gold" };
        } else if (rand < 0.7) {
            return { value: 20, color: "silver" };
        } else if (rand < 0.9) {
            return { value: 50, color: "blue" };
        } else {
            return { value: 100, color: "green" };
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    update(deltaTime) {
        this.y += this.speed * deltaTime; // Move the coin down based on deltaTime
        this.draw();
    }
}

class Effect {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.alpha = 1.0; // Initial opacity
        this.lifetime = 50; // How long the effect lasts (in frames)
    }

    draw() {
        ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
        ctx.font = "30px Arial";
        ctx.fillText(this.text, this.x, this.y);
    }

    update(deltaTime) {
        this.y -= 1; // Move effect up
        this.alpha -= 1 / this.lifetime; // Gradually fade out
        this.draw();
    }
}


class Cloud {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.speed = speed; // Speed in pixels per second
        this.width = 128; // Set the cloud width
        this.height = 72; // Set the cloud height
    }

    draw() {
        ctx.drawImage(IMAGES.cloud, this.x, this.y, this.width, this.height);
    }

    update(deltaTime) {
        this.y += this.speed * deltaTime;
        if (this.y > canvas.height) {
            this.y = -this.height;
            this.x = Math.random() * (canvas.width - this.width);
        }
        this.draw();
    }
}

let clouds = [];

function initClouds() {
    for (let i = 0; i < 3; i++) { // Create 3 clouds
        const x = Math.random() * (canvas.width - 128);
        const y = Math.random() * canvas.height;
        const speed = 20; // Slow speed for clouds
        clouds.push(new Cloud(x, y, speed));
    }
}
initClouds();


function handleClouds(deltaTime) {
    clouds.forEach(cloud => cloud.update(deltaTime));
}


function drawStartScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw the result screen image
    const imgWidth = 232;
    const imgHeight = 47;
    const imgX = (canvas.width - imgWidth) / 2; // Center the image horizontally
    const imgY = 50; // Position the image near the top
    ctx.drawImage(IMAGES.resultScreen, imgX, imgY, imgWidth, imgHeight);



    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText("BoxCoin!", 40, 150);

    ctx.font = "20px Arial";
    ctx.fillText("Controls:", 40, 200);
    ctx.fillText("Arrow keys or A/D: Move left/right", 40, 230);
    ctx.fillText("Space or W: Jump", 40, 260);
    ctx.fillText("Score Points:", 40, 300);
    ctx.fillText("+10: Collect gold coins", 40, 330);
    ctx.fillText("+20: Collect silver coins", 40, 360);
    ctx.fillText("+50: Collect blue coins", 40, 390);
    ctx.fillText("+100: Collect green coins", 40, 420);

    ctx.font = "24px Arial";
    ctx.fillText("Press any key to start", 60, 500);

}

const player = new Player();
let platforms = [];
let coins = [];

function initPlatforms() {
    for (let i = 0; i < numPlatforms; i++) {
        const x = Math.random() * (canvas.width - platformWidth);
        const y = canvas.height - i * platformGap;
        platforms.push(new Platform(x, y, platformSpeed)); // Ensure all initial platforms have the same speed
    }

    const topPlatform = platforms[platforms.length - 1];
    player.y = topPlatform.y - player.height;
}

initPlatforms();

function handlePlatforms(deltaTime) {
    platforms.forEach((platform, index) => {
        platform.update(deltaTime);

        if (
            player.dy > 0 && // Falling down
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.y + player.height >= platform.y &&
            player.y + player.height <= platform.y + platform.speed * deltaTime + player.dy * deltaTime
        ) {
            player.y = platform.y - player.height;
            player.land(platform.speed); // Player lands on a platform
        }

        if (platform.y > canvas.height) {
            platforms.splice(index, 1);
            const newX = Math.random() * (canvas.width - platformWidth);
            platforms.unshift(new Platform(newX, -platformHeight, platformSpeed));
        }
    });
}

function handleCoins(deltaTime) {
    coins.forEach((coin, index) => {
        coin.update(deltaTime);

        if (player.collectCoin(coin)) {
            score += coin.value;
            effects.push(new Effect(coin.x, coin.y, `+${coin.value}`, this.hexToRgbString(coin.color)));
            coins.splice(index, 1);
        }

        if (coin.y > canvas.height) {
            coins.splice(index, 1);
        }
    });
}

function handleEffects(deltaTime) {
    effects.forEach((effect, index) => {
        effect.update(deltaTime);

        if (effect.alpha <= 0) {
            effects.splice(index, 1);
        }
    });

    levelTexts.forEach((effect, index) => {
        effect.update(deltaTime);

        if (effect.alpha <= 0) {
            levelTexts.splice(index, 1);
        }
    });
}

function spawnCoin() {
    const x = Math.random() * (canvas.width - 20);
    const y = -20;
    coins.push(new Coin(x, y));

    setTimeout(spawnCoin, coinSpawnInterval);
}

function hexToRgbString(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
}

function updateScore() {
    if (!gameOver) {
        score += 1;
        setTimeout(updateScore, 500); // Increase score every half second
    }
}

function drawScore() {
    ctx.fillStyle = "black";
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + score, 10, 30);
}

function applyMilestones(deltaTime) {
    const elapsedTime = (Date.now() - gameStartTime) / 1000;
    const levelDurations = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];

    levelDurations.forEach((time, index) => {
        if (elapsedTime >= time && milestonesReached <= index) {
            milestonesReached++;
            currentLevel++;
            levelTexts.push(new Effect(canvas.width / 2 - 100, canvas.height / 2, `LEVEL ${milestonesReached}`, "255, 255, 255"));

            platformSpeed = Math.min(platformSpeed + 20, maxPlatformSpeed); // Increase platform speed by 20 pixels per second

            platformWidth = Math.max(platformWidth - 10, 50); // Decrease platform width slightly, but not below 50 pixels

            platforms.forEach(platform => {
                platform.speed = platformSpeed;
                platform.width = platformWidth;
            });
        }
    });
}

function drawGameOverScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgb(110, 146, 247)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the result screen image
    const imgWidth = 232;
    const imgHeight = 47;
    const imgX = (canvas.width - imgWidth) / 2; // Center the image horizontally
    const imgY = 50; // Position the image near the top
    ctx.drawImage(IMAGES.resultScreen, imgX, imgY, imgWidth, imgHeight);

    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText("Game Over", canvas.width / 2 - 80, imgY + imgHeight + 50);

    ctx.font = "20px Arial";
    ctx.fillText(`Score: ${score}`, canvas.width / 2 - 50, imgY + imgHeight + 100);
    ctx.fillText(`Coins Collected: ${coinCount}`, canvas.width / 2 - 90, imgY + imgHeight + 130);
    ctx.fillText(`Survival Time: ${Math.floor((Date.now() - gameStartTime) / 1000)} seconds`, canvas.width / 2 - 120, imgY + imgHeight + 160);
    ctx.fillText(`Level Reached: ${currentLevel}`, canvas.width / 2 - 80, imgY + imgHeight + 190);

    ctx.fillStyle = "lightblue";

    const downloadButton = document.createElement("button");
    downloadButton.innerText = "Download Screenshot";
    downloadButton.style.position = "absolute";
    downloadButton.style.left = `${canvas.offsetLeft + canvas.width / 2 - 75}px`;
    downloadButton.style.top = `${canvas.offsetTop + canvas.height / 2 + 60}px`;
    downloadButton.onclick = downloadScreenshot;
    document.body.appendChild(downloadButton);
}

function downloadScreenshot() {
    const link = document.createElement('a');
    link.download = 'game_screenshot.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function animate(currentTime) {
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    handleClouds(deltaTime); // Draw the clouds first as the background
    applyMilestones(deltaTime);
    handlePlatforms(deltaTime);
    handleCoins(deltaTime);
    handleEffects(deltaTime);

    player.continueJump(deltaTime);  // Ensure jump continues while space is held
    player.update(deltaTime);
    drawScore();

    if (debugMode) {
        drawDebugInfo(deltaTime);
    }

    if (!gameOver) {
        animationId = requestAnimationFrame(animate);
    }
}


function drawDebugInfo(deltaTime) {
    const fps = (1 / deltaTime).toFixed(2); // Calculate frames per second
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(10, canvas.height - 150, 200, 140);

    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Debug Info:", 20, canvas.height - 130);
    ctx.fillText(`FPS: ${fps}`, 20, canvas.height - 110);

    ctx.fillText("Object Speeds:", 20, canvas.height - 90);
    platforms.forEach((platform, index) => {
        ctx.fillText(`Platform ${index + 1}: ${platform.speed.toFixed(2)} px/s`, 20, canvas.height - 70 + index * 20);
    });

    coins.forEach((coin, index) => {
        ctx.fillText(`Coin ${index + 1}: ${coin.speed.toFixed(2)} px/s`, 20, canvas.height - 70 + (platforms.length + index) * 20);
    });
}

function endGame() {
    gameOver = true;
    cancelAnimationFrame(animationId);
    document.getElementById("gameOver").classList.remove("hidden");
    drawGameOverScreen();
}

document.addEventListener("keydown", (event) => {
    if (!gameStarted) {
        gameStarted = true;
        startGame();
    } else {
        if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
            player.moveLeft();
        } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
            player.moveRight();
        } else if (event.key === " " || event.key === "Spacebar" || event.key === "w" || event.key === "W") {
            player.jump();  // Initiate the jump
        } else if (event.key === "i" || event.key === "I") {
            debugMode = !debugMode;
        }
    }
});

document.addEventListener("keyup", (event) => {
    if (gameStarted) {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "a" || event.key === "d" || event.key === "A" || event.key === "D") {
            player.stopMoving();
        } else if (event.key === " " || event.key === "Spacebar" || event.key === "w" || event.key === "W") {
            player.endJump();  // Stop applying upward force
        }
    }
});


document.getElementById("restartButton").addEventListener("click", () => {
    location.reload();
    document.querySelectorAll("button").forEach(button => button.remove());
});

function startGame() {
    gameStartTime = Date.now();
    lastTime = performance.now();
    requestAnimationFrame(animate);
    updateScore();
    spawnCoin();
}

drawStartScreen();
