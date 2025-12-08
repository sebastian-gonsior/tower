import { gameState } from './state/GameState.js';
import { combatSystem } from './systems/CombatSystem.js';
import { inventorySystem } from './systems/InventorySystem.js';
import { uiManager } from './ui/UIManager.js';
import { bus } from './utils/EventBus.js';

console.log("Initializing Game Modules...");

// Coordinator Logic
bus.on('UI_REQUEST_START_FIGHT', () => {
    combatSystem.startFight();
});

bus.on('FIGHT_ENDED', () => {
    // Delay slightly or just do it immediately? Original was immediate.
    inventorySystem.returnAllItemsToStash();
    // gameState.reset(); // Removed to allow Shop/NextLevel flow to control reset
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

// Start Loop
requestAnimationFrame(gameLoop);
