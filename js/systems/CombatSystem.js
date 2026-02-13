import { gameState, PHASES } from '../state/GameState.js';
import { BuffSystem } from './BuffSystem.js';
import { bus } from '../utils/EventBus.js';
import { soundManager } from '../managers/SoundManager.js';
import { globalBuffSystem } from '../systems/GlobalBuffSystem.js';

/**
 * CombatSystem - Handles all combat mechanics for the game.
 *
 * Combat Mechanics (per game.md manifesto):
 * - Multihit: Can hit up to 100 times at once
 * - Critical Tiers:
 *   - Normal Crit: 100% more damage (x2 multiplier)
 *   - Super Crit: 200% more damage (x3 multiplier)
 *   - Hyper Crit: 400% more damage (x5 multiplier)
 * - DoT Effects (Damage over Time):
 *   - Bleed: 10 seconds duration, stacks and refreshes
 *   - Curse: 20 seconds duration, stacks and refreshes
 *   - Poison: 15 seconds duration, stacks and refreshes
 *   - Fire: 5 seconds duration, stacks and refreshes
 *   - Shadow: 10 seconds duration, stacks and refreshes
 *   - Now with explicit stack counting: each successful proc adds 1 stack
 *   - Duration refreshes on EVERY hit if the debuff exists (sustained by pressure)
 *   - Stack/damage increases only on chance proc (even after initial application)
 * - Frozen: Slows target by 5% per stack (up to 95%), each stack lasts 5 seconds.
 *   At exactly 10 stacks → triggers a 1-second full freeze and consumes all stacks.
 * - Holy: Heals the attacker
 */
export class CombatSystem {
    constructor() {
        this.init();
    }

    init() {
        // Listeners if needed
    }

    startFight() {
        console.log("Fight Started!");
        this.isFighting = true;

        // Initialize Boss Timer (3 minutes = 180 seconds)
        // Since all levels are effectively "bosses", we apply this to every fight.
        gameState.combatState.combatTimer = 180;

        // Global Buffs: Shield Start
        if (globalBuffSystem.hasBuff('SHIELD_ON_START')) {
            gameState.player.shield = gameState.player.maxHp;
            bus.emit('HP_UPDATED');
            console.log("[BUFF] Shield on Start Applied");
        }

        // Initial cooldowns
        this.applyInitialCooldown(gameState.activeSlots);
        this.applyInitialCooldown(gameState.enemySlots);

        // Ensure frozen timers exist (safety)
        gameState.combatState.playerFrozenTimer = 0;
        gameState.combatState.enemyFrozenTimer = 0;
    }

    endFight() {
        console.log("Fight Ended!");
        this.isFighting = false;
    }

    applyInitialCooldown(slots) {
        const buffs = BuffSystem.calculateBuffs(slots);
        slots.forEach(item => {
            if (item) {
                let speedMult = 1 + buffs.speedBonus;
                item.currentCooldown = item.cooldown / speedMult;
            }
        });
    }

    update(deltaTime) {
        if (!this.isFighting || gameState.phase !== PHASES.COMBAT) return;

        // Boss Timer Logic
        if (gameState.combatState.combatTimer > 0) {
            gameState.combatState.combatTimer -= (deltaTime / 1000); // Convert ms to seconds

            // Emit timer update for UI
            bus.emit('COMBAT_TIMER_UPDATE', Math.ceil(gameState.combatState.combatTimer));

            if (gameState.combatState.combatTimer <= 0) {
                gameState.combatState.combatTimer = 0;
                console.log("Boss timer ran out! Defeat triggered.");
                bus.emit('FIGHT_DEFEAT');
                return; // Stop processing this frame
            }
        }

        // Process Player Slots
        const playerBuffs = BuffSystem.calculateBuffs(gameState.activeSlots);
        playerBuffs.speedBonus += gameState.combatState.playerStackingSpeed || 0;
        playerBuffs.critChance += gameState.combatState.playerStackingCrit || 0;

        // Global Stat Buffs (Blessings)
        if (globalBuffSystem.hasBuff('SPEED_PCT_10')) playerBuffs.speedBonus += 0.10;
        if (globalBuffSystem.hasBuff('CRIT_PCT_10')) playerBuffs.critChance += 0.10;

        this.processSlots(gameState.activeSlots, 'enemy', playerBuffs, deltaTime);
        this.processDebuffs('player', deltaTime);

        // Process Enemy Slots
        const enemyBuffs = BuffSystem.calculateBuffs(gameState.enemySlots);
        enemyBuffs.speedBonus += gameState.combatState.enemyStackingSpeed || 0;
        enemyBuffs.critChance += gameState.combatState.enemyStackingCrit || 0;

        this.processSlots(gameState.enemySlots, 'player', enemyBuffs, deltaTime);
        this.processDebuffs('enemy', deltaTime);

        // Decrement frozen full-freeze timers
        gameState.combatState.playerFrozenTimer = Math.max(0, (gameState.combatState.playerFrozenTimer || 0) - deltaTime);
        gameState.combatState.enemyFrozenTimer = Math.max(0, (gameState.combatState.enemyFrozenTimer || 0) - deltaTime);
    }

