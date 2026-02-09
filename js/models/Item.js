/**
 * Item class representing an item in the game.
 * 
 * Star Level System:
 * - Items start at 0 stars (base item)
 * - Combining 3 identical items (same templateId and starLevel) creates a 1-star item
 * - 3 identical 1-star items create a 2-star item, and so on up to 10 stars
 * - Each star level DOUBLES all stats (damage, block, effects, etc.)
 * - Stat multiplier = 2^starLevel (0 stars = x1, 1 star = x2, 2 stars = x4, etc.)
 */
export class Item {
    constructor(data, starLevel = 0) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.templateId = data.id;
        this.name = data.name;
        this.type = data.type; // 'weapon', 'shield', 'relic'
        this.subtype = data.subtype; // 'sword', 'axe', 'dagger'
        this.baseIcon = data.icon;
        this.set = data.set;
        this.rarity = data.rarity;
        this.price = data.price;

        // Star level (0-10): each star doubles stats
        this.starLevel = Math.min(10, Math.max(0, starLevel));
        this.statMultiplier = Math.pow(2, this.starLevel);

        // Base stats (before star multiplier)
        this.baseStats = data.stats || {};
        this.baseEffects = JSON.parse(JSON.stringify(data.effects || {})); // Deep copy

        // Apply star multiplier to stats
        this.stats = this.applyStarMultiplier(this.baseStats);
        this.damage = this.stats.damage || 0;
        this.critChance = this.stats.critChance || 0;

        // Cooldown in MS. JSON has seconds. (Cooldown does NOT scale with stars)
        this.cooldown = (this.baseStats.cooldown || 0) * 1000;
        this.currentCooldown = 0;

        // Apply star multiplier to effects
        this.effects = this.applyStarMultiplierToEffects(this.baseEffects, this.statMultiplier, this.starLevel);

        this.description = this.generateDescription();

        // Icon (placeholder logic based on type/subtype)
        this.icon = this.getIcon();
    }

    /**
     * Apply star level multiplier to stats.
     * Damage, block, and attackSpeed scale with stars. Cooldown and chances do not.
     */
    /**
     * Apply star level multiplier to stats.
     * Damage, block, and attackSpeed scale with stars. Cooldown and chances do not.
     */
    applyStarMultiplier(baseStats, customMult = null) {
        const mult = customMult !== null ? customMult : this.statMultiplier;
        const scaled = { ...baseStats };
        if (scaled.damage) scaled.damage = Math.floor(scaled.damage * mult);
        if (scaled.block) scaled.block = scaled.block * mult;
        if (scaled.shield) scaled.shield = Math.floor(scaled.shield * mult);
        if (scaled.attackSpeed) scaled.attackSpeed = scaled.attackSpeed * mult;
        return scaled;
    }

    /**
     * Apply star level multiplier to effect damage values.
     * damagePerTick and heal scale with stars. Chances and durations do not.
     */
    /**
     * Apply star level multiplier to effect values.
     * Most effects (damage, heal, count) scale with stars.
     * Multihit is a special case: chance * mult, count + starLevel.
     */
    applyStarMultiplierToEffects(baseEffects, customMult = null, targetStarLevel = null) {
        const mult = customMult !== null ? customMult : this.statMultiplier;
        const level = targetStarLevel !== null ? targetStarLevel : this.starLevel;
        const scaled = JSON.parse(JSON.stringify(baseEffects)); // Deep copy

        for (const [key, effect] of Object.entries(scaled)) {
            if (key === 'multihit') {
                // Special scaling for multihit:
                // Count scales linearly (count + starLevel)
                // Chance does NOT scale with stars
                effect.count = effect.count + level;
                continue; // Skip generic scaling below
            }

            if (effect.damagePerTick) {
                effect.damagePerTick = Math.floor(effect.damagePerTick * mult);
            }
            if (effect.heal) {
                effect.heal = Math.floor(effect.heal * mult);
            }
            if (effect.maxHpGain) {
                effect.maxHpGain = Math.floor(effect.maxHpGain * mult);
            }
        }
        return scaled;
    }

    getPreview(targetLevel) {
        if (targetLevel > 10) return null;
        // Multiplier = 2^level (matches constructor: Math.pow(2, starLevel))
        const mult = Math.pow(2, targetLevel);

        return {
            starLevel: targetLevel,
            stats: this.applyStarMultiplier(this.baseStats, mult),
            effects: this.applyStarMultiplierToEffects(this.baseEffects, mult, targetLevel)
        };
    }

    /**
     * Get star display string (e.g., "★★★" for 3 stars)
     */
    getStarDisplay() {
        if (this.starLevel === 0) return '';
        return '★'.repeat(this.starLevel);
    }

    getIcon() {
        if (this.baseIcon) return this.baseIcon;
        if (this.subtype === 'sword') return "⚔️";
        if (this.subtype === 'axe') return "🪓";
        if (this.subtype === 'dagger') return "🗡️";
        if (this.subtype === 'wand') return "🪄";
        if (this.subtype === 'spear') return "🔱";
        if (this.type === 'shield') return "🛡️";
        if (this.type === 'relic') return "💍";
        return "📦";
    }

    generateDescription() {
        let parts = [];

        // Show star level if upgraded
        if (this.starLevel > 0) {
            parts.push(`${this.getStarDisplay()} (x${this.statMultiplier} stats)`);
        }

        if (this.damage > 0) parts.push(`Dmg: ${this.damage}`);
        if (this.cooldown > 0) parts.push(`CD: ${this.cooldown / 1000}s`);
        if (this.stats.shield) parts.push(`Shield: ${this.stats.shield}`);
        if (this.stats.block) parts.push(`Block: ${this.stats.block}`);
        if (this.stats.attackSpeed) parts.push(`Speed: +${(this.stats.attackSpeed * 100).toFixed(0)}%`);

        for (const [key, val] of Object.entries(this.effects)) {
            // Pretty print effects
            if (key === 'poison') parts.push(`Poison: ${val.damagePerTick}dmg/${val.duration}s`);
            else if (key === 'bleed') parts.push(`Bleed: ${val.damagePerTick}dmg/${val.duration}s`);
            else if (key === 'multihit') parts.push(`Multihit: x${val.count} (${(val.chance * 100).toFixed(0)}%)`);
            else if (key === 'holy') {
                let desc = `Holy: ${val.heal} heal`;
                if (val.maxHpGain) desc += ` & +${val.maxHpGain} MaxHP`;
                parts.push(desc);
            }
            else if (key === 'fire') parts.push(`Fire: ${val.damagePerTick}dmg/${val.duration}s`);
            else if (key === 'shadow') parts.push(`Shadow: ${val.damagePerTick}dmg/${val.duration}s`);
            else if (key === 'curse') parts.push(`Curse: ${val.damagePerTick}dmg/${val.duration}s`);
            else if (key === 'frozen') parts.push(`Frozen: ${(val.chance * 100).toFixed(0)}% chance`);
            else parts.push(`${key.toUpperCase()}`);
        }

        return parts.join('\n');
    }

    /**
     * Get display name with star indicator
     */
    getDisplayName() {
        if (this.starLevel > 0) {
            return `${this.name} ${this.getStarDisplay()}`;
        }
        return this.name;
    }
}
