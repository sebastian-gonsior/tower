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
export class BuffSystem {
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
                // Global stats from Relics only
                if (item.type === 'relic') {
                    if (item.stats.attackSpeed) stats.speedBonus += item.stats.attackSpeed;
                    if (item.stats.critChance) stats.critChance += item.stats.critChance;
                }

                // Effects that act as buffs
                if (item.effects && item.effects.multihit) {
                    stats.multihitChance += item.effects.multihit.chance;
                    // Taking the max count or summing? Usually max or sum. Let's sum for now or max.
                    // If one item gives x2 multihit and another x3, do we hit x5? 
                    // Manifesto says "up to 100 times".
                    // Let's sum counts but keep chance separate? 
                    // Or maybe chance is additive.
                    stats.multihitCount += item.effects.multihit.count;
                }
            }
        });
        return stats;
    }
}