    processSlots(slots, targetType, buffs, deltaTime) {
        const sourceType = targetType === 'enemy' ? 'player' : 'enemy';

        slots.forEach(item => {
            if (item) {
                // Skip relics - they only provide passive buffs via BuffSystem, not attacks
                if (item.type === 'relic') {
                    return;
                }

                // Get combined stats which include set bonus modifications for effects
                const combined = BuffSystem.getItemCombinedStats(item, slots);

                let timeScale = 1.0;
                const sourceDebuffs = sourceType === 'player' ? gameState.combatState.playerDebuffs : gameState.combatState.enemyDebuffs;
                const frozenStacks = sourceDebuffs.filter(d => d.type === 'frozen').length;

                // Full freeze timer takes priority
                const frozenTimer = sourceType === 'player'
                    ? gameState.combatState.playerFrozenTimer || 0
                    : gameState.combatState.enemyFrozenTimer || 0;

                if (frozenTimer > 0) {
                    timeScale = 0; // Full freeze (1 second)
                } else if (frozenStacks > 0) {
                    timeScale = Math.max(0.05, 1.0 - frozenStacks * 0.05); // 5% slow per stack, capped at 95%
                }

                let effectiveCooldown = combined.cooldown;
                let effectiveCritChance = combined.critChance;

                if (item.currentCooldown > 0) {
                    item.currentCooldown -= deltaTime * timeScale;
                }

                const targetHp = targetType === 'enemy' ? gameState.enemy.hp : gameState.player.hp;

                if (item.currentCooldown <= 0 && targetHp > 0) {
                    this.performAttack(item, targetType, sourceType, buffs, effectiveCritChance, combined.modifiedEffects);
                    item.currentCooldown = effectiveCooldown;
                }
            }
        });
    }

    performAttack(item, targetType, sourceType, buffs, effectiveCritChance, modifiedEffects = null) {


        let hits = 1;

        // Multihit Rework: Always trigger if count > 0 (effectively 'hits = count')
        // Also handling global +1 hit buff

        // Base hits from item attributes (if item gives x2 multihit)
        if (buffs.multihitCount > 0) {
            hits = buffs.multihitCount;
        }

        // Global Buffs adding extra hits
        if (sourceType === 'player' && globalBuffSystem.hasBuff('MULTIHIT_PLUS_1')) {
            hits += 1;
        }

        // Apply
        // If hits stayed 1, and no buffs, it is 1. 
        // If item had hits:2, hits=2. + Global=3.
        // If item had hits:0 (normal), hits=1. + Global=2. Correct.

        for (let i = 0; i < hits; i++) {
            this.resolveHit(item, targetType, sourceType, buffs, effectiveCritChance, modifiedEffects);
        }
    }

