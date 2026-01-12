import { gameState, PHASES } from '../state/GameState.js';
import { BuffSystem } from './BuffSystem.js';
import { bus } from '../utils/EventBus.js';
import { soundManager } from '../managers/SoundManager.js';

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

        // Process Player Slots
        const playerBuffs = BuffSystem.calculateBuffs(gameState.activeSlots);
        playerBuffs.speedBonus += gameState.combatState.playerStackingSpeed || 0;
        playerBuffs.critChance += gameState.combatState.playerStackingCrit || 0;

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

                let effectiveCooldown = item.cooldown;
                let effectiveCritChance = item.critChance + buffs.critChance;

                if (item.type === 'weapon' || item.type === 'shield') {
                    effectiveCooldown = item.cooldown / (1 + buffs.speedBonus);
                }

                if (item.currentCooldown > 0) {
                    item.currentCooldown -= deltaTime * timeScale;
                }

                const targetHp = targetType === 'enemy' ? gameState.enemy.hp : gameState.player.hp;

                if (item.currentCooldown <= 0 && targetHp > 0) {
                    this.performAttack(item, targetType, sourceType, buffs, effectiveCritChance);
                    item.currentCooldown = effectiveCooldown;
                }
            }
        });
    }

    performAttack(item, targetType, sourceType, buffs, effectiveCritChance) {
        // Visual: Trigger Attack Animation (Lunge)
        const isPlayer = sourceType === 'player';
        const panelSelector = isPlayer ? '.player-panel' : '.enemy-panel';
        const panel = document.querySelector(panelSelector);

        if (panel) {
            const animClass = isPlayer ? 'anim-lunge-right' : 'anim-shake'; // Enemies just shake for attack for now

            // Remove class to reset animation if it's currently running
            panel.classList.remove('anim-lunge-right');
            // Force reflow
            void panel.offsetWidth;

            if (isPlayer) {
                panel.classList.add('anim-lunge-right');
            } else {
                // For enemy attack, maybe just a small bounce or nothing special yet
                // The implementation plan mentioned "Lunge", let's just do lunge right for player only
            }
        }

        let hits = 1;
        if (buffs.multihitCount > 0 && Math.random() < buffs.multihitChance) {
            hits = buffs.multihitCount;
        }

        for (let i = 0; i < hits; i++) {
            this.resolveHit(item, targetType, sourceType, buffs, effectiveCritChance);
        }
    }

    resolveHit(item, targetType, sourceType, buffs, critChance) {
        let damage = item.damage;

        let critMult = 1;
        let isCrit = false;
        let critType = "";

        if (Math.random() < critChance) {
            isCrit = true;
            critMult = 2; // Normal Crit
            critType = "Crit";

            if (Math.random() < 0.2) {
                critMult = 3; // SuperCrit
                critType = "SuperCrit";
                if (Math.random() < 0.2) {
                    critMult = 5; // HyperCrit
                    critType = "HyperCrit";
                }
            }
        }

        damage = Math.floor(damage * critMult);

        const stackingDamage = sourceType === 'player' ?
            (gameState.combatState.playerStackingDamage || 0) :
            (gameState.combatState.enemyStackingDamage || 0);
        damage = Math.floor(damage * (1 + stackingDamage));

        if (damage > 0) this.applyDamage(targetType, damage);

        if (item.effects) {
            this.applyEffects(item.effects, targetType, sourceType, damage);
        }

        // Handle Shield Items
        if (item.type === 'shield' && item.stats.block) {
            this.applyShield(sourceType, item.stats.block);
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

        this.checkDefeat(targetType);
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

            // Gold on hit - gives gold to the attacker
            if (type === 'goldOnHit') {
                if (data.chance && Math.random() < data.chance) {
                    const goldAmount = data.amount || 1;
                    gameState.gold += goldAmount;
                    bus.emit('GOLD_UPDATED', gameState.gold);

                    // Show floating text directly for gold
                    bus.emit('SHOW_FLOATING_TEXT', {
                        target: 'player', // Or 'gold' specific target type? 'player' anchors to player panel
                        damage: `+${goldAmount}g`,
                        isCrit: true, // Make it pop
                        critType: 'gold', // Custom styling
                        sourceType: 'gold'
                    });

                    console.log(`[GOLD ON HIT] +${goldAmount} gold! Total: ${gameState.gold}`);
                }
            }
            else if (type === 'lifesteal') {
                if (Math.random() < (data.chance ?? 1.0)) {
                    // Factor defaults to 1.0 (100% of damage)
                    const factor = data.factor !== undefined ? data.factor : 1.0;
                    const healAmount = Math.ceil(damageDealt * factor);
                    if (healAmount > 0) {
                        this.applyHeal(sourceType, healAmount);
                        console.log(`[LIFESTEAL] Healed ${sourceType} for ${healAmount} (${factor * 100}% of ${damageDealt} dmg)`);
                    }
                }
            }
            else if (type === 'holy') {
                if (data.chance && Math.random() < data.chance) {
                    this.applyHeal(sourceType, data.heal || 0);
                }
            }
            else if (type === 'frozen') {
                if (data.chance && Math.random() < data.chance) {
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
            }
            else if (['bleed', 'poison', 'fire', 'shadow', 'curse'].includes(type)) {
                let existingDebuff = targetDebuffs.find(d => d.type === type);
                const duration = (data.duration || defaultDurations[type]) * 1000;
                const perStackDamage = data.damagePerTick || 0;
                const chance = data.chance ?? 1.0;



                // Independent chance to apply/refresh/stack on this hit
                if (chance > 0 && Math.random() < chance) {
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
                            perStackDamage: perStackDamage
                        };
                        targetDebuffs.push(existingDebuff);
                        console.log(`[DEBUFF NEW] ${type} applied (${Math.round(chance * 100)}% chance) → x${existingDebuff.stacks} stack (${existingDebuff.damagePerTick} dmg/tick)`);
                    } else {
                        existingDebuff.stacks += 1;
                        existingDebuff.damagePerTick = existingDebuff.stacks * existingDebuff.perStackDamage;
                        console.log(`[DEBUFF STACK] ${type} +1 stack (now x${existingDebuff.stacks}, ${existingDebuff.damagePerTick} dmg/tick), duration refreshed`);
                    }
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

    processDebuffs(targetType, deltaTime) {
        const debuffs = targetType === 'enemy' ? gameState.combatState.enemyDebuffs : gameState.combatState.playerDebuffs;
        for (let i = debuffs.length - 1; i >= 0; i--) {
            const debuff = debuffs[i];
            debuff.duration -= deltaTime;

            if (debuff.damagePerTick > 0) {
                debuff.tickTimer += deltaTime;
                if (debuff.tickTimer >= 1000) {
                    debuff.tickTimer -= 1000;
                    this.applyDamage(targetType, debuff.damagePerTick);

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

                    this.checkDefeat(targetType);
                }
            }

            if (debuff.duration <= 0) {
                console.log(`[DEBUFF EXPIRED] ${debuff.type} (was x${debuff.stacks || 'N/A'} stacks)`);
                debuffs.splice(i, 1);
            }
        }
    }

    applyDamage(targetType, damage) {
        const target = targetType === 'enemy' ? gameState.enemy : gameState.player;

        // Visual: Trigger Hit Reaction (Shake + Flash)
        const panelSelector = targetType === 'enemy' ? '.enemy-panel' : '.player-panel';
        const panel = document.querySelector(panelSelector);
        if (panel) {
            panel.classList.remove('anim-shake');
            panel.classList.remove('hit-flash');
            void panel.offsetWidth; // Force reflow
            panel.classList.add('anim-shake');
            panel.classList.add('hit-flash');

            // Remove flash after short delay (CSS transition handles fade, but class needs removal)
            setTimeout(() => {
                panel.classList.remove('hit-flash');
            }, 150);
        }

        let remainingDamage = damage;

        if (target.shield > 0) {
            if (target.shield >= remainingDamage) {
                target.shield -= remainingDamage;
                remainingDamage = 0;
            } else {
                remainingDamage -= target.shield;
                target.shield = 0;
            }
        }

        gameState.updateHp(targetType, target.hp - remainingDamage);
    }

    applyShield(targetType, amount) {
        const target = targetType === 'enemy' ? gameState.enemy : gameState.player;
        target.shield = (target.shield || 0) + amount;
        bus.emit('HP_UPDATED');
    }

    checkDefeat(targetType) {
        if (gameState.phase !== PHASES.COMBAT) return;

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