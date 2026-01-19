export class GlobalBuffSystem {
    constructor() {
        this.activeBuffs = new Set();
        this.buffDefinitions = {
            1: [
                { id: 'GOLD_INSTANT_200', name: 'Instant Gold', description: '+200 Gold immediately', type: 'instant', icon: '💰' },
                { id: 'INCOME_25', name: 'Passive Income', description: '+25 Gold after every round', type: 'passive', icon: '📈' }
            ],
            2: [
                { id: 'MAXHP_3500', name: 'Vitality Boost', description: 'Sets Max HP to 3500 (One-time)', type: 'instant', icon: '❤️' },
                { id: 'SHIELD_ON_START', name: 'Energy Shield', description: 'Start round with Shield equal to Max HP', type: 'passive', icon: '🛡️' }
            ],
            3: [
                { id: 'MAXHP_PCT_10', name: 'Giant Growth', description: '+10% Max HP permanently', type: 'passive', icon: '💪' },
                { id: 'SHIELD_REFLECT_50', name: 'Thorns', description: 'Shield reflects 50% damage taken', type: 'passive', icon: '🌵' }
            ],
            4: [
                { id: 'CRIT_PCT_10', name: 'Precision', description: '+10% Critical Strike Chance', type: 'passive', icon: '🎯' },
                { id: 'LIFELEECH_PCT_10', name: 'Vampirism', description: '+10% Lifesteal on all damage', type: 'passive', icon: '🦇' }
            ],
            5: [
                { id: 'SPEED_PCT_10', name: 'Adrenaline', description: '+10% Attack Speed', type: 'passive', icon: '⚡' },
                { id: 'MAXHP_ON_HIT_1PCT', name: 'Feast', description: 'Gain 1% Max HP on every hit', type: 'passive', icon: '🍖' }
            ],
            6: [
                { id: 'MULTIHIT_PLUS_1', name: 'Echo Strike', description: '+1 Additional Hit', type: 'passive', icon: '💥' },
                { id: 'CRIT_DMG_3X', name: 'Lethality', description: 'Critical Hits deal 3x damage (up from 2x)', type: 'passive', icon: '☠️' }
            ],
            // Levels 7-10 are generic stat boosts
            generic: [
                { id: 'HP_2000', name: 'Health Injection', description: '+2000 Max HP', type: 'instant', icon: '💉' },
                { id: 'GOLD_1000', name: 'Treasure Trove', description: '+1000 Gold', type: 'instant', icon: '💎' }
            ]
        };
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