    resolveHit(item, targetType, sourceType, buffs, critChance, modifiedEffects = null) {
        if (!this.isFighting) return;

        // Use damage from combined stats if available, otherwise fallback to item damage
        const combined = BuffSystem.getItemCombinedStats(item, sourceType === 'player' ? gameState.activeSlots : gameState.enemySlots);
        let damage = combined.damage;

        let critMult = 1;
        let isCrit = false;
        let critType = "";

        if (Math.random() < critChance) {
            isCrit = true;
            critMult = 2; // Normal Crit

            // Global Buff: Lethality (3x Crit Damage)
            if (sourceType === 'player' && globalBuffSystem.hasBuff('CRIT_DMG_3X')) {
                critMult = 3;
            }

            critType = "Crit";

            if (Math.random() < 0.2) {
                critMult = 3; // SuperCrit
                // Lethality buff boosts SuperCrit to 4x? User said "crit damage x3.0". Let's apply it to base crit only for now or scale it.
                // Assuming "Normal Crit becomes 3x".
                if (sourceType === 'player' && globalBuffSystem.hasBuff('CRIT_DMG_3X')) critMult = 4;

                critType = "SuperCrit";
                if (Math.random() < 0.2) {
                    critMult = 5; // HyperCrit
                    if (sourceType === 'player' && globalBuffSystem.hasBuff('CRIT_DMG_3X')) critMult = 6;
                    critType = "HyperCrit";
                }
            }
        }

        damage = Math.floor(damage * critMult);

        const stackingDamage = sourceType === 'player' ?
            (gameState.combatState.playerStackingDamage || 0) :
            (gameState.combatState.enemyStackingDamage || 0);
        damage = Math.floor(damage * (1 + stackingDamage));

        if (damage > 0) this.applyDamage(targetType, damage, BuffSystem.calculateBuffs(targetType === 'enemy' ? gameState.enemySlots : gameState.activeSlots).blockChance);

        if (modifiedEffects || item.effects) {
            this.applyEffects(modifiedEffects || item.effects, targetType, sourceType, damage);
        }

        // Global Buffs on HIT
        if (sourceType === 'player') {
            if (globalBuffSystem.hasBuff('LIFELEECH_PCT_10')) {
                const leech = Math.ceil(damage * 0.10);
                if (leech > 0) this.applyHeal('player', leech);
            }
            if (globalBuffSystem.hasBuff('HP_ON_HIT_10')) {
                this.applyMaxHpGain('player', 10);
            }
        }

        // Handle Shield Items (Flat Absorb Gain)
        // Use 'shield' stat now instead of 'block'
        // combined.shield comes from getItemCombinedStats
        if (combined.shield > 0) {
            this.applyShield(sourceType, combined.shield);
        }

        // Play attack sound (only for player attacks to avoid sound spam)
        if (sourceType === 'player') {
            soundManager.playAttackSound(item.type, item.subtype);
            if (isCrit) {
                soundManager.playCritSound(critType);
            }
        }

        bus.emit('DAMAGE_DEALT', {
            target: targetType,
            damage: damage,
            isCrit: isCrit,
            critType: critType,
            sourceItem: item
        });
    }

