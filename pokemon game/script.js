// Game State
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameActive = false;
let score = 0;
let player = { x: (canvas.width - 150) / 2, y: canvas.height - 150 - 10, width: 150, height: 150, img: new Image(), speed: 0, projectileSpeed: 10, projectileWidth: 4, attackStat: 0, name: '' }; 
let projectiles = [];
let enemies = [];
let keys = {};
let blasts = [];

// Handle Pokémon name suggestions
let suggestions = JSON.parse(localStorage.getItem('pokemonSuggestions') || '[]');
function updateDatalist() {
    const datalist = document.getElementById('pokemon-suggestions');
    if (datalist) {
        datalist.innerHTML = suggestions.map(name => `<option value="${name}">`).join('');
    }
}
updateDatalist();

async function fetchPokemon(identifier) {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${identifier}`);
    if (!res.ok) throw new Error(`Pokemon ${identifier} not found`);
    return await res.json();
}

async function startGame() {
    const name = document.getElementById('name').value.toLowerCase().trim();
    const status = document.getElementById('game-status');
    if (!name) return alert("Enter a Pokemon name first!");

    try {
        const data = await fetchPokemon(name);
        player.img.src = data.sprites.front_default;
        player.name = data.name;

        // Save name to suggestions if it's new and valid
        if (!suggestions.includes(name)) {
            suggestions.push(name);
            localStorage.setItem('pokemonSuggestions', JSON.stringify(suggestions));
            updateDatalist();
        }
        
        // Calculate player speed based on Pokemon's base speed stat
        const baseSpeedStat = data.stats.find(s => s.stat.name === 'speed')?.base_stat || 30; // Default to 30 if speed stat not found
        // Scale the base speed stat to a playable range, ensuring a minimum speed of 2
        player.speed = Math.max(2, Math.floor(baseSpeedStat / 15));

        // Calculate shoot power based on Pokemon's base attack stat
        const attackStat = data.stats.find(s => s.stat.name === 'attack')?.base_stat || 50;
        player.attackStat = attackStat; // Store attack stat to determine bullet count
        player.projectileSpeed = 7 + (attackStat / 15); // Faster projectiles for stronger Pokemon
        player.projectileWidth = Math.max(4, attackStat / 12); // Wider projectiles for stronger Pokemon

        // Reset Game
        score = 0;
        enemies = [];
        projectiles = [];
        blasts = [];
        gameActive = true;
        canvas.style.display = 'block';
        status.innerText = `Playing as ${data.name.toUpperCase()} | Speed: ${player.speed} | Power: ${Math.floor(attackStat)} - Score: 0`;
        
        gameLoop();
    } catch (e) {
        status.innerText = "Error: " + e.message;
    }
}

function gameLoop() {
    if (!gameActive) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    // Move Player
    if (keys['ArrowLeft'] && player.x > 0) player.x -= player.speed;
    if (keys['ArrowRight'] && player.x < canvas.width - player.width) player.x += player.speed;

    // Projectiles
    projectiles.forEach((p, i) => {
        p.y -= player.projectileSpeed;
        p.x += (p.vx || 0); // Move bullet sideways if it has horizontal velocity
        if (p.y < 0 || p.x < -p.width || p.x > canvas.width) projectiles.splice(i, 1);
    });

    // Update Blasts
    blasts.forEach((b, i) => {
        b.frame++;
        if (b.frame > b.maxFrame) blasts.splice(i, 1);
    });

    // Enemies
    if (Math.random() < 0.005) { // Further reduced spawn rate to make fewer Pokémon fall
        const enemyId = Math.floor(Math.random() * 151) + 1;
        const enemyImg = new Image();
        enemyImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${enemyId}.png`;
        // Enemy size now matches player (150x150), spawn position adjusted
        enemies.push({ x: Math.random() * (canvas.width - 150), y: -150, img: enemyImg, size: 150 });
    }

    enemies.forEach((e, ei) => {
        e.y += 1; // Reduced from 3 to 1 to make them fall slower
        // Collision with projectile
        // Using .some() to efficiently check for collision and remove only one projectile per enemy hit
        if (projectiles.some((p, pi) => {
            // Adjusted collision detection for dynamic projectile width
            if (p.x < e.x + e.size && p.x + p.width > e.x && p.y < e.y + e.size && p.y + 15 > e.y) {
                blasts.push({ x: e.x, y: e.y, size: e.size, frame: 0, maxFrame: 20 });
                enemies.splice(ei, 1);
                projectiles.splice(pi, 1);
                score += 10;
                document.getElementById('game-status').innerText = `Score: ${score}`;
                return true; // Indicate a collision was found and handled
            }
            return false;
        })) return; // If a collision occurred, move to the next enemy

        // Game Over
        if (e.y > canvas.height) {
            gameActive = false;
            alert("Game Over! Score: " + score);
        }
    });
}

