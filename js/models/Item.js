/**
 * Item class representing an item in the game.
 * 
 * Star Level System:
 * - Items start at 0 stars (base item)
 * - Combining 3 identical items (same templateId and starLevel) creates a 1-star item
 * - 3 identical 1-star items create a 2-star item, and so on up to 10 stars
 * - Star level (0-10): each star level applies manual bonuses defined in the item template
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
        this.customDescription = data.description || null;

        // Star level (0-10)
        this.starLevel = Math.min(10, Math.max(0, starLevel));

        // Base stats and effects
        this.stats = { ...(data.stats || {}) };
        this.effects = JSON.parse(JSON.stringify(data.effects || {}));
        this.starLevelSummary = null;

        // Store original data for preview generation
        this.rawStarsData = data.stars;
        this.baseStats = data.stats; // Keep for getTemplateData
        this.baseEffects = data.effects; // Keep for getTemplateData

        // Apply manual star bonuses
        this.applyManualStarBonuses(data);

        this.damage = this.stats.damage || 0;
        this.critChance = this.stats.critChance || 0;

        // Cooldown in MS. JSON has seconds.
        this.cooldown = (this.stats.cooldown || 0) * 1000;
        this.currentCooldown = 0;

        this.description = this.generateDescription();

        // Icon (placeholder logic based on type/subtype)
        this.icon = this.getIcon();
    }

    /**
     * Apply manual star bonuses from the item data.
     * Bonuses define the TOTAL added stats for that specific star level.
     */
    applyManualStarBonuses(data) {
        if (!data.stars || this.starLevel === 0) return;

        const starData = data.stars[this.starLevel.toString()];
        if (starData) {
            // Apply Stats
            if (starData.stats) {
                for (const [key, val] of Object.entries(starData.stats)) {
                    this.stats[key] = (this.stats[key] || 0) + val;
                }
            }

            // Apply Effects
            if (starData.effects) {
                for (const [key, val] of Object.entries(starData.effects)) {
                    if (!this.effects[key]) {
                        this.effects[key] = { ...val };
                    } else {
                        // Merge logic for specific effect types
                        if (key === 'multihit') {
                            this.effects[key].count = (this.effects[key].count || 0) + (val.count || 0);
                        } else if (val.damagePerTick) {
                            this.effects[key].damagePerTick = (this.effects[key].damagePerTick || 0) + val.damagePerTick;
                        } else if (val.heal) {
                            this.effects[key].heal = (this.effects[key].heal || 0) + val.heal;
                        } else if (val.maxHpGain) {
                            this.effects[key].maxHpGain = (this.effects[key].maxHpGain || 0) + val.maxHpGain;
                        }
                    }
                }
            }

            // Capture the summary
            this.starLevelSummary = starData.summary || null;
        }
    }

    /**
     * Get a preview of the item at a specific target star level.
     * Returns a full Item instance for accurate UI/Stat calculations.
     */
    getPreview(targetLevel) {
        if (targetLevel > 10) return null;
        return new Item(this.getTemplateData(), targetLevel);
    }

    /**
     * Internal helper to get the original template data
     */
    getTemplateData() {
        return {
            id: this.templateId,
            name: this.name,
            type: this.type,
            subtype: this.subtype,
            icon: this.baseIcon,
            set: this.set,
            rarity: this.rarity,
            price: this.price,
            description: this.customDescription,
            stats: this.baseStats,
            effects: this.baseEffects,
            stars: this.rawStarsData // We need to store this in constructor
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

    /**
     * Returns a human-readable summary of the item's stats and effects.
     */
    getStatSummary() {
        if (this.type === 'consumable' || this.type === 'utility') {
            return this.customDescription || "";
        }

        let parts = [];
        const s = this.stats;

        if (s.damage) parts.push(`<b>${s.damage}</b> Damage`);
        if (s.attackSpeed) parts.push(`+<b>${Math.round(s.attackSpeed * 100)}%</b> Haste`);
        if (s.critChance) parts.push(`+<b>${Math.round(s.critChance * 100)}%</b> Crit Chance`);
        if (s.critDmg) parts.push(`+<b>${(s.critDmg).toFixed(1)}x</b> Crit Dmg`);
        if (s.block) parts.push(`+<b>${Math.round(s.block * 100)}%</b> Block`);
        if (s.shield) parts.push(`+<b>${s.shield}</b> Shield`);

        // Effects
        for (const [key, val] of Object.entries(this.effects)) {
            if (key === 'poison') parts.push(`<b>${val.damagePerTick}</b> Poison dmg`);
            else if (key === 'bleed') parts.push(`<b>${val.damagePerTick}</b> Bleed dmg`);
            else if (key === 'fire') parts.push(`<b>${val.damagePerTick}</b> Burn dmg`);
            else if (key === 'lifesteal') parts.push(`<b>${Math.round(val.factor * 100)}%</b> Lifesteal`);
            else if (key === 'multihit') parts.push(`<b>+${val.count}</b> Additional Hits`);
            else if (key === 'holy') parts.push(`<b>${val.heal}</b> Heal on hit`);
        }

        if (parts.length === 0) return "";

        // Join with "and" for the last element
        if (parts.length === 1) return `Provides ${parts[0]}.`;
        const last = parts.pop();
        let summaryText = `Provides ${parts.join(', ')} and ${last}.`;

        // Add Manual Star Bonus Text
        if (this.starLevel > 0 && this.starLevelSummary) {
            summaryText += `<br><span style="color: #ffd700;">${'⭐'.repeat(this.starLevel)} Additional ${this.starLevelSummary}</span>`;
        }

        return summaryText;
    }

    generateDescription() {
        let parts = [];

        if (this.customDescription) {
            parts.push(this.customDescription);
            parts.push(""); // Spacer
        }

        // Show star level if upgraded
        if (this.starLevel > 0) {
            parts.push(`${this.getStarDisplay()} Level ${this.starLevel}`);
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
            else if (key === 'multihit') parts.push(`Additional Hits: +${val.count}`);
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
