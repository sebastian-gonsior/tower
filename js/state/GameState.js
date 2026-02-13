import { bus } from '../utils/EventBus.js';
import { ItemFactory } from '../models/ItemFactory.js';
import { dataManager } from '../managers/DataManager.js';
import { globalBuffSystem } from '../systems/GlobalBuffSystem.js';

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
import { LUCKY_ROLL_CHANCE, STAR_SHARD_CHANCE, FREE_REROLLS_ITEM_CHANCE, REROLLS_PER_TOKEN } from '../GAME_CONSTANTS.js';

export const PHASES = {
    START_SCREEN: 'START_SCREEN',
    SHOPPING: 'SHOPPING',
    BOSS_INTRO: 'BOSS_INTRO',
    EQUIP: 'EQUIP',
    COMBAT: 'COMBAT',
    REWARDS: 'REWARDS',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
};

class GameState {
    constructor() {
        this.player = { hp: GAME_CONFIG.playerMaxHp, maxHp: GAME_CONFIG.playerMaxHp, shield: 0, maxShield: 0 };
        this.playerName = "Adventurer"; // Default changed (Tracer)
        this.enemy = { hp: 100, maxHp: 100, shield: 0, maxShield: 0, name: "Unknown Entity" }; // Default changed (Tracer)

        this.gold = 100;
        this.level = 1;
        this.lives = 3;
        this.rerollCost = 5;
        this.freeRerolls = 0;

        this.activeSlots = new Array(GAME_CONFIG.slotsCount).fill(null);
        this.enemySlots = new Array(GAME_CONFIG.slotsCount).fill(null);
        this.stashSlots = new Array(GAME_CONFIG.stashCount).fill(null);

        this.shopItems = []; // Current items in shop
        this.isLuckyRoll = false;
        this.shopLocked = false;

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
        console.log(`[DEBUG] GameState.startGame called with name: ${name}`);
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
        this.activeSlots = new Array(GAME_CONFIG.slotsCount).fill(null);
        this.enemySlots = new Array(GAME_CONFIG.slotsCount).fill(null);
        this.stashSlots = new Array(GAME_CONFIG.stashCount).fill(null);
        bus.emit('SLOT_COUNT_UPDATED');

        // Reset Max HP
        this.player.maxHp = GAME_CONFIG.playerMaxHp;
        this.player.hp = GAME_CONFIG.playerMaxHp;

        this.startRound();
    }