// Helper to draw a single blast animation
function drawBlast(b) {
    const progress = b.frame / b.maxFrame;
    const alpha = (1 - progress) * 0.5; // Softer transparency for smoke
    ctx.save();
    
    // Smoke colors: shades of grey and light grey
    const smokeColors = [`rgba(100, 100, 100, ${alpha})`, `rgba(150, 150, 150, ${alpha})`, `rgba(200, 200, 200, ${alpha})` ];
    
    // Draw several "puffs" of smoke to create a cloud effect
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i;
        const drift = progress * (b.size / 3);
        const puffX = b.x + b.size / 2 + Math.cos(angle) * drift;
        const puffY = b.y + b.size / 2 + Math.sin(angle) * drift;
        const puffSize = (b.size / 2.5) * (0.5 + progress);

        ctx.fillStyle = smokeColors[i % smokeColors.length];
        ctx.beginPath();
        ctx.arc(puffX, puffY, puffSize, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Player
    ctx.drawImage(player.img, player.x, player.y, player.width, player.height);
    
    // Draw Projectiles
    projectiles.forEach(p => {
        let fillColor = '#ff4444'; // Default red
        let strokeColor = 'white'; // Default white glow

        if (player.name === 'pikachu') {
            fillColor = '#FFFF00'; // Bright Yellow for Pikachu
            strokeColor = '#FFFACD'; // Lemon Chiffon glow
        } else if (player.name === 'raikou') {
            fillColor = '#00BFFF'; // Electric Blue for Raikou
            strokeColor = '#E0FFFF'; // Lighter blue glow for Raikou
        } else if (player.name === 'mewtwo') {
            fillColor = '#800080'; // Deep Purple for Mewtwo
            strokeColor = '#FF00FF'; // Purple Glow
        } else if (player.projectileWidth > 8) {
            fillColor = '#ffcc00'; // Yellow/Orange for powerful (Mewtwo or high attack)
            strokeColor = 'white';
        }
        
        ctx.fillStyle = fillColor;
        
        // Apply a purple glow specifically for Mewtwo
        if (player.name === 'mewtwo') {
            ctx.shadowBlur = 15;
            ctx.shadowColor = strokeColor;
        }

        // Lightning Jitter Effect: Draw with a random horizontal offset for Pikachu/Raikou
        const jitter = (player.name === 'pikachu' || player.name === 'raikou') ? (Math.random() - 0.5) * 15 : 0;
        const drawX = p.x + jitter;
        
        ctx.fillRect(drawX, p.y, p.width, 15);
        
        // Add a small glow effect for powerful shots
        if (player.projectileWidth > 8 || player.name === 'raikou' || player.name === 'mewtwo' || player.name === 'pikachu') {
            ctx.strokeStyle = strokeColor;
            ctx.strokeRect(drawX, p.y, p.width, 15);
        }

        // Reset shadow blur so it doesn't affect other elements
        ctx.shadowBlur = 0;
    });
    
    // Draw Enemies
    enemies.forEach(e => {
        if (e.img.complete) ctx.drawImage(e.img, e.x, e.y, e.size, e.size);
    });

    // Draw Blasts
    blasts.forEach(drawBlast);
}

// Controls
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' && gameActive) {
        const centerX = player.x + player.width / 2 - (player.projectileWidth / 2);
        
        // Always shoot the center bullet
        projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: 0 });

        if (player.name === 'pikachu') {
            // Pikachu now shoots only a single bullet (shooting power 1)
        } else if (player.name === 'raikou') {
            // Raikou Special Shooting Style: Reduced to 3-bullet electric spread
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: -2 }); // Angled Left
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: 2 });  // Angled Right
        } else if (player.name === 'mewtwo') {
            // Mewtwo Ultimate Shooting Style: 7-bullet psychic spread
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: -2 }); // Angled Left
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: 2 });  // Angled Right
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: -4 }); // Sharp Left
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: 4 });  // Sharp Right
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: -7 }); // Ultra Left
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: 7 });  // Ultra Right
        } else if (player.attackStat >= 100) {
            // Default powerful Pokemon spread (3 bullets total including center)
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: -2 }); // Angled Left
            projectiles.push({ x: centerX, y: player.y, width: player.projectileWidth, vx: 2 });  // Angled Right
        }
        e.preventDefault(); // Prevent scrolling
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

document.getElementById('section1-btn').addEventListener('click', startGame);