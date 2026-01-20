import { dataManager } from '../managers/DataManager.js';

export class GlobalBuffSystem {
    constructor() {
        this.activeBuffs = new Set();
    }

    get buffDefinitions() {
        return dataManager.blessings || {};
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
