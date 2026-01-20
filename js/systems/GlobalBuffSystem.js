import { dataManager } from '../managers/DataManager.js';
import { gameState } from '../state/GameState.js';

export class GlobalBuffSystem {
    constructor() {
        this.activeBuffs = new Set();
    }

    get buffDefinitions() {
        return dataManager.blessings || {};
    }

    /**
     * Count equipped items per set from provided slots.
     * @param {Array} [slots] - Optional slots array, defaults to gameState.activeSlots
     * @returns {Object} Map of set name to count
     */
    getActiveSetBonuses(slots = null) {
        const setCounts = {};
        const targetSlots = slots || gameState.activeSlots;
        if (!targetSlots) return setCounts;

        targetSlots.forEach(item => {
            if (item?.set) {
                setCounts[item.set] = (setCounts[item.set] || 0) + 1;
            }
        });
        return setCounts;
    }

    /**
     * Check if a set bonus threshold is met.
     * @param {string} setName - Name of the set
     * @param {number} threshold - pieces required
     * @param {Array} [slots] - Optional slots array
     * @returns {boolean}
     */
    hasSetBonus(setName, threshold, slots = null) {
        const counts = this.getActiveSetBonuses(slots);
        return (counts[setName] || 0) >= threshold;
    }

    /**
     * Get count of equipped items for a specific set.
     * @param {string} setName - Name of the set
     * @param {Array} [slots] - Optional slots array
     * @returns {number}
     */
    getSetCount(setName, slots = null) {
        const counts = this.getActiveSetBonuses(slots);
        return counts[setName] || 0;
    }

    getBuffsForLevel(level) {
        if (level >= 7) {
            return this.buffDefinitions.generic;
        }
        return this.buffDefinitions[level] || this.buffDefinitions.generic;
    }

    getAllBuffs() {
        const all = [];
        Object.entries(this.buffDefinitions).forEach(([level, buffs]) => {
            buffs.forEach(buff => {
                // Add level info to buff object for display if needed, avoiding mutation of original if possible, 
                // but for now just returning the definitions.
                all.push({ ...buff, level: level });
            });
        });
        return all;
    }

    addBuff(buffId) {
        this.activeBuffs.add(buffId);
        console.log(`Global Buff Added: ${buffId}`);
    }

    hasBuff(buffId) {
        return this.activeBuffs.has(buffId);
    }

    reset() {
        this.activeBuffs.clear();
    }
}

export const globalBuffSystem = new GlobalBuffSystem();
