import { combatSystem } from './systems/CombatSystem.js';
import { inventorySystem } from './systems/InventorySystem.js';
import { uiManager } from './ui/UIManager.js';
import { authManager } from './ui/AuthManager.js';
import { bus } from './utils/EventBus.js';
import { dataManager } from './managers/DataManager.js';
import { gameState } from './state/GameState.js';
import { soundManager } from './managers/SoundManager.js';
import { damageMeterSystem } from './systems/DamageMeterSystem.js';

console.log("Initializing Game Modules...");

// Coordinator Logic
bus.on('UI_REQUEST_START_FIGHT', () => {
    // Initialize sound on first user interaction (browser requirement)
    soundManager.init();
    gameState.startFight();
    combatSystem.startFight();
});

bus.on('FIGHT_ENDED', () => {
    combatSystem.endFight();
    inventorySystem.returnAllItemsToStash();
});

bus.on('FIGHT_VICTORY', () => {
    combatSystem.endFight();
    setTimeout(() => gameState.handleWin(), 2000);
});

bus.on('FIGHT_DEFEAT', () => {
    combatSystem.endFight();
    setTimeout(() => gameState.handleLoss(), 2000);
});

bus.on('UI_REQUEST_SURRENDER', () => {
    bus.emit('FIGHT_DEFEAT');
});

// Game Loop
let lastFrameTime = 0;

function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    combatSystem.update(deltaTime);
    uiManager.update();

    requestAnimationFrame(gameLoop);
}

// Start sequence
async function start() {
    const success = await dataManager.loadData();
    if (success) {
        gameState.init();
        // Initialize Auth after data is loaded so that auto-login can properly start the game
        authManager.init();
        requestAnimationFrame(gameLoop);
    } else {
        alert("Failed to load game data!");
    }
}

start();
