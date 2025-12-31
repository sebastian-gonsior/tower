import { GAME_CONFIG } from '../config.js';
import { bus } from '../utils/EventBus.js';
import { ItemFactory } from '../models/ItemFactory.js';
import { dataManager } from '../managers/DataManager.js';

/**
 * Game Phases - The game follows a structured phase system (per game.md manifesto):
 * 
 * Game Flow per Round:
 * 1. START_SCREEN - Initial screen, player registration/login
 * 2. SHOPPING - Player can buy items from the shop
 * 3. BOSS_INTRO - Shows boss introduction with flavor text
 * 4. EQUIP - Player equips items from stash to active slots
 * 5. COMBAT - Auto-battle between player and boss
 * 6. VICTORY - Player wins after defeating all 10 bosses
 * 7. GAME_OVER - Player loses all lives
 * 
 * Item Rarity: Higher rarity items require higher player level to purchase.
 */
export const PHASES = {
    START_SCREEN: 'START_SCREEN',
    SHOPPING: 'SHOPPING',
    BOSS_INTRO: 'BOSS_INTRO',
    EQUIP: 'EQUIP',
    COMBAT: 'COMBAT',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
};

class GameState {
    constructor() {
        this.player = { hp: GAME_CONFIG.playerMaxHp, maxHp: GAME_CONFIG.playerMaxHp, shield: 0, maxShield: 0 };
        this.playerName = "Player"; // Default
        this.enemy = { hp: 100, maxHp: 100, shield: 0, maxShield: 0, name: "Enemy" };
        
        this.gold = 100;
        this.level = 1;
        this.lives = 3;
        
        this.activeSlots = new Array(GAME_CONFIG.slotsCount).fill(null);
        this.enemySlots = new Array(GAME_CONFIG.slotsCount).fill(null);
        this.stashSlots = new Array(GAME_CONFIG.stashCount).fill(null);
        
        this.shopItems = []; // Current items in shop
        
        this.phase = PHASES.START_SCREEN;
        
        this.combatState = {
            playerStackingSpeed: 0,
            enemyStackingSpeed: 0,
            playerStackingDamage: 0,
            enemyStackingDamage: 0,
            playerStackingCrit: 0,
            enemyStackingCrit: 0,
            // Debuffs
            playerDebuffs: [],
            enemyDebuffs: []
        };
    }

    init() {
        // Called after data is loaded
        console.log("GameState Initialized");
        this.setPhase(PHASES.START_SCREEN);
    }

    startGame(name) {
        if (!name || name.trim() === "") {
            console.error("Invalid Name");
            return;
        }
        this.playerName = name;
        this.level = 1;
        this.gold = 100;
        this.lives = 3;
        
        // Reset Inventory
        this.activeSlots.fill(null);
        this.stashSlots.fill(null);
        
        this.startRound();
    }
    
    startRound() {
        this.resetPlayerStats();
        this.configureBoss();
        this.generateShop();
        this.setPhase(PHASES.SHOPPING);
    }
    
    finishShopping() {
        this.setPhase(PHASES.BOSS_INTRO);
    }
    
    /**
     * Transition from Boss Intro to Equip phase.
     * Player can now equip items from stash to active slots.
     */
    startEquipPhase() {
        this.setPhase(PHASES.EQUIP);
    }
    
    /**
     * Start the combat phase after equipping items.
     */
    startFight() {
        this.setPhase(PHASES.COMBAT);
        this.resetCooldowns();
    }
    
    setPhase(phase) {
        this.phase = phase;
        bus.emit('PHASE_CHANGED', phase);
    }

    resetPlayerStats() {
        this.player.hp = this.player.maxHp;
        this.player.shield = 0;
        this.combatState.playerDebuffs = [];
        this.combatState.playerStackingSpeed = 0;
        this.combatState.playerStackingDamage = 0;
        this.combatState.playerStackingCrit = 0;
        bus.emit('HP_UPDATED');
    }