    /**
     * Apply effects from an item hit.
     */
    applyEffects(effects, targetType, sourceType, damageDealt = 0) {
        const targetDebuffs = targetType === 'enemy' ? gameState.combatState.enemyDebuffs : gameState.combatState.playerDebuffs;

        const defaultDurations = {
            bleed: 10,
            poison: 15,
            fire: 5,
            shadow: 10,
            curse: 20,
            frozen: 5
        };

        for (const [type, data] of Object.entries(effects)) {
            if (!data || typeof data !== 'object') continue;

            // Gold on hit - gives gold to the attacker if it's the player
            if (type === 'goldOnHit' && sourceType === 'player') {
                // ALWAYS APPLY (100% Chance)
                const goldAmount = data.amount || 1;
                gameState.gold += goldAmount;
                bus.emit('GOLD_UPDATED', gameState.gold);

                // Show floating text directly for gold on the player gaining it
                bus.emit('SHOW_FLOATING_TEXT', {
                    target: sourceType,
                    damage: `${goldAmount}g`,
                    amount: goldAmount, // Pass numeric value for meter
                    isCrit: true, // Make it pop
                    critType: 'gold', // Custom styling
                    sourceType: 'gold'
                });

                console.log(`[GOLD ON HIT] +${goldAmount} gold! Total: ${gameState.gold}`);
            }
            else if (type === 'lifesteal') {
                // ALWAYS APPLY (100% Chance by default now)
                // Factor defaults to 1.0 (100% of damage)
                const factor = data.factor !== undefined ? data.factor : 1.0;
                const healAmount = Math.ceil(damageDealt * factor);
                if (healAmount > 0) {
                    this.applyHeal(sourceType, healAmount);
                    console.log(`[LIFESTEAL] Healed ${sourceType} for ${healAmount} (${factor * 100}% of ${damageDealt} dmg)`);
                }
            }
            else if (type === 'holy') {
                // ALWAYS APPLY (100% Chance)
                this.applyHeal(sourceType, data.heal || 0);
                if (data.maxHpGain) {
                    this.applyMaxHpGain(sourceType, data.maxHpGain);
                }
            }
            else if (type === 'frozen') {
                // ALWAYS APPLY (100% Chance)
                const duration = (data.duration || defaultDurations.frozen) * 1000;

                const currentStacks = targetDebuffs.filter(d => d.type === 'frozen').length;

                targetDebuffs.push({
                    type: 'frozen',
                    duration: duration,
                    damagePerTick: 0,
                    tickTimer: 0,
                    id: Math.random()
                });

                if (currentStacks + 1 >= 10) {
                    const timerKey = targetType === 'enemy' ? 'enemyFrozenTimer' : 'playerFrozenTimer';
                    gameState.combatState[timerKey] = 1000; // 1 second

                    // Consume all frozen stacks
                    for (let i = targetDebuffs.length - 1; i >= 0; i--) {
                        if (targetDebuffs[i].type === 'frozen') {
                            targetDebuffs.splice(i, 1);
                        }
                    }

                    console.log(`[FROZEN] 10 stacks reached → 1-second full freeze on ${targetType}! Stacks consumed.`);
                } else {
                    console.log(`[FROZEN] Stack added (${currentStacks + 1}/10)`);
                }
            }
            else if (['bleed', 'poison', 'fire', 'shadow', 'curse'].includes(type)) {
                let existingDebuff = targetDebuffs.find(d => d.type === type);
                const duration = (data.duration || defaultDurations[type]) * 1000;
                let perStackDamage = data.damagePerTick || 0;
                // const chance = data.chance ?? 1.0; // Chance Removed
                const tickInterval = data.tickInterval || 1000;

                // ALWAYS APPLY (100% Chance)

                // Refresh duration if exists
                if (existingDebuff) {
                    existingDebuff.duration = duration;
                }

                if (!existingDebuff) {
                    existingDebuff = {
                        type: type,
                        duration: duration,
                        damagePerTick: perStackDamage,
                        tickTimer: 0,
                        id: Math.random(),
                        stacks: 1,
                        perStackDamage: perStackDamage,
                        tickInterval: tickInterval
                    };
                    targetDebuffs.push(existingDebuff);
                    console.log(`[DEBUFF NEW] ${type} applied → x${existingDebuff.stacks} stack (${existingDebuff.damagePerTick} dmg/tick)`);
                } else {
                    existingDebuff.stacks += 1;
                    existingDebuff.damagePerTick = existingDebuff.stacks * existingDebuff.perStackDamage;
                    console.log(`[DEBUFF STACK] ${type} +1 stack (now x${existingDebuff.stacks}, ${existingDebuff.damagePerTick} dmg/tick), duration refreshed`);
                }
            }
        }
    }

    applyHeal(targetType, amount) {
        const target = targetType === 'enemy' ? gameState.enemy : gameState.player;
        gameState.updateHp(targetType, target.hp + amount);

        bus.emit('HEAL_APPLIED', {
            target: targetType,
            amount: amount
        });
    }

    applyMaxHpGain(targetType, amount) {
        if (amount <= 0) return;
        gameState.updateMaxHp(targetType, amount);

        bus.emit('SHOW_FLOATING_TEXT', {
            target: targetType,
            type: 'heal',
            damage: `${amount} MaxHP`,
            isCrit: true,
            critType: 'heal',
            sourceType: 'heal'
        });
    }

    processDebuffs(targetType, deltaTime) {
        const debuffs = targetType === 'enemy' ? gameState.combatState.enemyDebuffs : gameState.combatState.playerDebuffs;
        for (let i = debuffs.length - 1; i >= 0; i--) {
            const debuff = debuffs[i];
            debuff.duration -= deltaTime;

            if (debuff.damagePerTick > 0) {
                debuff.tickTimer += deltaTime;

                const tickInterval = debuff.tickInterval || 1000;

                if (debuff.tickTimer >= tickInterval) {
                    debuff.tickTimer -= tickInterval;
                    this.applyDamage(targetType, debuff.damagePerTick); // Debuffs ignore block for now? Or apply same mitigation? 
                    // Let's assume Debuffs ignore block reduction (Internal damage), or maybe apply it?
                    // User said "Block should be a value that reduced the damge done by enemy".
                    // Usually DoTs are internal.
                    // But for consistency let's leave DoTs as True Damage for now unless requested.

                    // Emit damage event for UI
                    bus.emit('DAMAGE_DEALT', {
                        target: targetType,
                        damage: debuff.damagePerTick,
                        isCrit: false,
                        critType: "",
                        sourceItem: null,
                        sourceType: 'debuff',
                        debuffType: debuff.type
                    });
                }
            }

            if (debuff.duration <= 0) {
                console.log(`[DEBUFF EXPIRED] ${debuff.type} (was x${debuff.stacks || 'N/A'} stacks)`);
                debuffs.splice(i, 1);
            }
        }
    }

