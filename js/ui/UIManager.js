import { gameState, PHASES } from '../state/GameState.js';
import { bus } from '../utils/EventBus.js';
import { GAME_CONFIG } from '../config.js';
import { BuffSystem } from '../systems/BuffSystem.js';

export class UIManager {
    constructor() {
        this.elements = {
            // Screens/Modals
            registrationScreen: document.getElementById('registration-screen'),
            characterCreationScreen: document.getElementById('character-creation-screen'),
            gameView: document.getElementById('game-view'),
            shopOverlay: document.getElementById('shop-overlay'),
            bossIntroOverlay: document.getElementById('boss-intro-overlay'),
            equipOverlay: document.getElementById('equip-overlay'),

            // Interactive Elements
            regEmail: document.getElementById('reg-email'),
            regBtn: document.getElementById('reg-btn'),
            charName: document.getElementById('char-name'),
            createCharBtn: document.getElementById('create-char-btn'),

            activeSlots: document.getElementById('active-slots'),
            enemySlots: document.getElementById('enemy-slots'),
            stashSlots: document.getElementById('stash-slots'),

            playerHpBar: document.getElementById('player-hp-bar'),
            playerHpText: document.getElementById('player-hp-text'),
            enemyHpBar: document.getElementById('enemy-hp-bar'),
            enemyHpText: document.getElementById('enemy-hp-text'),

            startFightBtn: document.getElementById('start-fight-btn'),
            finishShoppingBtn: document.getElementById('finish-shopping-btn'),
            proceedToEquipBtn: document.getElementById('proceed-to-equip-btn'),
            startCombatBtn: document.getElementById('start-combat-btn'),

            levelDisplay: document.getElementById('level-display'),
            goldDisplay: document.getElementById('gold-display'),
            livesDisplay: document.getElementById('lives-display'),

            shopItems: document.getElementById('shop-items'),
            shopGoldDisplay: document.getElementById('shop-gold-display'),
            rerollShopBtn: document.getElementById('reroll-shop-btn'),

            playerNameDisplay: document.getElementById('player-name-display'),
            enemyNameDisplay: document.getElementById('enemy-name-display'),
            bossIntroName: document.getElementById('boss-intro-name'),
            bossIntroText: document.getElementById('boss-intro-text'),

            // Debuff containers
            playerDebuffs: document.getElementById('player-debuffs'),
            enemyDebuffs: document.getElementById('enemy-debuffs'),

            // Buff containers
            playerBuffs: document.getElementById('player-buffs'),
            enemyBuffs: document.getElementById('enemy-buffs'),
        };

        this.init();
    }

    init() {
        this.generateSlots();
        this.setupGlobalListeners();
        this.setupEventBusListeners();
        this.render();
    }

    setupGlobalListeners() {
        if (this.elements.finishShoppingBtn) {
            this.elements.finishShoppingBtn.onclick = () => gameState.finishShopping();
        }

        // Reroll shop for 5 gold
        if (this.elements.rerollShopBtn) {
            this.elements.rerollShopBtn.onclick = () => gameState.rerollShop();
        }

        // Boss Intro -> Equip Phase
        if (this.elements.proceedToEquipBtn) {
            this.elements.proceedToEquipBtn.onclick = () => gameState.startEquipPhase();
        }

        // Equip Phase -> Combat
        if (this.elements.startCombatBtn) {
            this.elements.startCombatBtn.onclick = () => bus.emit('UI_REQUEST_START_FIGHT');
        }

        if (this.elements.startFightBtn) {
            // Fallback or hidden in new design
            this.elements.startFightBtn.onclick = () => bus.emit('UI_REQUEST_START_FIGHT');
        }
    }

