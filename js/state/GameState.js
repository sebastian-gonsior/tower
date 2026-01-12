import { bus } from '../utils/EventBus.js';
import { ItemFactory } from '../models/ItemFactory.js';
import { dataManager } from '../managers/DataManager.js';

export const GAME_CONFIG = {
    playerMaxHp: 1000,
    enemyMaxHp: 1510000,
    slotsCount: 6,
    stashCount: 24
};

export const RARITY_CONFIG = {
    1: { common: 1.0, uncommon: 0.2, rare: 0.05, epic: 0.02, legendary: 0.01 },
    2: { common: 1.0, uncommon: 0.4, rare: 0.1, epic: 0.05, legendary: 0.02 },
    3: { common: 1.0, uncommon: 0.4, rare: 0.1, epic: 0.1, legendary: 0.02 },
    4: { common: 1.0, uncommon: 0.4, rare: 0.2, epic: 0.2, legendary: 0.1 },
    5: { common: 1.0, uncommon: 0.5, rare: 0.4, epic: 0.3, legendary: 0.1 }
};

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
        if (name) {
            this.playerName = name;
        }

        if (!this.playerName || this.playerName.trim() === "") {
            console.error("Invalid Name");
            return;
        }

        this.level = 1;
        this.gold = 100;
        this.lives = 3;

        // Reset Inventory
        this.activeSlots.fill(null);
        this.stashSlots.fill(null);

        // Reset Max HP
        this.player.maxHp = GAME_CONFIG.playerMaxHp;
        this.player.hp = GAME_CONFIG.playerMaxHp;

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
            this.enemy.icon = bossData.icon || '👹';
            this.enemy.maxHp = bossData.hp;
            this.enemy.hp = bossData.hp;
            this.enemy.shield = 0;
            this.enemy.introText = bossData.introText;

            this.enemySlots.fill(null);
            if (bossData.items) {
                const itemStarLevel = bossData.itemStarLevel || 0;
                bossData.items.forEach((itemId, idx) => {
                    if (idx < this.enemySlots.length) {
                        this.enemySlots[idx] = ItemFactory.createItem(itemId, itemStarLevel);
                    }
                });
            }
        } else {
            console.error("No boss found for level " + this.level);
            this.enemy.name = "Unknown Boss";
            this.enemy.icon = '❓';
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

        // Get rarity chances for current level (capped at lvl 5)
        const currentLevel = Math.min(this.level, 5);
        const chances = RARITY_CONFIG[currentLevel] || RARITY_CONFIG[1];

        // Pick 6 random items
        for (let i = 0; i < 6; i++) {
            // Roll for rarity (Highest to lowest)
            let rolledRarity = 'common';
            if (Math.random() < chances.legendary) rolledRarity = 'legendary';
            else if (Math.random() < chances.epic) rolledRarity = 'epic';
            else if (Math.random() < chances.rare) rolledRarity = 'rare';
            else if (Math.random() < chances.uncommon) rolledRarity = 'uncommon';
            else rolledRarity = 'common';

            // Filter items by rolled rarity
            let availableItems = allItems.filter(item => item.rarity === rolledRarity);

            // Fallback: If no items found for this rarity, try lower rarities until we find one
            if (availableItems.length === 0) {
                const rarities = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
                const startIndex = rarities.indexOf(rolledRarity);
                for (let j = startIndex + 1; j < rarities.length; j++) {
                    availableItems = allItems.filter(item => item.rarity === rarities[j]);
                    if (availableItems.length > 0) break;
                }
            }

            if (availableItems.length > 0) {
                const randomItemTemplate = availableItems[Math.floor(Math.random() * availableItems.length)];
                this.shopItems.push(ItemFactory.createItem(randomItemTemplate.id));
            } else {
                // Extreme fallback: just pick any item if even common is empty (should not happen)
                if (allItems.length > 0) {
                    const randomItemTemplate = allItems[Math.floor(Math.random() * allItems.length)];
                    this.shopItems.push(ItemFactory.createItem(randomItemTemplate.id));
                }
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
        if (!item) return false;

        if (this.gold >= item.price) {
            // Find empty stash slot
            const emptyIdx = this.stashSlots.findIndex(s => s === null);
            if (emptyIdx !== -1) {
                this.gold -= item.price;
                this.stashSlots[emptyIdx] = item;
                // Remove from shop? Or keep? usually shop items are single purchase per slot.
                this.shopItems[shopIndex] = null;

                bus.emit('GOLD_UPDATED', this.gold);
                bus.emit('SLOTS_UPDATED');
                bus.emit('SHOP_UPDATED', this.shopItems);

                // Check for item fusion after buying
                this.checkAndPerformFusion();

                return true;
            } else {
                console.log("Stash full");
                return false;
            }
        }
        return false;
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

    updateMaxHp(targetType, amount) {
        const target = targetType === 'enemy' ? this.enemy : this.player;
        target.maxHp += amount;
        target.hp += amount; // Also heal for the same amount
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

        if (this.level >= 20) {
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
     * - Now considers items in BOTH stashSlots and activeSlots
     */

    /**
     * Find groups of 3+ identical items that can be fused (across stash + active).
     * Items are identical if they have the same templateId AND starLevel.
     * @returns {Array} Array of { templateId, starLevel }
     */
    findFusableItems() {
        const counts = new Map();

        const addToCounts = (item) => {
            if (item && item.starLevel < 10) {
                const key = `${item.templateId}|${item.starLevel}`;
                counts.set(key, (counts.get(key) || 0) + 1);
            }
        };

        this.stashSlots.forEach(addToCounts);
        this.activeSlots.forEach(addToCounts);

        const fusable = [];
        for (const [key, count] of counts.entries()) {
            if (count >= 3) {
                const [templateId, starLevelStr] = key.split('|');
                fusable.push({
                    templateId,
                    starLevel: parseInt(starLevelStr)
                });
            }
        }
        return fusable;
    }

    /**
     * Fuse 3 identical items into 1 upgraded item.
     * Searches both stash and active slots.
     * @param {string} templateId - The template ID of items to fuse
     * @param {number} starLevel - The current star level of items to fuse
     * @returns {boolean} True if fusion was successful
     */
    fuseItems(templateId, starLevel) {
        const matchingLocations = [];

        const collect = (arr, type) => {
            arr.forEach((item, index) => {
                if (item && item.templateId === templateId && item.starLevel === starLevel) {
                    matchingLocations.push({ type, index });
                }
            });
        };

        collect(this.stashSlots, 'stash');
        collect(this.activeSlots, 'active');

        if (matchingLocations.length < 3) {
            console.warn("Not enough items to fuse");
            return false;
        }

        if (starLevel >= 10) {
            console.warn("Cannot fuse: max star level reached");
            return false;
        }

        // Prefer removing from stash first (collected stash first)
        const toRemove = matchingLocations.slice(0, 3);

        // Remove the 3 items first (this guarantees space)
        toRemove.forEach(({ type, index }) => {
            if (type === 'stash') {
                this.stashSlots[index] = null;
            } else {
                this.activeSlots[index] = null;
            }
        });

        // Create upgraded item
        const upgradedItem = ItemFactory.createItem(templateId, starLevel + 1);
        if (!upgradedItem) {
            console.error("Failed to create upgraded item");
            return false;
        }

        // Place upgraded item, preferring stash
        let placementIndex = this.activeSlots.findIndex(s => s === null);
        let placementType = 'active';

        if (placementIndex === -1) {
            placementIndex = this.stashSlots.findIndex(s => s === null);
            placementType = 'stash';
        }

        if (placementIndex === -1) {
            console.error("No space to place upgraded item (unexpected)");
            return false;
        }

        if (placementType === 'stash') {
            this.stashSlots[placementIndex] = upgradedItem;
        } else {
            this.activeSlots[placementIndex] = upgradedItem;
        }

        console.log(`Fused 3x ${templateId} (${starLevel}★) into 1x ${upgradedItem.getDisplayName()} (placed in ${placementType})`);
        bus.emit('ITEM_FUSED', { item: upgradedItem, fromStarLevel: starLevel });
        bus.emit('SLOTS_UPDATED');

        return true;
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
                    break; // Re-check after each fusion
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