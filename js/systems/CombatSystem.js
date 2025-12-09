import { gameState } from '../state/GameState.js';
import { BuffSystem } from './BuffSystem.js';
import { bus } from '../utils/EventBus.js';

export class CombatSystem {
    constructor() {
        this.init();
    }

    init() {
        // Listen for fight start
    }

    startFight() {
        console.log("Fight Started!");
        gameState.setFightActive(true);
        
        // Initialize cooldowns
        this.applyInitialCooldown(gameState.activeSlots);
        this.applyInitialCooldown(gameState.enemySlots);
    }

    endFight() {
        console.log("Fight Ended!");
        gameState.setFightActive(false);
        bus.emit('FIGHT_ENDED');
    }

    applyInitialCooldown(slots) {
        const buffs = BuffSystem.calculateBuffs(slots);
        slots.forEach(item => {
            if (item && item.type === 'sword') {
                item.currentCooldown = item.cooldown / (1 + buffs.speedBonus);
            }
        });
    }

    update(deltaTime) {
        if (!gameState.isFightActive) return;

        const playerBuffs = BuffSystem.calculateBuffs(gameState.activeSlots);
        playerBuffs.speedBonus += (gameState.combatState.playerStackingSpeed || 0);
        playerBuffs.critChance += (gameState.combatState.playerStackingCrit || 0);

        this.processSlots(gameState.activeSlots, 'enemy', playerBuffs, deltaTime);

        const enemyBuffs = BuffSystem.calculateBuffs(gameState.enemySlots);
        enemyBuffs.speedBonus += (gameState.combatState.enemyStackingSpeed || 0);
        enemyBuffs.critChance += (gameState.combatState.enemyStackingCrit || 0);
        
        this.processSlots(gameState.enemySlots, 'player', enemyBuffs, deltaTime);
    }

    processSlots(slots, targetType, buffs, deltaTime) {
        const sourceType = targetType === 'enemy' ? 'player' : 'enemy';
        
        slots.forEach(item => {
            if (item) {
                let effectiveCooldown = item.cooldown;
                let effectiveCritChance = item.critChance;
                
                // Both Swords and Shields benefit from Attack Speed in this implementation
                if (item.type === 'sword' || item.type === 'shield') {
                    effectiveCooldown = item.cooldown / (1 + buffs.speedBonus);
                    effectiveCritChance += buffs.critChance;
                }

                if (item.currentCooldown > 0) {
                    item.currentCooldown -= deltaTime;
                    if (item.currentCooldown < 0) item.currentCooldown = 0;
                }

                const targetHp = targetType === 'enemy' ? gameState.enemy.hp : gameState.player.hp;

                if (item.currentCooldown === 0) {
                    if (item.damage > 0 && targetHp > 0) {
                        this.performAttack(item, targetType, sourceType, buffs.critDmg, effectiveCritChance, effectiveCooldown);
                        item.currentCooldown = effectiveCooldown;
                    }
                }
            }
        });
    }

    applyShield(targetType, amount) {
        const target = targetType === 'enemy' ? gameState.enemy : gameState.player;
        target.shield = (target.shield || 0) + amount;
        bus.emit('HP_UPDATED');
    }

    performAttack(item, targetType, sourceType, critMult, effectiveCritChance, swordCooldown) {
        let damage = item.damage;

        // Apply Stacking Damage Bonus
        const stackingDamage = sourceType === 'player' ? 
            (gameState.combatState.playerStackingDamage || 0) : 
            (gameState.combatState.enemyStackingDamage || 0);
        
        if (stackingDamage > 0) {
            damage = Math.floor(damage * (1 + stackingDamage));
        }

        let isCrit = false;
        
        const sourceSlots = sourceType === 'player' ? gameState.activeSlots : gameState.enemySlots;

        // Trigger Shields (Bind to Sword Tick)
        if (item.type === 'sword') {
            sourceSlots.forEach(slotItem => {
                if (slotItem && slotItem.type === 'shield') {
                    this.applyShield(sourceType, 20);
                    if (swordCooldown) {
                        slotItem.currentCooldown = swordCooldown;
                    }
                }
            });
        }

        if (item.type === 'sword') {
            if (Math.random() < effectiveCritChance) {
                isCrit = true;
                damage = Math.floor(damage * critMult);
            }
            
            // Check for On Attack Effects (Global for source)
            sourceSlots.forEach(slotItem => {
                if (slotItem && slotItem.onAttackEffect) {
                    if (Array.isArray(slotItem.onAttackEffect)) {
                        slotItem.onAttackEffect.forEach(effect => {
                            this.processAttackEffect(effect, sourceType);
                        });
                    } else {
                        this.processAttackEffect(slotItem.onAttackEffect, sourceType);
                    }
                }
            });
        }

        // Apply damage
        this.applyDamage(targetType, damage);

        // Emit event for UI
        bus.emit('DAMAGE_DEALT', {
            target: targetType,
            damage: damage,
            isCrit: isCrit,
            sourceItem: item
        });

        // Check Defeat
        const currentHp = targetType === 'enemy' ? gameState.enemy.hp : gameState.player.hp;
        if (currentHp <= 0) {
            console.log(`${targetType} Defeated!`);
            this.endFight();

            if (targetType === 'enemy') {
                gameState.addGold(150);
                bus.emit('FIGHT_RESULT', 'VICTORY');
            } else {
                gameState.addGold(100);
                bus.emit('FIGHT_RESULT', 'DEFEAT');
            }
        }
    }
    
    processAttackEffect(effect, sourceType) {
        if (effect.type === 'speed_stack') {
            if (sourceType === 'player') {
                gameState.combatState.playerStackingSpeed += effect.value;
            } else {
                gameState.combatState.enemyStackingSpeed += effect.value;
            }
        } else if (effect.type === 'damage_stack') {
            if (sourceType === 'player') {
                gameState.combatState.playerStackingDamage += effect.value;
            } else {
                gameState.combatState.enemyStackingDamage += effect.value;
            }
        } else if (effect.type === 'crit_stack') {
            if (sourceType === 'player') {
                gameState.combatState.playerStackingCrit += effect.value;
            } else {
                gameState.combatState.enemyStackingCrit += effect.value;
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
}

export const combatSystem = new CombatSystem();