    startRound() {
        console.log("[DEBUG] GameState.startRound called");
        this.resetPlayerStats();
        this.configureBoss();
        this.rerollCost = 5;
        this.generateShop();
        this.setPhase(PHASES.SHOPPING);
        bus.emit('REROLL_COST_UPDATED', this.rerollCost);
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
        console.log(`[DEBUG] configureBoss called for Level ${this.level}`);
        const bossData = dataManager.getBoss(this.level);
        if (bossData) {
            console.log(`[DEBUG] Boss found: ${bossData.name}`);
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
        if (this.shopLocked) {
            console.log("[SHOP] Shop is locked. Skipping generation.");
            this.shopLocked = false; // Reset lock for next round
            bus.emit('SHOP_UPDATED', { items: this.shopItems, isLuckyRoll: this.isLuckyRoll });
            return;
        }

        this.shopItems = [];
        this.isLuckyRoll = Math.random() < LUCKY_ROLL_CHANCE;

        // Get rarity chances for current level (capped at lvl 5)
        const currentLevel = Math.min(this.level, 5);
        const chances = RARITY_CONFIG[currentLevel] || RARITY_CONFIG[1];
        const rarities = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

        // Pick 6 random items
        for (let i = 0; i < 6; i++) {
            // 0. Roll for Star Shard (1%)
            if (Math.random() < STAR_SHARD_CHANCE) {
                this.shopItems.push(ItemFactory.createItem('star_shard', 0));
                continue;
            }

            // 0.1 Roll for Fortune Coin (5%)
            if (Math.random() < FREE_REROLLS_ITEM_CHANCE) {
                this.shopItems.push(ItemFactory.createItem('reroll_token', 0));
                continue;
            }

            // 1. Roll for rarity
            const roll = Math.random();
            let rolledRarity = 'common';

            if (roll < chances.legendary) rolledRarity = 'legendary';
            else if (roll < chances.epic) rolledRarity = 'epic';
            else if (roll < chances.rare) rolledRarity = 'rare';
            else if (roll < chances.uncommon) rolledRarity = 'uncommon';

            // 2. Selection with fallback
            let availableItems = dataManager.getItemsByRarity(rolledRarity);

            // Fallback: If no items found for this rarity, try lower rarities
            if (availableItems.length === 0) {
                const startIndex = rarities.indexOf(rolledRarity);
                for (let j = startIndex + 1; j < rarities.length; j++) {
                    availableItems = dataManager.getItemsByRarity(rarities[j]);
                    if (availableItems.length > 0) break;
                }
            }

            // 3. Final Selection
            if (availableItems.length > 0) {
                const randomItemTemplate = availableItems[Math.floor(Math.random() * availableItems.length)];
                const starLevel = this.isLuckyRoll ? 1 : 0;
                this.shopItems.push(ItemFactory.createItem(randomItemTemplate.id, starLevel));
            } else {
                // Extreme fallback: just pick any item if even common is empty (should not happen)
                const allItems = dataManager.getAllItems();
                if (allItems.length > 0) {
                    const randomItemTemplate = allItems[Math.floor(Math.random() * allItems.length)];
                    const starLevel = this.isLuckyRoll ? 1 : 0;
                    this.shopItems.push(ItemFactory.createItem(randomItemTemplate.id, starLevel));
                }
            }
        }
        bus.emit('SHOP_UPDATED', { items: this.shopItems, isLuckyRoll: this.isLuckyRoll });
    }

    toggleLockShop() {
        this.shopLocked = !this.shopLocked;
        console.log(`[SHOP] Shop locked: ${this.shopLocked}`);
        return this.shopLocked;
    }

    /**
     * Reroll the shop for 5 gold.
     * Generates a new set of random items in the shop.
     */
    rerollShop() {
        if (this.freeRerolls > 0) {
            this.freeRerolls--;
            bus.emit('REROLL_COST_UPDATED', this.rerollCost); // Re-emit to update UI button text
            this.generateShop();
            console.log(`Shop rerolled using free reroll. Remaining: ${this.freeRerolls}`);
            return;
        }

        if (this.gold >= this.rerollCost) {
            this.gold -= this.rerollCost;
            const oldCost = this.rerollCost;
            this.rerollCost += 10;
            bus.emit('GOLD_UPDATED', this.gold);
            bus.emit('REROLL_COST_UPDATED', this.rerollCost);
            this.generateShop();
            console.log(`Shop rerolled for ${oldCost} gold. Next cost: ${this.rerollCost}`);
        } else {
            console.log("Not enough gold to reroll shop");
        }
    }

    buyItem(shopIndex) {
        const item = this.shopItems[shopIndex];
        if (!item) return false;

        if (this.gold >= item.price) {
            // Special handling for Reroll Token
            if (item.templateId === 'reroll_token') {
                this.gold -= item.price;
                this.freeRerolls += REROLLS_PER_TOKEN;
                this.shopItems[shopIndex] = null;
                bus.emit('GOLD_UPDATED', this.gold);
                bus.emit('REROLL_COST_UPDATED', this.rerollCost); // Trigger UI update for button
                bus.emit('SHOP_UPDATED', this.shopItems);
                console.log(`Purchased Fortune Coin! Total free rerolls: ${this.freeRerolls}`);
                return true;
            }

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

    sellItem(type, index) {
        const arr = this.getArray(type);
        if (!arr || !arr[index]) return;

        const item = arr[index];
        const sellPrice = Math.floor(item.price * 0.8);

        this.addGold(sellPrice);
        arr[index] = null;

        bus.emit('SLOTS_UPDATED');
        bus.emit('ITEM_SOLD', { item, price: sellPrice });
        console.log(`Sold ${item.name} for ${sellPrice} gold`);
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
        if (type === 'shop') return this.shopItems;
        return null;
    }

    updateSlot(type, index, item) {
        const arr = this.getArray(type);
        if (arr) {
            arr[index] = item;
            bus.emit('SLOTS_UPDATED');
        }
    }

    upgradeItem(type, index) {
        const arr = this.getArray(type);
        if (!arr || !arr[index]) return;

        const currentItem = arr[index];
        if (currentItem.starLevel >= 10) return;

        const upgradedItem = ItemFactory.createItem(currentItem.templateId, currentItem.starLevel + 1);
        if (upgradedItem) {
            arr[index] = upgradedItem;
            bus.emit('SLOTS_UPDATED');
            if (type === 'shop') {
                bus.emit('SHOP_UPDATED', this.shopItems);
            }
        }
    }

    applyConsumable(fromType, fromIdx, toType, toIdx) {
        const fromArr = this.getArray(fromType);
        const toArr = this.getArray(toType);

        if (!fromArr || !toArr || !fromArr[fromIdx] || !toArr[toIdx]) return false;

        const consumable = fromArr[fromIdx];
        const target = toArr[toIdx];

        if (consumable.templateId === 'star_shard') {
            if (target.starLevel < 10) {
                const upgraded = ItemFactory.createItem(target.templateId, target.starLevel + 1);
                if (upgraded) {
                    toArr[toIdx] = upgraded;
                    fromArr[fromIdx] = null; // Consume
                    bus.emit('SLOTS_UPDATED');
                    if (toType === 'shop') bus.emit('SHOP_UPDATED', this.shopItems);
                    console.log(`Used Star Shard to upgrade ${target.name} to ${upgraded.getStarDisplay()}`);
                    return true;
                }
            } else {
                console.log("Item already at max star level");
            }
        }
        return false;
    }

    addGold(amount) {
        this.gold += amount;
        bus.emit('GOLD_UPDATED', this.gold);
    }

    handleWin() {
        // Award 100 gold on victory
        let winGold = 100;

        // Process Income Buff (INCOME_25)
        if (globalBuffSystem.hasBuff('INCOME_25')) {
            winGold += 25;
            console.log("Income buff applied: +25g");
        }

        this.addGold(winGold);
        this.levelComplete = true;

        if (this.level >= 20) {
            this.setPhase(PHASES.VICTORY);
        } else {
            // Go to rewards phase
            this.setPhase(PHASES.REWARDS);
        }
    }

    handleLoss() {
        console.log(`[DEBUG] handleLoss called. Current Lives: ${this.lives}`);
        // Award 50 gold on loss (consolation)
        this.addGold(50);

        this.lives--;
        bus.emit('LIVES_UPDATED', this.lives);
        console.log(`[DEBUG] Lives decreased to: ${this.lives}`);

        if (this.lives <= 0) {
            console.log("[DEBUG] No lives left. Phase -> GAME_OVER");
            this.setPhase(PHASES.GAME_OVER);
        } else {
            console.log("[DEBUG] Lives remain. Retrying level (Skipping Rewards)...");
            // Direct retry
            this.startRound();
        }
    }

    selectReward(buffId) {
        if (!buffId) return;

        console.log(`Applying reward: ${buffId}`);
        globalBuffSystem.addBuff(buffId);

        // Apply Instant Effects
        if (buffId === 'GOLD_INSTANT_200') {
            this.addGold(200);
        } else if (buffId === 'MAXHP_3500') {
            this.updateMaxHp('player', 3500);
        } else if (buffId === 'MAXHP_PCT_1000') {
            const added = this.player.maxHp * 10; // +1000%
            this.updateMaxHp('player', added);
        } else if (buffId === 'SLOT_PLUS_1') {
            this.activeSlots.push(null);
            bus.emit('SLOT_COUNT_UPDATED');
        } else if (buffId === 'HP_2000') {
            this.updateMaxHp('player', 2000);
        } else if (buffId === 'GOLD_1000') {
            this.addGold(1000);
        }

        // Advance Game Logic or Retry
        if (this.levelComplete) {
            this.level++;
            this.advanceToNextBoss();
        } else {
            console.log("Retrying level with new buff...");
            this.startRound();
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



    // ==================== ITEM FUSION SYSTEM ====================
    /**
     * Item Fusion System:
     * - 3 identical items (same templateId AND same starLevel) can be fused
     * - Fusing creates 1 item with starLevel + 1
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