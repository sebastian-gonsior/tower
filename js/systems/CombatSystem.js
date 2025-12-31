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
 * - Frozen: Slows target, at 10 stacks freezes for 1 second
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
                if (frozenStacks > 0) {
                     if (frozenStacks >= 10) timeScale = 0; 
                     else timeScale = 1.0 - (frozenStacks * 0.05); 
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
        let hits = 1;
        if (buffs.multihitCount > 0 && Math.random() < buffs.multihitChance) {
             hits = buffs.multihitCount; 
        }
        
        for(let i=0; i<hits; i++) {
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
            this.applyEffects(item.effects, targetType, sourceType);
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
     * Per game.md manifesto: DoT debuffs "stack up and refresh" - meaning:
     * - If debuff already exists: ALWAYS refresh duration AND add damage on every hit
     * - If debuff doesn't exist: chance roll determines if new debuff is applied
     * This ensures debuffs stack damage continuously while the weapon keeps hitting.
     * 
     * Special handling:
     * - Frozen: Stacks as separate entries (5% slow per stack, 10 stacks = freeze)
     * - Holy: Heals the attacker (not a debuff)
     * - DoTs (bleed, poison, fire, shadow, curse): Stack damage, refresh duration
     */
    applyEffects(effects, targetType, sourceType) {
        console.log(`[APPLY_EFFECTS] Called with effects:`, effects, `target: ${targetType}`);
        const targetDebuffs = targetType === 'enemy' ? gameState.combatState.enemyDebuffs : gameState.combatState.playerDebuffs;
        
        // Default durations for debuffs (in seconds) - used as fallback
        const defaultDurations = {
            bleed: 10,
            poison: 15,
            fire: 5,
            shadow: 10,
            curse: 20,
            frozen: 5
        };
        
        for(const [type, data] of Object.entries(effects)) {
            // Skip non-debuff effects (like multihit, critChance which are handled by BuffSystem)
            if (!data || typeof data !== 'object') continue;
            
            if (type === 'holy') {
                // Holy heals the attacker on chance
                if (data.chance && Math.random() < data.chance) {
                    this.applyHeal(sourceType, data.heal || 0);
                }
            } else if (type === 'frozen') {
                // Frozen is special: each application adds a NEW stack (not merged)
                // Each stack slows by 5%, at 10 stacks = complete freeze
                if (data.chance && Math.random() < data.chance) {
                    const duration = (data.duration || defaultDurations.frozen) * 1000;
                    targetDebuffs.push({
                        type: 'frozen',
                        duration: duration,
                        damagePerTick: 0,
                        tickTimer: 0,
                        id: Math.random()
                    });
                }
            } else if (['bleed', 'poison', 'fire', 'shadow', 'curse'].includes(type)) {
                // DoT debuffs: stack damage and refresh duration
                const existingDebuff = targetDebuffs.find(d => d.type === type);
                const duration = (data.duration || defaultDurations[type]) * 1000;
                const damagePerTick = data.damagePerTick || 0;
                
                if (existingDebuff) {
                    // ALWAYS refresh duration on every hit
                    existingDebuff.duration = duration;
                    // ALWAYS add damage on every hit (damage stacks continuously)
                    const oldDamage = existingDebuff.damagePerTick;
                    existingDebuff.damagePerTick += damagePerTick;
                    console.log(`[DEBUFF STACK] ${type}: ${oldDamage} + ${damagePerTick} = ${existingDebuff.damagePerTick} dmg/tick (duration reset to ${duration/1000}s)`);
                } else {
                    // No existing debuff - Apply 100% (ignore chance roll) per user request
                    const chanceValue = data.chance || 0;
                    
                    if (chanceValue > 0) {
                        targetDebuffs.push({
                            type: type,
                            duration: duration,
                            damagePerTick: damagePerTick,
                            tickTimer: 0,
                            id: Math.random()
                        });
                        console.log(`[DEBUFF NEW] ${type} applied! (100% chance) ${damagePerTick} dmg/tick for ${duration/1000}s`);
                    }
                }
            }
        }
    }
    
    applyHeal(targetType, amount) {
         const target = targetType === 'enemy' ? gameState.enemy : gameState.player;
         gameState.updateHp(targetType, target.hp + amount);
         
         // Emit heal event for combat text display
         bus.emit('HEAL_APPLIED', {
             target: targetType,
             amount: amount
         });
    }
    
    processDebuffs(targetType, deltaTime) {
         const debuffs = targetType === 'enemy' ? gameState.combatState.enemyDebuffs : gameState.combatState.playerDebuffs;
         for(let i = debuffs.length - 1; i >= 0; i--) {
             const debuff = debuffs[i];
             debuff.duration -= deltaTime;
             
             if (debuff.damagePerTick > 0) {
                 debuff.tickTimer += deltaTime;
                 if (debuff.tickTimer >= 1000) { 
                     debuff.tickTimer -= 1000;
                     this.applyDamage(targetType, debuff.damagePerTick);
                     this.checkDefeat(targetType);
                 }
             }
             
             if (debuff.duration <= 0) {
                 debuffs.splice(i, 1);
             }
         }
    }

    applyDamage(targetType, damage) {
        const target = targetType === 'enemy' ? gameState.enemy : gameState.player;
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
