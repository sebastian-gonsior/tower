import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mocks
global.window = {};
global.document = {
    getElementById: () => ({
        style: {},
        classList: { add:()=>{}, remove:()=>{} },
        innerText: "",
        addEventListener: ()=>{},
        appendChild: ()=>{},
        children: []
    }),
    createElement: () => ({
        style: {},
        classList: { add:()=>{}, remove:()=>{} },
        innerText: "",
        appendChild: ()=>{}
    }),
    body: { appendChild: ()=>{} }
};

global.fetch = async (url) => {
    const projectRoot = path.join(__dirname, '..');
    const filePath = path.join(projectRoot, url);
    const content = fs.readFileSync(filePath, 'utf8');
    return {
        json: async () => JSON.parse(content)
    };
};

// Start
async function run() {
    try {
        const { gameState, PHASES } = await import('../js/state/GameState.js');
        const { dataManager } = await import('../js/managers/DataManager.js');
        const { combatSystem } = await import('../js/systems/CombatSystem.js');
        const { uiManager } = await import('../js/ui/UIManager.js');

        console.log("Starting Tests...");
        
        // Load Data
        await dataManager.loadData();
        console.log(`Data Loaded: ${dataManager.items.size} items`);
        
        // Init
        gameState.init();
        if (gameState.phase !== PHASES.START_SCREEN) throw new Error(`Wrong Phase: ${gameState.phase} (Expected START_SCREEN)`);
        
        // Start Game
        gameState.startGame("Tester");
        if (gameState.phase !== PHASES.SHOPPING) throw new Error(`Wrong Phase: ${gameState.phase} (Expected SHOPPING)`);
        console.log("Game Started, Shopping Phase");
        
        // Shop
        gameState.finishShopping();
        if (gameState.phase !== PHASES.BOSS_INTRO) throw new Error(`Wrong Phase: ${gameState.phase} (Expected BOSS_INTRO)`);
        console.log("Boss Intro Phase");
        
        // Equip Phase (per game.md: after boss intro, player can equip items)
        gameState.startEquipPhase();
        if (gameState.phase !== PHASES.EQUIP) throw new Error(`Wrong Phase: ${gameState.phase} (Expected EQUIP)`);
        console.log("Equip Phase - Player can now equip items");
        
        // Fight (per game.md: after equipping, fight starts)
        gameState.startFight();
        combatSystem.startFight();
        if (gameState.phase !== PHASES.COMBAT) throw new Error(`Wrong Phase: ${gameState.phase} (Expected COMBAT)`);
        console.log("Combat Phase - Items locked, fight in progress");
        
        // Update
        combatSystem.update(100); 
        uiManager.update();
        console.log("Combat Updated");
        
        console.log("TESTS PASSED");
        
    } catch (e) {
        console.error("TEST FAILED", e);
        process.exit(1);
    }
}

run();