    setupEventBusListeners() {
        bus.on('PHASE_CHANGED', (phase) => this.handlePhaseChange(phase));
        bus.on('SLOTS_UPDATED', () => this.renderSlots());
        bus.on('HP_UPDATED', () => this.updateHealthUI());
        bus.on('DAMAGE_DEALT', (data) => this.showFloatingText(data));
        bus.on('HEAL_APPLIED', (data) => this.showHealText(data));
        bus.on('GOLD_UPDATED', () => this.updateStats());
        bus.on('LEVEL_UPDATED', () => this.updateStats());
        bus.on('LIVES_UPDATED', () => this.updateStats());
        bus.on('SHOP_UPDATED', (items) => this.renderShop(items));
        bus.on('ITEM_FUSED', (data) => this.showFusionNotification(data));
        bus.on('FIGHT_VICTORY', () => {
            this.showNotification("VICTORY!", "gold");
        });
        bus.on('FIGHT_DEFEAT', () => {
            this.showNotification("DEFEAT!", "red");
        });
    }

    handlePhaseChange(phase) {
        // Hide all overlays first
        this.elements.shopOverlay.classList.add('hidden');
        this.elements.bossIntroOverlay.classList.add('hidden');
        if (this.elements.equipOverlay) {
            this.elements.equipOverlay.classList.add('hidden');
        }

        // Show appropriate overlay based on phase
        if (phase === PHASES.SHOPPING) {
            this.elements.shopOverlay.classList.remove('hidden');
            this.renderShop(gameState.shopItems);
        } else if (phase === PHASES.BOSS_INTRO) {
            this.elements.bossIntroOverlay.classList.remove('hidden');
            this.elements.bossIntroName.innerText = gameState.enemy.name;
            this.elements.bossIntroText.innerText = gameState.enemy.introText || "...";
        } else if (phase === PHASES.EQUIP) {
            // Equip phase: show equip overlay where player can manage inventory
            if (this.elements.equipOverlay) {
                this.elements.equipOverlay.classList.remove('hidden');
            }
        }

        this.render();
    }

    render() {
        this.renderSlots();
        this.updateHealthUI();
        this.updateStats();
        this.updatePlayerName();
        this.updateEnemyName();
    }

    updateStats() {
        if (this.elements.levelDisplay) this.elements.levelDisplay.innerText = gameState.level;
        if (this.elements.goldDisplay) this.elements.goldDisplay.innerText = gameState.gold;
        if (this.elements.livesDisplay) this.elements.livesDisplay.innerText = gameState.lives;
        if (this.elements.shopGoldDisplay) this.elements.shopGoldDisplay.innerText = `Gold: ${gameState.gold}`;
    }

    updatePlayerName() {
        if (this.elements.playerNameDisplay) {
            this.elements.playerNameDisplay.innerText = gameState.playerName || 'Player';
        }
    }

    updateEnemyName() {
        if (this.elements.enemyNameDisplay) {
            this.elements.enemyNameDisplay.innerText = gameState.enemy.name || 'Enemy';
        }
    }

    updateHealthUI() {
        const updateBar = (bar, text, current, max) => {
            if (bar && text) {
                const percent = Math.max(0, Math.min(100, (current / max) * 100));
                bar.style.width = `${percent}%`;
                text.innerText = `${Math.ceil(current)} / ${max}`;
            }
        };

        updateBar(this.elements.playerHpBar, this.elements.playerHpText, gameState.player.hp, gameState.player.maxHp);
        updateBar(this.elements.enemyHpBar, this.elements.enemyHpText, gameState.enemy.hp, gameState.enemy.maxHp);

        if (gameState.player.shield > 0) {
            this.elements.playerHpText.innerText += ` (+${Math.ceil(gameState.player.shield)})`;
        }
        if (gameState.enemy.shield > 0) {
            this.elements.enemyHpText.innerText += ` (+${Math.ceil(gameState.enemy.shield)})`;
        }
    }