    configureBoss() {
        const bossData = dataManager.getBoss(this.level);
        if (bossData) {
            this.enemy.name = bossData.name;
            this.enemy.maxHp = bossData.hp;
            this.enemy.hp = bossData.hp;
            this.enemy.shield = 0;
            this.enemy.introText = bossData.introText;
            
            this.enemySlots.fill(null);
            if (bossData.items) {
                bossData.items.forEach((itemId, idx) => {
                    if (idx < this.enemySlots.length) {
                        this.enemySlots[idx] = ItemFactory.createItem(itemId);
                    }
                });
            }
        } else {
            console.error("No boss found for level " + this.level);
            this.enemy.name = "Unknown Boss";
            this.enemy.maxHp = 1000 * this.level;
            this.enemy.hp = this.enemy.maxHp;
        }
        
        this.combatState.enemyDebuffs = [];
        this.combatState.enemyStackingSpeed = 0;
        this.combatState.enemyStackingDamage = 0;
        this.combatState.enemyStackingCrit = 0;
        
        bus.emit('SLOTS_UPDATED');
    }
    
    generateShop() {
        this.shopItems = [];
        const allItems = dataManager.getAllItems();
        // Filter by level? "higher rarity needs higher level"
        // Simple logic: Can buy items with minLevel <= currentLevel + 2 (allow some scaling)
        // And rarity constraints?
        
        const availableItems = allItems.filter(item => {
             // Rarity check logic could be here
             return item.minLevel <= this.level + 1; // Example logic
        });
        
        // Pick 6 random items
        for(let i=0; i<6; i++) {
            if (availableItems.length > 0) {
                const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
                this.shopItems.push(ItemFactory.createItem(randomItem.id));
            }
        }
        bus.emit('SHOP_UPDATED', this.shopItems);
    }
    
    /**
     * Reroll the shop for 5 gold.
     * Generates a new set of random items in the shop.
     */
    rerollShop() {
        const rerollCost = 5;
        if (this.gold >= rerollCost) {
            this.gold -= rerollCost;
            bus.emit('GOLD_UPDATED', this.gold);
            this.generateShop();
            console.log("Shop rerolled for 5 gold");
        } else {
            console.log("Not enough gold to reroll shop");
        }
    }
    
    buyItem(shopIndex) {
        const item = this.shopItems[shopIndex];
        if (!item) return;
        
        if (this.gold >= item.price) {
            // Find empty stash slot
            const emptyIdx = this.stashSlots.findIndex(s => s === null);
            if (emptyIdx !== -1) {
                this.gold -= item.price;
                this.stashSlots[emptyIdx] = item;
                // Remove from shop? Or keep? Usually shop items are single purchase per slot.
                this.shopItems[shopIndex] = null; 
                
                bus.emit('GOLD_UPDATED', this.gold);
                bus.emit('SLOTS_UPDATED');
                bus.emit('SHOP_UPDATED', this.shopItems);
                
                // Check for item fusion after buying
                // 3 identical items (same templateId + starLevel) will auto-fuse
                this.checkAndPerformFusion();
            } else {
                console.log("Stash full");
            }
        }
    }

    resetCooldowns() {
        [...this.activeSlots, ...this.enemySlots, ...this.stashSlots].forEach(item => {
            if (item) item.currentCooldown = 0;
        });
    }

    updateHp(target, value) {
        if (target === 'player') {
            this.player.hp = Math.max(0, Math.min(value, this.player.maxHp));
        } else if (target === 'enemy') {
            this.enemy.hp = Math.max(0, Math.min(value, this.enemy.maxHp));
        }
        bus.emit('HP_UPDATED');
    }

    getArray(type) {
        if (type === 'active') return this.activeSlots;
        if (type === 'enemy') return this.enemySlots;
        if (type === 'stash') return this.stashSlots;
        return null;
    }

    updateSlot(type, index, item) {
        const arr = this.getArray(type);
        if (arr) {
            arr[index] = item;
            bus.emit('SLOTS_UPDATED');
        }
    }

    addGold(amount) {
        this.gold += amount;
        bus.emit('GOLD_UPDATED', this.gold);
    }
    
    handleWin() {
        // Award 100 gold on victory
        this.addGold(100);
        
        if (this.level >= 10) {
            this.setPhase(PHASES.VICTORY);
        } else {
            this.level++;
            // Advance to next boss WITHOUT regenerating shop
            // Shop items persist between rounds - only regenerate on game start or loss
            this.advanceToNextBoss();
        }
    }
    
    /**
     * Advance to the next boss after a victory.
     * Generates new shop items for the next round.
     */
    advanceToNextBoss() {
        this.resetPlayerStats();
        this.configureBoss();
        this.generateShop(); // Generate new items for the next round
        this.setPhase(PHASES.SHOPPING);
    }
    
