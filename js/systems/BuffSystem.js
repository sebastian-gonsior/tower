/**
 * BuffSystem - Aggregates stats and effects from equipped items.
 * 
 * Supported Buff Types (per game.md manifesto):
 * - speedBonus: Increases attack speed (from Relics)
 * - critChance: Chance to land critical hits
 * - critDmg: Critical damage multiplier (base x2)
 * - multihitChance: Chance to trigger multiple hits
 * - multihitCount: Number of hits when multihit triggers (up to 100)
 * 
 * Item Sets:
 * - Rogue Set: Poison-based, Dagger/Sword weapons, Attackspeed/Poison relics
 * - Warrior Set: Bleed-based, Sword/Axe weapons, Attackspeed/Bleed/Crit relics
 * - General Set: Crit, Attackspeed, Multihit, Holy relics
 */
import { globalBuffSystem } from './GlobalBuffSystem.js';
import { dataManager } from '../managers/DataManager.js';

export class BuffSystem {
    /**
     * Calculate all global bonuses active for the player, including inactive set bonuses for display.
     * @param {Array} slots - Context slots for set bonuses
     * @returns {Object} { speedBonus, critChance, critDmg, multihitBonus, lifesteal, setBonuses }
     */
    static calculateGlobalBonuses(slots) {
        let bonuses = {
            speedBonus: 0,
            critChance: 0,
            critDmg: 0,
            multihitCount: 0,
            lifesteal: 0,
            setBonuses: []
        };

        // 1. Aggregate stats from all items in slots (Relics, Weapons, Shields contribute globally where applicable)
        if (slots) {
            slots.forEach(item => {
                if (item) {
                    if (item.stats.attackSpeed) bonuses.speedBonus += item.stats.attackSpeed;
                    if (item.stats.critChance) bonuses.critChance += item.stats.critChance;
                    if (item.stats.critDmg) bonuses.critDmg += item.stats.critDmg;
                    if (item.effects && item.effects.lifesteal) bonuses.lifesteal += item.effects.lifesteal.factor;
                }
            });
        }

        // 2. Blessings
        if (globalBuffSystem.hasBuff('SPEED_PCT_10')) bonuses.speedBonus += 0.10;
        if (globalBuffSystem.hasBuff('CRIT_PCT_10')) bonuses.critChance += 0.10;
        if (globalBuffSystem.hasBuff('CRIT_DMG_3X')) bonuses.critDmg = Math.max(bonuses.critDmg, 1.0); // Ensure it's at least 1.0 (total 3.0)
        if (globalBuffSystem.hasBuff('MULTIHIT_PLUS_1')) bonuses.multihitCount += 1;
        if (globalBuffSystem.hasBuff('LIFELEECH_PCT_10')) bonuses.lifesteal += 0.10;

        // 3. Generic Set Bonus Calculation
        const allSets = dataManager.getAllSets();
        const counts = globalBuffSystem.getActiveSetBonuses(slots);

        allSets.forEach(setDef => {
            const count = counts[setDef.id] || 0;
            if (setDef.bonuses) {
                setDef.bonuses.forEach(bonus => {
                    const isActive = count >= bonus.threshold;

                    // Track for UI and processing
                    bonuses.setBonuses.push({
                        ...bonus,
                        active: isActive
                    });

                    // Apply stat bonuses if active
                    if (isActive && bonus.stats) {
                        for (const [stat, value] of Object.entries(bonus.stats)) {
                            if (bonuses.hasOwnProperty(stat)) {
                                bonuses[stat] += value;
                            }
                        }
                    }
                });
            }
        });

        return bonuses;
    }

    /**
     * Get combined stats and modified effects for an item.
     * @param {Item} item 
     * @param {Array} slots 
     */
    static getItemCombinedStats(item, slots) {
        const globals = this.calculateGlobalBonuses(slots);
        const baseStats = item.stats || {};
        const baseEffects = JSON.parse(JSON.stringify(item.effects || {})); // Work on a copy

        // 1. Calculate Stat Totals
        const combined = {
            damage: baseStats.damage || 0,
            cooldown: baseStats.cooldown || 0,
            block: baseStats.block || 0,
            attackSpeed: (1 / (baseStats.cooldown || 1)) * (1 + globals.speedBonus),
            critChance: (baseStats.critChance || 0) + globals.critChance,
            critDmg: (baseStats.critDmg || 2.0) + globals.critDmg,
            multihitCount: 1 + globals.multihitCount,
            lifesteal: globals.lifesteal,
            sources: [],
            setBonuses: globals.setBonuses,
            modifiedEffects: {}
        };

        // 2. Track sources for UI
        if (globalBuffSystem.hasBuff('SPEED_PCT_10')) combined.sources.push({ name: 'Haste Blessing', bonus: '+10% Speed', type: 'blessing' });
        if (globalBuffSystem.hasBuff('CRIT_PCT_10')) combined.sources.push({ name: 'Crit Blessing', bonus: '+10% Crit', type: 'blessing' });
        if (globalBuffSystem.hasBuff('CRIT_DMG_3X')) combined.sources.push({ name: 'Lethality Blessing', bonus: '+1x Crit Dmg', type: 'blessing' });
        if (globalBuffSystem.hasBuff('MULTIHIT_PLUS_1')) combined.sources.push({ name: 'Echo Blessing', bonus: '+1 Hit', type: 'blessing' });
        if (globalBuffSystem.hasBuff('LIFELEECH_PCT_10')) combined.sources.push({ name: 'Lifesteal Blessing', bonus: '+10% Lifesteal', type: 'blessing' });

        globals.setBonuses.forEach(sb => {
            if (sb.active) combined.sources.push({ name: sb.name, bonus: sb.description, type: 'set' });
        });

        // 3. Handle Effect Modifications (Generic from sets.json)
        for (const [type, data] of Object.entries(baseEffects)) {
            const mod = { ...data, original: { ...data } };

            globals.setBonuses.forEach(sb => {
                if (sb.active && sb.modifiers && sb.modifiers[type]) {
                    const m = sb.modifiers[type];
                    if (m.damageMult) mod.damagePerTick *= m.damageMult;
                    if (m.tickInterval) mod.tickInterval = m.tickInterval;

                    mod.isModified = true;
                    // Aggregate labels
                    if (m.label) {
                        mod.modLabel = (mod.modLabel ? mod.modLabel + ', ' : '') + `${sb.name}: ${m.label}`;
                    }
                }
            });

            combined.modifiedEffects[type] = mod;
        }

        return combined;
    }

    /**
     * Calculate aggregated buffs from all items in the given slots.
     * @param {Array} slots - Array of Item objects (can contain nulls)
     * @returns {Object} Aggregated buff stats
     */
    static calculateBuffs(slots) {
        let stats = {
            speedBonus: 0,
            critDmg: 2.0,
            critChance: 0,
            multihitChance: 0,
            multihitCount: 0
        };

        slots.forEach(item => {
            if (item) {
                // Global stats from both Relics and Weapons
                if (item.type === 'relic' || item.type === 'weapon' || item.type === 'shield') {
                    if (item.stats.attackSpeed) stats.speedBonus += item.stats.attackSpeed;
                    if (item.stats.critChance) stats.critChance += item.stats.critChance;
                    if (item.stats.critDmg) stats.critDmg += item.stats.critDmg;
                }

                // Effects that act as buffs
                if (item.effects && item.effects.multihit) {
                    stats.multihitChance += item.effects.multihit.chance;
                    stats.multihitCount += item.effects.multihit.count;
                }
            }
        });
        return stats;
    }
}