    renderSlots() {
        const renderSlot = (slotDiv, item) => {
            slotDiv.innerHTML = '';
            if (item) {
                const itemDiv = document.createElement('div');
                itemDiv.className = `item rarity-${item.rarity}`;

                // Add star level class for styling
                if (item.starLevel > 0) {
                    itemDiv.classList.add(`star-${item.starLevel}`);
                }

                // Icon element
                const iconSpan = document.createElement('span');
                iconSpan.className = 'item-icon';
                iconSpan.innerText = item.icon;
                itemDiv.appendChild(iconSpan);

                // Star indicator (if upgraded)
                if (item.starLevel > 0) {
                    const starSpan = document.createElement('span');
                    starSpan.className = 'item-stars';
                    starSpan.innerText = item.getStarDisplay();
                    itemDiv.appendChild(starSpan);
                }

                // Use getDisplayName() for tooltip with star info
                itemDiv.title = `${item.getDisplayName()}\n${item.description}`;

                // Castbar - horizontal bar showing attack progress (only for weapons/shields with cooldown)
                if (item.cooldown > 0) {
                    const castbarContainer = document.createElement('div');
                    castbarContainer.className = 'castbar-container';

                    const castbarFill = document.createElement('div');
                    castbarFill.className = 'castbar-fill';

                    // Calculate progress (inverted: 0% cooldown = 100% fill = ready)
                    const progress = item.cooldown > 0 ?
                        Math.max(0, 100 - (item.currentCooldown / item.cooldown) * 100) : 100;
                    castbarFill.style.width = `${progress}%`;

                    // Add ready class when attack is ready
                    if (item.currentCooldown <= 0) {
                        castbarFill.classList.add('ready');
                    }

                    castbarContainer.appendChild(castbarFill);
                    itemDiv.appendChild(castbarContainer);
                }

                slotDiv.appendChild(itemDiv);
            }
        };

        const updateContainer = (container, items) => {
            if (!container) return;
            Array.from(container.children).forEach((slotDiv, index) => {
                renderSlot(slotDiv, items[index]);
            });
        };

        updateContainer(this.elements.activeSlots, gameState.activeSlots);
        updateContainer(this.elements.enemySlots, gameState.enemySlots);
        updateContainer(this.elements.stashSlots, gameState.stashSlots);
    }