    handleLoss() {
        // Award 50 gold on loss (consolation)
        this.addGold(50);
        
        this.lives--;
        bus.emit('LIVES_UPDATED', this.lives);
        if (this.lives <= 0) {
            this.setPhase(PHASES.GAME_OVER);
        } else {
             // Restart round? Or restart fight?
             // Usually restart fight or round. Let's restart round (back to shop).
             // But maybe keep shop state? 
             // Simplest: Restart Round (Shop refilled? Maybe not).
             this.startRound();
        }
    }
    
    // ==================== ITEM FUSION SYSTEM ====================
    /**
     * Item Fusion System:
     * - 3 identical items (same templateId AND same starLevel) can be fused
     * - Fusing creates 1 item with starLevel + 1 (doubled stats)
     * - Max star level is 10
     * - Fusion is checked automatically after buying items
     */
    
    /**
     * Find groups of 3+ identical items that can be fused.
     * Items are identical if they have the same templateId AND starLevel.
     * @returns {Array} Array of { templateId, starLevel, indices: [stashIndex, ...] }
     */
    findFusableItems() {
        const itemGroups = new Map(); // key: "templateId|starLevel" -> { templateId, starLevel, indices }
        
        this.stashSlots.forEach((item, index) => {
            if (item && item.starLevel < 10) {
                // Use | as separator since templateIds contain underscores (e.g., dagger_common)
                const key = `${item.templateId}|${item.starLevel}`;
                if (!itemGroups.has(key)) {
                    itemGroups.set(key, {
                        templateId: item.templateId,
                        starLevel: item.starLevel,
                        indices: []
                    });
                }
                itemGroups.get(key).indices.push(index);
            }
        });
        
        // Return groups with 3+ items
        const fusable = [];
        for (const [key, group] of itemGroups) {
            if (group.indices.length >= 3) {
                fusable.push(group);
            }
        }
        return fusable;
    }
    
    /**
     * Fuse 3 identical items into 1 upgraded item.
     * @param {string} templateId - The template ID of items to fuse
     * @param {number} starLevel - The current star level of items to fuse
     * @returns {boolean} True if fusion was successful
     */
    fuseItems(templateId, starLevel) {
        // Find 3 items with matching templateId and starLevel
        const matchingIndices = [];
        this.stashSlots.forEach((item, index) => {
            if (item && item.templateId === templateId && item.starLevel === starLevel) {
                matchingIndices.push(index);
            }
        });
        
        if (matchingIndices.length < 3) {
            console.warn("Not enough items to fuse");
            return false;
        }
        
        if (starLevel >= 10) {
            console.warn("Cannot fuse: max star level reached");
            return false;
        }
        
        // Take first 3 matching items
        const indicesToRemove = matchingIndices.slice(0, 3);
        
        // Remove the 3 items
        indicesToRemove.forEach(idx => {
            this.stashSlots[idx] = null;
        });
        
        // Create upgraded item and place in first empty slot
        const upgradedItem = ItemFactory.createItem(templateId, starLevel + 1);
        const emptyIdx = this.stashSlots.findIndex(s => s === null);
        
        if (emptyIdx !== -1 && upgradedItem) {
            this.stashSlots[emptyIdx] = upgradedItem;
            console.log(`Fused 3x ${templateId} (${starLevel}★) into 1x ${upgradedItem.getDisplayName()}`);
            bus.emit('ITEM_FUSED', { item: upgradedItem, fromStarLevel: starLevel });
            bus.emit('SLOTS_UPDATED');
            return true;
        }
        
        return false;
    }
    
    /**
     * Check for fusable items and automatically perform fusion.
     * Called after buying items or manually by player.
     * Will continue fusing until no more fusions are possible.
     */
    checkAndPerformFusion() {
        let fusionOccurred = true;
        let totalFusions = 0;
        
        // Keep fusing until no more fusions possible (chain reactions)
        while (fusionOccurred) {
            fusionOccurred = false;
            const fusable = this.findFusableItems();
            
            for (const group of fusable) {
                if (this.fuseItems(group.templateId, group.starLevel)) {
                    fusionOccurred = true;
                    totalFusions++;
                    break; // Re-check after each fusion (indices may have changed)
                }
            }
        }
        
        if (totalFusions > 0) {
            console.log(`Performed ${totalFusions} fusion(s)`);
        }
        
        return totalFusions;
    }
}

export const gameState = new GameState();
