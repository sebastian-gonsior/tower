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
     * @param {Item} excludeItem - Optional item to exclude from flat stat aggregation
     * @returns {Object} { speedBonus, critChance, critDmg, multihitBonus, lifesteal, setBonuses }
     */
    static calculateGlobalBonuses(slots, excludeItem = null) {
        let bonuses = {
            speedBonus: 0,
            critChance: 0,
            critDmg: 0,
            multihitCount: 0,
            lifesteal: 0,
            damageBonus: 0,
            shieldBonus: 0, // Flat Shield (Absorb)
            blockChance: 0, // % Damage Reduction
            setBonuses: [],
            addedEffects: {} // New: Store global effects from relics
        };

        // 1. Aggregate stats from all items in slots (Relics contribute globally)
        if (slots) {
            slots.forEach(item => {
                if (item && item !== excludeItem) {
                    // Global Stats from all items
                    if (item.stats.block) bonuses.blockChance += item.stats.block;
                    if (item.stats.shield) bonuses.shieldBonus += item.stats.shield;

                    if (item.type === 'relic') {
                        if (item.stats.attackSpeed) bonuses.speedBonus += item.stats.attackSpeed;
                        if (item.stats.critChance) bonuses.critChance += item.stats.critChance;
                        if (item.stats.critDmg) bonuses.critDmg += item.stats.critDmg;
                        if (item.stats.damage) bonuses.damageBonus += item.stats.damage;

                        // Handle Global Effects from Relics
                        if (item.effects) {
                            if (item.effects.lifesteal) bonuses.lifesteal += item.effects.lifesteal.factor;
                            if (item.effects.multihit) bonuses.multihitCount += item.effects.multihit.count;

                            // Aggregate other effects (Poison, Bleed, Fire, etc.)
                            const globalEffectTypes = ['poison', 'bleed', 'fire', 'shadow', 'curse', 'frozen', 'holy', 'goldOnHit'];

                            globalEffectTypes.forEach(type => {
                                if (item.effects[type]) {
                                    if (!bonuses.addedEffects[type]) {
                                        bonuses.addedEffects[type] = { ...item.effects[type] };
                                    } else {
                                        // Merge/Stack logic if multiple relics give same effect
                                        const existing = bonuses.addedEffects[type];
                                        const next = item.effects[type];

                                        if (next.damagePerTick) existing.damagePerTick = (existing.damagePerTick || 0) + next.damagePerTick;
                                        if (next.amount) existing.amount = (existing.amount || 0) + next.amount; // Gold
                                        if (next.heal) existing.heal = (existing.heal || 0) + next.heal;
                                        if (next.duration) existing.duration = Math.max(existing.duration || 0, next.duration);
                                    }
                                }
                            });
                        }
                    }
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
        const counts = globalBuffSystem.getActiveSetBonuses(slots); // Use the full slots for counting

        allSets.forEach(setDef => {
            const count = counts[setDef.id] || 0;
            if (setDef.bonuses) {
                setDef.bonuses.forEach(bonus => {
                    const isActive = count >= bonus.threshold;

                    // Track for UI and processing
                    bonuses.setBonuses.push({
                        ...bonus,
                        setId: setDef.id,
                        active: isActive
                    });

                    // Apply stat bonuses if active
                    if (isActive && bonus.stats) {
                        for (const [stat, value] of Object.entries(bonus.stats)) {
                            // Support mapping common names to internal names
                            const internalStat = stat === 'damage' ? 'damageBonus' :
                                stat === 'shield' ? 'shieldBonus' :
                                    stat === 'block' ? 'blockChance' : stat;

                            if (bonuses.hasOwnProperty(internalStat)) {
                                bonuses[internalStat] += value;
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
        // Use full slots for set bonuses, but exclude the item itself from global flat stats
        const globals = this.calculateGlobalBonuses(slots, item);

        const baseStats = item.stats || {};
        const baseEffects = JSON.parse(JSON.stringify(item.effects || {})); // Work on a copy

        // Relics contribute their effects globally
        let itemMultihit = 0;
        let itemLifesteal = 0;
        if (item.type === 'relic') {
            if (item.effects && item.effects.multihit) itemMultihit = item.effects.multihit.count;
            if (item.effects && item.effects.lifesteal) itemLifesteal = item.effects.lifesteal.factor;
        }

        // 1. Calculate Stat Totals
        const combined = {
            damage: (baseStats.damage || 0) + (item.type === 'weapon' ? globals.damageBonus : 0),
            cooldown: (baseStats.cooldown || 0) * 1000,
            shield: (baseStats.shield || 0) + (item.type === 'shield' ? globals.shieldBonus : 0),
            block: (baseStats.block || 0) + globals.blockChance,
            attackSpeed: (1 / (baseStats.cooldown || 1)) * (1 + globals.speedBonus),
            critChance: (baseStats.critChance || 0) + globals.critChance,
            critDmg: (baseStats.critDmg || 2.0) + globals.critDmg,
            multihitCount: 1 + globals.multihitCount + itemMultihit,
            lifesteal: globals.lifesteal + itemLifesteal,
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

        // Merge Global Effects (from Relics) into Base Effects
        if (globals.addedEffects) {
            for (const [type, data] of Object.entries(globals.addedEffects)) {
                if (!baseEffects[type]) {
                    baseEffects[type] = { ...data }; // Add new effect
                    combined.sources.push({ name: 'Relic Effect', bonus: type, type: 'relic' });
                } else {
                    // Stack with existing item effect
                    // E.g. Weapon has Bleed, Relic has Bleed -> Stack values
                    baseEffects[type].damagePerTick = (baseEffects[type].damagePerTick || 0) + (data.damagePerTick || 0);
                    baseEffects[type].amount = (baseEffects[type].amount || 0) + (data.amount || 0);
                    baseEffects[type].heal = (baseEffects[type].heal || 0) + (data.heal || 0);
                    baseEffects[type].duration = Math.max(baseEffects[type].duration || 0, data.duration || 0);

                    // Keep track of source?
                }
            }
        }

        // 3. Handle Effect Modifications (Generic from sets.json)
        for (const [type, data] of Object.entries(baseEffects)) {
            const mod = { ...data, original: { ...data } };

            globals.setBonuses.forEach(sb => {
                if (sb.active && sb.modifiers && sb.modifiers[type]) {
                    const m = sb.modifiers[type];
                    if (m.damageMult) {
                        if (mod.damagePerTick) mod.damagePerTick *= m.damageMult;
                        if (mod.heal) mod.heal *= m.damageMult; // Also apply to holy healing
                    }
                    if (m.tickInterval) mod.tickInterval = m.tickInterval;
                    if (m.chanceMult && mod.chance) mod.chance *= m.chanceMult;

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
        const globals = this.calculateGlobalBonuses(slots);

        let stats = {
            speedBonus: globals.speedBonus,
            critDmg: 2.0 + globals.critDmg,
            critChance: globals.critChance,
            multihitChance: 0,
            multihitCount: globals.multihitCount,
            damageBonus: globals.damageBonus,
            shieldBonus: globals.shieldBonus,
            blockChance: globals.blockChance,
            lifesteal: globals.lifesteal
        };

        slots.forEach(item => {
            if (item) {
                // Effects that act as buffs
                if (item.effects && item.effects.multihit) {
                    stats.multihitChance += item.effects.multihit.chance;
                    // We don't add multihitCount here because it's handled differently in combat
                    // or should it? In calculateGlobalBonuses it's already summed for relics etc.
                }
            }
        });
        return stats;
    }
}
