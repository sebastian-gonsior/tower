import { GAME_CONFIG } from '../config.js';
import { bus } from '../utils/EventBus.js';
import { ItemFactory } from '../models/ItemFactory.js';

class GameState {
    constructor() {
        this.player = { hp: GAME_CONFIG.playerMaxHp, maxHp: GAME_CONFIG.playerMaxHp, shield: 0, maxShield: 0 };
        this.email = null;
        this.playerName = null;
        this.enemy = { hp: GAME_CONFIG.enemyMaxHp, maxHp: GAME_CONFIG.enemyMaxHp, shield: 0, maxShield: 0, name: "Enemy" };
        
        this.gold = 100;
        this.level = 1;
        this.lives = 3;
        
        this.activeSlots = new Array(GAME_CONFIG.slotsCount).fill(null);
        this.enemySlots = new Array(GAME_CONFIG.slotsCount).fill(null);
        this.stashSlots = new Array(GAME_CONFIG.stashCount).fill(null);
        
        this.lastFrameTime = 0;
        this.isFightActive = false;
        
        this.combatState = {
            playerStackingSpeed: 0,
            enemyStackingSpeed: 0,
            playerStackingDamage: 0,
            enemyStackingDamage: 0,
            playerStackingCrit: 0,
            enemyStackingCrit: 0
        };

        this.configureBoss();
    }

    reset() {
        this.player.hp = GAME_CONFIG.playerMaxHp;
        this.player.shield = 0;
        
        // Scale enemy HP with level
        this.enemy.maxHp = GAME_CONFIG.enemyMaxHp * this.level;
        this.enemy.hp = this.enemy.maxHp;
        this.enemy.shield = 0;
        this.enemy.maxShield = 0; // Default, can be overridden by items/boss config
        
        this.combatState.playerStackingSpeed = 0;
        this.combatState.enemyStackingSpeed = 0;
        this.combatState.playerStackingDamage = 0;
        this.combatState.enemyStackingDamage = 0;
        this.combatState.playerStackingCrit = 0;
        this.combatState.enemyStackingCrit = 0;

        this.configureBoss();

        this.isFightActive = false;
        this.resetCooldowns();
        bus.emit('STATE_RESET');
        bus.emit('HP_UPDATED');
    }

    configureBoss() {
        // Configure First Boss
        if (this.level === 1) {
            this.enemy.name = "DrachenLord";
            
            // Clear existing
            this.enemySlots.fill(null);
            
            this.enemySlots[0] = ItemFactory.createZeladSword();
            this.enemySlots[1] = ItemFactory.createDragonShield();
            this.enemySlots[2] = ItemFactory.createRageStone();
            
            // Notify UI
            bus.emit('SLOTS_UPDATED');
        } else {
             this.enemy.name = "Enemy Lvl " + this.level;
             // Random generation or other logic for later levels
             this.enemySlots.fill(null); // Clear for now or generate random
             bus.emit('SLOTS_UPDATED');
        }
    }

    resetCooldowns() {
        [...this.activeSlots, ...this.enemySlots, ...this.stashSlots].forEach(item => {
            if (item) item.currentCooldown = 0;
        });
    }

    setFightActive(active) {
        this.isFightActive = active;
        bus.emit('FIGHT_STATUS_CHANGED', active);
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

    removeLife() {
        this.lives--;
        bus.emit('LIVES_UPDATED', this.lives);
    }

    nextLevel() {
        this.level++;
        bus.emit('LEVEL_UPDATED', this.level);
    }
}

export const gameState = new GameState();