    renderShop(items) {
        const container = this.elements.shopItems;
        if (!container) return;
        container.innerHTML = '';
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'shop-item';
            if (!item) {
                div.innerHTML = '<span>Sold Out</span>';
                div.classList.add('sold-out');
            } else {
                div.innerHTML = `
                    <div class="item rarity-${item.rarity}">${item.icon}</div>
                    <div class="shop-item-details">
                        <div class="name">${item.name}</div>
                        <div class="price">${item.price} Gold</div>
                    </div>
                `;
                div.title = item.description;
                div.onclick = () => gameState.buyItem(index);

                if (gameState.gold < item.price) {
                    div.classList.add('too-expensive');
                }
            }
            container.appendChild(div);
        });
    }

    generateSlots() {
        const createSlots = (container, count, type) => {
            if (!container) return;
            container.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const slot = document.createElement('div');
                slot.className = 'slot';
                slot.dataset.type = type;
                slot.dataset.index = i;

                slot.onclick = () => this.handleSlotClick(type, i);

                container.appendChild(slot);
            }
        };

        createSlots(this.elements.activeSlots, GAME_CONFIG.slotsCount, 'active');
        createSlots(this.elements.enemySlots, GAME_CONFIG.slotsCount, 'enemy');
        createSlots(this.elements.stashSlots, GAME_CONFIG.stashCount, 'stash');
    }

    /**
     * Handle slot click for equipping/unequipping items.
     * Per game.md manifesto: Items can only be equipped during the EQUIP phase.
     * During COMBAT, item movement is blocked.
     */
    handleSlotClick(type, index) {
        // Only allow item equipping during EQUIP phase (per game.md manifesto)
        if (gameState.phase !== PHASES.EQUIP) {
            if (gameState.phase === PHASES.COMBAT) {
                console.log("Cannot equip items during combat!");
            }
            return;
        }

        const item = gameState.getArray(type)[index];
        if (!item) return;

        if (type === 'stash') {
            const emptyIdx = gameState.activeSlots.findIndex(s => s === null);
            if (emptyIdx !== -1) {
                this.moveItem('stash', index, 'active', emptyIdx);
            }
        } else if (type === 'active') {
            const emptyIdx = gameState.stashSlots.findIndex(s => s === null);
            if (emptyIdx !== -1) {
                this.moveItem('active', index, 'stash', emptyIdx);
            }
        }
    }

    moveItem(fromType, fromIdx, toType, toIdx) {
        const fromArr = gameState.getArray(fromType);
        const toArr = gameState.getArray(toType);

        if (fromArr && toArr) {
            const item = fromArr[fromIdx];
            const target = toArr[toIdx];

            fromArr[fromIdx] = target;
            toArr[toIdx] = item;

            bus.emit('SLOTS_UPDATED');
        }
    }

    showFloatingText(data) {
        const el = document.createElement('div');
        el.className = 'floating-text';
        if (data.isCrit) {
            el.classList.add('crit');
            el.innerText = `CRIT! ${data.damage}`;
            if (data.critType === 'SuperCrit') {
                el.innerText = `SUPER CRIT! ${data.damage}`;
                el.style.color = 'orange';
            } else if (data.critType === 'HyperCrit') {
                el.innerText = `HYPER CRIT! ${data.damage}`;
                el.style.color = 'purple';
                el.style.fontSize = '2em';
            }
        } else {
            el.innerText = data.damage;
        }

        const container = data.target === 'enemy' ? this.elements.enemySlots : this.elements.activeSlots;
        if (!container) return;

        const x = Math.random() * 100;
        const y = Math.random() * 100;

        el.style.left = x + 'px';
        el.style.top = y + 'px';

        container.appendChild(el);

        setTimeout(() => el.remove(), 1000);
    }

    /**
     * Show floating heal text when Holy effect triggers.
     * Displays green text with "+" prefix near the healed target.
     */
    showHealText(data) {
        const el = document.createElement('div');
        el.className = 'floating-text heal';
        el.innerText = `+${data.amount} ✨`;
        el.style.color = '#00ff00';

        // Show heal text near the healed target (player or enemy)
        const container = data.target === 'player' ? this.elements.activeSlots : this.elements.enemySlots;
        if (!container) return;

        const x = Math.random() * 100;
        const y = Math.random() * 100;

        el.style.left = x + 'px';
        el.style.top = y + 'px';

        container.appendChild(el);

        setTimeout(() => el.remove(), 1000);
    }

    update() {
        this.updateCooldowns();
        this.renderDebuffs();
        this.renderBuffs();
    }

    /**
     * Render active debuffs near health bars - UPDATED FOR NEW STACK SYSTEM
     * - DoTs (bleed, poison, fire, shadow, curse): single entry with explicit .stacks and scaled damagePerTick
     * - Frozen: multiple separate entries → count = stack count, value = slow %
     */
    renderDebuffs() {
        const debuffIcons = {
            bleed: '🩸',
            poison: '☠️',
            fire: '🔥',
            shadow: '👤',
            curse: '💀',
            frozen: '❄️',
            holy: '✨'
        };

        const renderDebuffContainer = (container, debuffs) => {
            if (!container) return;
            container.innerHTML = '';

            // === Frozen: multiple stacks (separate entries) ===
            const frozenDebuffs = debuffs.filter(d => d.type === 'frozen');
            if (frozenDebuffs.length > 0) {
                const stacks = frozenDebuffs.length;
                const slowPercent = stacks * 5;
                const maxDuration = Math.max(...frozenDebuffs.map(d => d.duration));
                const durationSec = Math.ceil(maxDuration / 1000);

                const debuffEl = document.createElement('div');
                debuffEl.className = 'debuff-icon debuff-frozen';

                let tooltip = 'Frozen';
                tooltip += `\nStacks: ${stacks}`;
                tooltip += `\nSlow: ${slowPercent}%`;
                tooltip += `\nDuration: ${durationSec}s`;
                debuffEl.title = tooltip;

                const iconSpan = document.createElement('span');
                iconSpan.className = 'debuff-emoji';
                iconSpan.innerText = debuffIcons.frozen;
                debuffEl.appendChild(iconSpan);

                const countSpan = document.createElement('span');
                countSpan.className = 'debuff-count';
                countSpan.innerText = stacks;
                debuffEl.appendChild(countSpan);

                const valueSpan = document.createElement('span');
                valueSpan.className = 'debuff-value';
                valueSpan.innerText = `${slowPercent}%`;
                debuffEl.appendChild(valueSpan);

                const durationSpan = document.createElement('span');
                durationSpan.className = 'debuff-duration';
                durationSpan.innerText = `${durationSec}s`;
                debuffEl.appendChild(durationSpan);

                container.appendChild(debuffEl);
            }

            // === DoT debuffs: single entry per type with explicit stacks ===
            const dotTypes = ['bleed', 'poison', 'fire', 'shadow', 'curse'];
            dotTypes.forEach(type => {
                const debuff = debuffs.find(d => d.type === type);
                if (debuff) {
                    const stacks = debuff.stacks || 1;
                    const totalDamage = debuff.damagePerTick || 0;
                    const durationSec = Math.ceil(debuff.duration / 1000);

                    const debuffEl = document.createElement('div');
                    debuffEl.className = `debuff-icon debuff-${type}`;

                    let tooltip = type.charAt(0).toUpperCase() + type.slice(1);
                    tooltip += `\nStacks: ${stacks}`;
                    if (totalDamage > 0) {
                        tooltip += `\nDamage/tick: ${totalDamage}`;
                    }
                    tooltip += `\nDuration: ${durationSec}s`;
                    debuffEl.title = tooltip;

                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'debuff-emoji';
                    iconSpan.innerText = debuffIcons[type] || '❓';
                    debuffEl.appendChild(iconSpan);

                    const countSpan = document.createElement('span');
                    countSpan.className = 'debuff-count';
                    countSpan.innerText = stacks; // Always show stack count
                    debuffEl.appendChild(countSpan);

                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'debuff-value';
                    valueSpan.innerText = totalDamage > 0 ? totalDamage : '0';
                    debuffEl.appendChild(valueSpan);

                    const durationSpan = document.createElement('span');
                    durationSpan.className = 'debuff-duration';
                    durationSpan.innerText = `${durationSec}s`;
                    debuffEl.appendChild(durationSpan);

                    container.appendChild(debuffEl);
                }
            });

            // Holy (if ever added as a debuff - currently it's not)
            // Skipped for now
        };

        renderDebuffContainer(this.elements.playerDebuffs, gameState.combatState.playerDebuffs);
        renderDebuffContainer(this.elements.enemyDebuffs, gameState.combatState.enemyDebuffs);
    }

    /**
     * Render active buffs from equipped items near health bars.
     */
    renderBuffs() {
        const buffIcons = {
            speedBonus: '⚡',
            critChance: '🎯',
            multihitChance: '💥',
            critDmg: '💢'
        };

        const buffLabels = {
            speedBonus: 'Attack Speed',
            critChance: 'Crit Chance',
            multihitChance: 'Multihit',
            critDmg: 'Crit Damage'
        };

        const renderBuffContainer = (container, slots) => {
            if (!container) return;
            container.innerHTML = '';

            // Calculate buffs from equipped items
            const buffs = BuffSystem.calculateBuffs(slots);

            // Render each buff that has a value > 0 (or > base for critDmg)
            const buffsToShow = [
                { key: 'speedBonus', value: buffs.speedBonus, format: (v) => `+${(v * 100).toFixed(0)}%` },
                { key: 'critChance', value: buffs.critChance, format: (v) => `${(v * 100).toFixed(0)}%` },
                { key: 'multihitChance', value: buffs.multihitChance, format: (v) => `${(v * 100).toFixed(0)}% x${buffs.multihitCount}` },
                { key: 'critDmg', value: buffs.critDmg, format: (v) => `x${v.toFixed(1)}`, showIf: (v) => v > 2.0 }
            ];

            for (const buff of buffsToShow) {
                const shouldShow = buff.showIf ? buff.showIf(buff.value) : buff.value > 0;
                if (!shouldShow) continue;

                const buffEl = document.createElement('div');
                buffEl.className = `buff-icon buff-${buff.key}`;
                buffEl.title = `${buffLabels[buff.key]}: ${buff.format(buff.value)}`;

                const iconSpan = document.createElement('span');
                iconSpan.className = 'buff-emoji';
                iconSpan.innerText = buffIcons[buff.key] || '✨';
                buffEl.appendChild(iconSpan);

                const valueSpan = document.createElement('span');
                valueSpan.className = 'buff-value';
                valueSpan.innerText = buff.format(buff.value);
                buffEl.appendChild(valueSpan);

                container.appendChild(buffEl);
            }
        };

        renderBuffContainer(this.elements.playerBuffs, gameState.activeSlots);
        renderBuffContainer(this.elements.enemyBuffs, gameState.enemySlots);
    }

    updateCooldowns() {
        const updateContainer = (container, items) => {
            if (!container) return;
            Array.from(container.children).forEach((slotDiv, index) => {
                const item = items[index];
                if (!item) return;

                const itemDiv = slotDiv.querySelector('.item');
                if (!itemDiv) return;

                // Update castbar fill width
                let castbarFill = itemDiv.querySelector('.castbar-fill');

                if (item.cooldown > 0) {
                    // Create castbar if it doesn't exist
                    if (!castbarFill) {
                        const castbarContainer = document.createElement('div');
                        castbarContainer.className = 'castbar-container';
                        castbarFill = document.createElement('div');
                        castbarFill.className = 'castbar-fill';
                        castbarContainer.appendChild(castbarFill);
                        itemDiv.appendChild(castbarContainer);
                    }

                    // Calculate progress (inverted: 0% cooldown = 100% fill = ready)
                    const progress = Math.max(0, 100 - (item.currentCooldown / item.cooldown) * 100);
                    castbarFill.style.width = `${progress}%`;

                    // Toggle ready class based on cooldown state
                    if (item.currentCooldown <= 0) {
                        castbarFill.classList.add('ready');
                    } else {
                        castbarFill.classList.remove('ready');
                    }
                }
            });
        };

        updateContainer(this.elements.activeSlots, gameState.activeSlots);
        updateContainer(this.elements.enemySlots, gameState.enemySlots);
        updateContainer(this.elements.stashSlots, gameState.stashSlots);
    }

    showNotification(text, color) {
        const el = document.createElement('div');
        el.className = 'notification';
        el.innerText = text;
        el.style.color = color;
        el.style.position = 'absolute';
        el.style.top = '50%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.fontSize = '3em';
        el.style.fontWeight = 'bold';
        el.style.textShadow = '2px 2px 0 #000';
        el.style.zIndex = '1000';

        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }

    /**
     * Show a special notification when items are fused.
     * @param {Object} data - { item: upgradedItem, fromStarLevel: number }
     */
    showFusionNotification(data) {
        const { item, fromStarLevel } = data;
        const el = document.createElement('div');
        el.className = 'fusion-notification';

        // Create fusion message
        const starDisplay = item.getStarDisplay();
        el.innerHTML = `
            <div class="fusion-title">⚡ FUSION! ⚡</div>
            <div class="fusion-item">
                <span class="fusion-icon">${item.icon}</span>
                <span class="fusion-name">${item.name}</span>
                <span class="fusion-stars">${starDisplay}</span>
            </div>
            <div class="fusion-stats">Stats x${item.statMultiplier}!</div>
        `;

        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
}

export const uiManager = new UIManager();