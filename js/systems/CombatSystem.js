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
        this.processSlots(gameState.activeSlots, 'enemy', playerBuffs, deltaTime);

        const enemyBuffs = BuffSystem.calculateBuffs(gameState.enemySlots);
        this.processSlots(gameState.enemySlots, 'player', enemyBuffs, deltaTime);
    }

    processSlots(slots, targetType, buffs, deltaTime) {
        slots.forEach(item => {
            if (item) {
                let effectiveCooldown = item.cooldown;
                let effectiveCritChance = item.critChance;
                
                if (item.type === 'sword') {
                    effectiveCooldown = item.cooldown / (1 + buffs.speedBonus);
                    effectiveCritChance += buffs.critChance;
                }

                if (item.currentCooldown > 0) {
                    item.currentCooldown -= deltaTime;
                    if (item.currentCooldown < 0) item.currentCooldown = 0;
                }

                const targetHp = targetType === 'enemy' ? gameState.enemy.hp : gameState.player.hp;

                if (item.currentCooldown === 0 && item.damage > 0 && targetHp > 0) {
                    this.performAttack(item, targetType, buffs.critDmg, effectiveCritChance);
                    item.currentCooldown = effectiveCooldown;
                }
            }
        });
    }

    performAttack(item, targetType, critMult, effectiveCritChance) {
        let damage = item.damage;
        let isCrit = false;

        if (item.type === 'sword') {
            if (Math.random() < effectiveCritChance) {
                isCrit = true;
                damage = Math.floor(damage * critMult);
            }
        }

        // Apply damage
        const currentHp = targetType === 'enemy' ? gameState.enemy.hp : gameState.player.hp;
        const newHp = currentHp - damage;
        gameState.updateHp(targetType, newHp);

        // Emit event for UI
        bus.emit('DAMAGE_DEALT', {
            target: targetType,
            damage: damage,
            isCrit: isCrit,
            sourceItem: item
        });

        if (newHp <= 0) {
            console.log(`${targetType} Defeated!`);
            this.endFight();

            if (targetType === 'enemy') {
                gameState.addGold(50);
                bus.emit('FIGHT_RESULT', 'VICTORY');
            } else {
                bus.emit('FIGHT_RESULT', 'DEFEAT');
            }
        }
    }
}

export const combatSystem = new CombatSystem();
