import { bus } from '../utils/EventBus.js';

class DamageMeterSystem {
    constructor() {
        this.reset();
        this.setupListeners();
    }

    reset() {
        this.startTime = 0;
        this.isFighting = false;
        this.stats = {
            player: { totalDamage: 0, totalHealing: 0, totalBlocked: 0, sources: {} },
            enemy: { totalDamage: 0, totalHealing: 0, totalBlocked: 0, sources: {} }
        };
    }

    setupListeners() {
        bus.on('UI_REQUEST_START_FIGHT', () => {
            this.reset();
            this.isFighting = true;
            this.startTime = Date.now();
            this.emitUpdate();
        });

        bus.on('FIGHT_ENDED', () => {
            this.isFighting = false;
        });

        bus.on('DAMAGE_DEALT', (data) => this.handleDamage(data));
        bus.on('HEAL_APPLIED', (data) => this.handleHeal(data));
        // Track direct gold gain events if possible, or bus 'GOLD_EARNED'? 
        // Currently GOLD_UPDATED doesn't give amount. 
        // CombatSystem emits SHOW_FLOATING_TEXT with critType='gold'.
        bus.on('SHOW_FLOATING_TEXT', (data) => {
            if (data.isCrit && data.critType === 'gold') {
                this.handleGold(data);
            }
        });
    }

    handleGold(data) {
        // data: { target: 'player', amount: 50 ... }
        // 'damage' might be string "50g", so parse it
        const raw = data.amount !== undefined ? data.amount : data.damage;
        const val = parseInt(String(raw)); // parseFloat works for "50g" -> 50

        if (data.target === 'player' && !isNaN(val)) {
            this.addEntry('player', 'Gold Earned', val, 'gold');
        }
    }

    handleDamage(data) {
        // data: { target, damage, sourceItem, sourceType, debuffType }
        // If target is 'enemy', source is 'player'.
        // If target is 'player', source is 'enemy'.

        // Exception: Self-damage (not currently in game, but Reflect counts as damage to Enemy from Player)

        let sourceEntity = data.target === 'enemy' ? 'player' : 'enemy';
        let sourceName = "Auto Attack"; // Default changed from "Unknown"

        if (data.sourceType === 'item') {
            sourceName = data.sourceItem ? data.sourceItem.name : "Auto Attack";
        } else if (data.sourceType === 'debuff') {
            sourceName = data.debuffType ?
                data.debuffType.charAt(0).toUpperCase() + data.debuffType.slice(1) : "Debuff";
        } else if (data.sourceType === 'reflect') {
            sourceName = "Reflect";
        }

        this.addEntry(sourceEntity, sourceName, data.damage, 'damage', data.blocked || 0);
    }

    handleHeal(data) {
        // data: { target, amount, sourceItem... }
        // Heals are usually attributed to the target themselves (Self-healing) logic-wise for now
        // Player healing Player -> Player Stat

        const entity = data.target; // 'player' or 'enemy'
        let sourceName = "Healing";

        if (data.sourceType === 'item') {
            sourceName = data.sourceItem ? data.sourceItem.name : "Heal";
        } else if (data.sourceType === 'lifesteal') {
            sourceName = "Lifesteal";
        } else if (data.sourceType === 'regen') {
            sourceName = "Regeneration";
        } else if (data.sourceType === 'shield') {
            sourceName = "Shield Absorb";
        }

        this.addEntry(entity, sourceName, data.amount, 'healing');
    }

    addEntry(entity, sourceName, amount, type, blockedAmount = 0) {
        if ((!amount || amount <= 0) && (!blockedAmount || blockedAmount <= 0)) return;

        const entityStats = this.stats[entity];
        if (!entityStats) return;

        if (type === 'damage') {
            entityStats.totalDamage += amount;
            entityStats.totalBlocked += blockedAmount;
        }
        if (type === 'healing') entityStats.totalHealing += amount;
        // Don't add gold to totalDamage

        if (!entityStats.sources[sourceName]) {
            entityStats.sources[sourceName] = { damage: 0, healing: 0, gold: 0, blocked: 0, hits: 0, type: type }; // Store main type
        }

        const source = entityStats.sources[sourceName];
        if (type === 'damage') {
            source.damage += amount;
            source.blocked += blockedAmount;
        }
        if (type === 'healing') source.healing += amount;
        if (type === 'gold') source.gold += amount;

        source.hits++;

        this.emitUpdate();
    }

    emitUpdate() {
        // Calculate DPS/HPS
        const now = Date.now();
        const duration = Math.max(1, (this.isFighting ? now : now) - this.startTime) / 1000;

        const formatStats = (stats) => {
            const entries = Object.entries(stats.sources).map(([name, data]) => ({
                name,
                ...data,
                dps: data.damage / duration,
                hps: data.healing / duration,
                pct: (data.damage / (stats.totalDamage || 1)) * 100
            }));

            // Sort by Damage desc
            entries.sort((a, b) => b.damage - a.damage);

            return {
                totalDamage: stats.totalDamage,
                totalHealing: stats.totalHealing,
                totalBlocked: stats.totalBlocked,
                dps: stats.totalDamage / duration,
                hps: stats.totalHealing / duration,
                duration,
                entries
            };
        };

        bus.emit('METER_UPDATE', {
            player: formatStats(this.stats.player),
            enemy: formatStats(this.stats.enemy)
        });
    }
}

export const damageMeterSystem = new DamageMeterSystem();
