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
        this.set = data.set;
        this.rarity = data.rarity;
        this.level = data.minLevel;
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
        this.effects = this.applyStarMultiplierToEffects(this.baseEffects);
        
        this.description = this.generateDescription();
        
        // Icon (placeholder logic based on type/subtype)
        this.icon = this.getIcon();
    }
    
    /**
     * Apply star level multiplier to stats.
     * Damage, block, and attackSpeed scale with stars. Cooldown and chances do not.
     */
    applyStarMultiplier(baseStats) {
        const scaled = { ...baseStats };
        if (scaled.damage) scaled.damage = Math.floor(scaled.damage * this.statMultiplier);
        if (scaled.block) scaled.block = Math.floor(scaled.block * this.statMultiplier);
        if (scaled.attackSpeed) scaled.attackSpeed = scaled.attackSpeed * this.statMultiplier;
        // critChance doesn't scale (would be too OP)
        return scaled;
    }
    
    /**
     * Apply star level multiplier to effect damage values.
     * damagePerTick and heal scale with stars. Chances and durations do not.
     */
    applyStarMultiplierToEffects(baseEffects) {
        const scaled = JSON.parse(JSON.stringify(baseEffects)); // Deep copy
        for (const [key, effect] of Object.entries(scaled)) {
            if (effect.damagePerTick) {
                effect.damagePerTick = Math.floor(effect.damagePerTick * this.statMultiplier);
            }
            if (effect.heal) {
                effect.heal = Math.floor(effect.heal * this.statMultiplier);
            }
        }
        return scaled;
    }
    
    /**
     * Get star display string (e.g., "★★★" for 3 stars)
     */
    getStarDisplay() {
        if (this.starLevel === 0) return '';
        return '★'.repeat(this.starLevel);
    }
    
    getIcon() {
        if (this.subtype === 'sword') return "⚔️";
        if (this.subtype === 'axe') return "🪓";
        if (this.subtype === 'dagger') return "🗡️";
        if (this.subtype === 'wand') return "🪄";
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
        if (this.cooldown > 0) parts.push(`CD: ${this.cooldown/1000}s`);
        if (this.stats.block) parts.push(`Block: ${this.stats.block}`);
        if (this.stats.attackSpeed) parts.push(`Speed: +${(this.stats.attackSpeed * 100).toFixed(0)}%`);
        
        for (const [key, val] of Object.entries(this.effects)) {
             // Pretty print effects
             if (key === 'poison') parts.push(`Poison: ${val.damagePerTick}dmg/${val.duration}s`);
             else if (key === 'bleed') parts.push(`Bleed: ${val.damagePerTick}dmg/${val.duration}s`);
             else if (key === 'multihit') parts.push(`Multihit: ${(val.chance*100).toFixed(0)}%`);
             else if (key === 'holy') parts.push(`Holy: ${val.heal} heal`);
             else if (key === 'fire') parts.push(`Fire: ${val.damagePerTick}dmg/${val.duration}s`);
             else if (key === 'shadow') parts.push(`Shadow: ${val.damagePerTick}dmg/${val.duration}s`);
             else if (key === 'curse') parts.push(`Curse: ${val.damagePerTick}dmg/${val.duration}s`);
             else if (key === 'frozen') parts.push(`Frozen: ${(val.chance*100).toFixed(0)}% chance`);
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