    applyDamage(targetType, damage, blockChance = 0) {
        const target = targetType === 'enemy' ? gameState.enemy : gameState.player;
        const attackerType = targetType === 'enemy' ? 'player' : 'enemy';



        // 1. Apply Block (Percentage Reduction)
        let blockedAmount = 0;
        let remainingDamage = damage;

        if (blockChance > 0) {
            // Cap block at 90%?
            const effectiveBlock = Math.min(0.9, blockChance);
            blockedAmount = Math.ceil(damage * effectiveBlock);
            remainingDamage -= blockedAmount;
        }

        // 2. Apply Shield (Absorb)
        let absorbed = 0;

        if (target.shield > 0) {
            if (target.shield >= remainingDamage) {
                target.shield -= remainingDamage;
                absorbed = remainingDamage;
                remainingDamage = 0;
            } else {
                absorbed = target.shield;
                remainingDamage -= target.shield;
                target.shield = 0;
            }

            if (absorbed > 0) {
                bus.emit('HEAL_APPLIED', {
                    target: targetType,
                    amount: absorbed,
                    sourceType: 'shield',
                    sourceItem: { name: 'Shield Absorb' }
                });
            }
        }

        // Global Buff: Reflect
        // If player has reflect buff and absorbs damage with shield, reflect 50% of TAKEN damage
        // Wait, "Reflect 50% of damage". Usually implies reflected damage is dealt to attacker.
        // Let's reflect 50% of damage that hit the shield (absorbed) or just 50% of incoming?
        // "Shield always reflect 50% of damage" -> When shield takes damage.
        if (targetType === 'player' && globalBuffSystem.hasBuff('SHIELD_REFLECT_10') && absorbed > 0) {
            const reflectAmount = Math.ceil(absorbed * 0.1);
            // Recursively apply damage to attacker (enemy) - BE CAREFUL of infinite loops if enemy reflects too (enemy doesn't have buffs yet)
            // But we call applyDamage on enemy. Enemy has no shield reflect buff. Safe.

            // We need to defer this slightly or just apply it directly
            // Direct application might trigger events while current processing? Should be fine.
            // console.log(`Reflecting ${reflectAmount} damage`);
            this.applyDamage('enemy', reflectAmount);

            bus.emit('DAMAGE_DEALT', {
                target: 'enemy',
                damage: reflectAmount,
                isCrit: false,
                critType: "",
                sourceItem: null,
                sourceType: 'reflect',
                blocked: 0
            });

            bus.emit('SHOW_FLOATING_TEXT', {
                target: 'enemy',
                damage: reflectAmount,
                isCrit: false,
                sourceType: 'reflect'
            });
        }

        if (remainingDamage > 0 || blockedAmount > 0 || absorbed > 0) {
            bus.emit('DAMAGE_DEALT', {
                target: targetType,
                damage: remainingDamage,
                blocked: blockedAmount + absorbed, // Total mitigated damage
                isCrit: false
            });
        }

        gameState.updateHp(targetType, target.hp - remainingDamage);
        this.checkDefeat(targetType);
    }

    applyShield(targetType, amount) {
        const target = targetType === 'enemy' ? gameState.enemy : gameState.player;
        target.shield = (target.shield || 0) + amount;
        bus.emit('HP_UPDATED');
    }

    checkDefeat(targetType) {
        if (!this.isFighting || gameState.phase !== PHASES.COMBAT) return;

        const currentHp = targetType === 'enemy' ? gameState.enemy.hp : gameState.player.hp;
        if (currentHp <= 0) {
            if (targetType === 'enemy') {
                bus.emit('FIGHT_VICTORY');
            } else {
                bus.emit('FIGHT_DEFEAT');
            }
        }
    }
}

export const combatSystem = new CombatSystem();