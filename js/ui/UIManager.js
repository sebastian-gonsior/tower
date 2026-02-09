import { gameState, PHASES, GAME_CONFIG } from '../state/GameState.js';
import { bus } from '../utils/EventBus.js';
import { BuffSystem } from '../systems/BuffSystem.js';
import { globalBuffSystem } from '../systems/GlobalBuffSystem.js';
import { dataManager } from '../managers/DataManager.js';

export class UIManager {
    constructor() {
        this.elements = {
            // Screens
            screenWelcome: document.getElementById('screen-welcome'),
            screenShop: document.getElementById('screen-shop'),
            screenCombat: document.getElementById('screen-combat'),
            screenRewards: document.getElementById('screen-rewards'),

            // Rewards UI
            rewardChoices: document.getElementById('reward-choices'),
            rewardLives: document.getElementById('reward-lives'),
            rewardGold: document.getElementById('reward-gold'),
            rewardIncome: document.getElementById('reward-income'),

            // HUD
            combatTimer: document.getElementById('combat-timer'),

            // Welcome Screen Elements
            charName: document.getElementById('char-name'),
            createCharBtn: document.getElementById('create-char-btn'),
            welcomeBackForm: document.getElementById('welcome-back-form'),
            loginForm: document.getElementById('login-form'),
            welcomeCharName: document.getElementById('welcome-char-name'),
            resumeBtn: document.getElementById('resume-btn'),
            resetSaveBtn: document.getElementById('reset-save-btn'),

            // Interactive Elements
            activeSlots: document.getElementById('active-slots'),
            enemySlots: document.getElementById('enemy-slots'),
            stashSlots: document.getElementById('stash-slots'),

            playerHpBar: document.getElementById('player-hp-bar'),
            playerHpText: document.getElementById('player-hp-text'),
            enemyHpBar: document.getElementById('enemy-hp-bar'),
            enemyHpText: document.getElementById('enemy-hp-text'),

            startFightBtn: document.getElementById('start-fight-btn'),
            finishShoppingBtn: document.getElementById('finish-shopping-btn'),
            backToShopBtn: document.getElementById('back-to-shop-btn'),
            surrenderBtn: document.getElementById('surrender-btn'),

            // Damage Meter
            playerMeter: document.getElementById('player-meter'),
            enemyMeter: document.getElementById('enemy-meter'),
            playerDps: document.getElementById('player-dps'),
            enemyDps: document.getElementById('enemy-dps'),

            levelDisplay: document.getElementById('level-display'),
            goldDisplay: document.getElementById('gold-display'),
            livesDisplay: document.getElementById('lives-display'),

            shopItems: document.getElementById('shop-items'),
            shopGoldDisplay: document.getElementById('shop-gold-display'),
            rerollShopBtn: document.getElementById('reroll-shop-btn'),
            nextFloorNum: document.getElementById('next-floor-num'),
            shopActivePreview: document.getElementById('shop-active-preview'),
            shopStashPreview: document.getElementById('shop-stash-preview'),

            playerNameDisplay: document.getElementById('player-name-display'),
            enemyNameDisplay: document.getElementById('enemy-name-display'),
            bossIntroOverlay: document.getElementById('boss-intro-overlay'),
            bossIntroName: document.getElementById('boss-intro-name'),
            bossIntroText: document.getElementById('boss-intro-text'),
            proceedToEquipBtn: document.getElementById('proceed-to-equip-btn'),

            // Debuff containers
            playerDebuffs: document.getElementById('player-debuffs'),
            enemyDebuffs: document.getElementById('enemy-debuffs'),

            // Buff containers
            playerBuffs: document.getElementById('player-buffs'),
            playerBlessings: document.getElementById('player-blessings'),
            playerSetBonuses: document.getElementById('player-set-bonuses'),
            enemyBuffs: document.getElementById('enemy-buffs'),

            // Sprites
            playerSprite: document.querySelector('.player-sprite'),
            enemySprite: document.querySelector('.enemy-sprite'),

            // Tooltip
            itemTooltip: document.getElementById('item-tooltip'),

            // Panels for state effects
            playerPanel: document.querySelector('.player-panel'),
            enemyPanel: document.querySelector('.enemy-panel'),

            // New elements
            sellZone: document.getElementById('sell-zone')
        };

        this.pressedKeys = new Set();
        this.cheatUsed = false;
        this.init();
    }

    init() {
        this.generateSlots();
        // Initial Render
        this.setupEventBusListeners();
        this.setupEventListeners();
        this.renderSlots();
        this.render();
    }

    setupEventListeners() {
        // Global Listeners
        if (this.elements.finishShoppingBtn) {
            this.elements.finishShoppingBtn.onclick = () => gameState.finishShopping();
        }
        if (this.elements.rerollShopBtn) {
            this.elements.rerollShopBtn.onclick = () => gameState.rerollShop();
        }
        if (this.elements.proceedToEquipBtn) {
            this.elements.proceedToEquipBtn.onclick = () => gameState.startEquipPhase();
        }
        if (this.elements.startFightBtn) {
            this.elements.startFightBtn.onclick = () => bus.emit('UI_REQUEST_START_FIGHT');
        }
        if (this.elements.backToShopBtn) {
            this.elements.backToShopBtn.onclick = () => gameState.setPhase(PHASES.SHOPPING);
        }
        if (this.elements.surrenderBtn) {
            this.elements.surrenderBtn.onclick = () => bus.emit('UI_REQUEST_SURRENDER');
        }

        // Alt key listener for tooltip preview
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Alt') {
                e.preventDefault();
                this.isAltPressed = true;
                if (this.elements.itemTooltip && !this.elements.itemTooltip.classList.contains('hidden') && this.currentTooltipArgs) {
                    this.showTooltip(...this.currentTooltipArgs);
                }
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Alt') {
                this.isAltPressed = false;
                if (this.elements.itemTooltip && !this.elements.itemTooltip.classList.contains('hidden') && this.currentTooltipArgs) {
                    this.showTooltip(...this.currentTooltipArgs);
                }
            }
        });
        // Add A cheat listeners
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'a') {
                if (!e.repeat) {
                    this.pressedKeys.add(key);
                    this.cheatUsed = false;
                }
            }
        });
        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'a') {
                this.pressedKeys.delete(key);
            }
        });

        // Prevention: Clear keys if window loses focus (prevents "stuck" keys)
        window.addEventListener('blur', () => {
            this.pressedKeys.clear();
        });

        // Meter Tabs
        document.querySelectorAll('.meter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const target = e.target.dataset.target; // 'player' or 'enemy'
                const mode = e.target.dataset.mode;     // 'damage' or 'healing'

                this.setMeterMode(target, mode);
            });
        });
    }

    setMeterMode(target, mode) {
        if (!this.meterModes) this.meterModes = { player: 'damage', enemy: 'damage' };
        this.meterModes[target] = mode;

        // Update Tab Active State
        document.querySelectorAll(`.meter-tab[data-target="${target}"]`).forEach(t => {
            t.classList.toggle('active', t.dataset.mode === mode);
        });

        // Trigger re-render if we have latest data? 
        // We don't store latest meter data in UIManager, so we wait for next update or request it?
        // Meter updates frequently (every frame/action), so it should update soon.
        // But to be responsive, we could store lastMeterData.
        if (this.lastMeterData) {
            this.renderMeters(this.lastMeterData);
        }
    }

    isCheatActive() {
        return this.pressedKeys.has('a') && !this.cheatUsed;
    }

    setupEventBusListeners() {
        bus.on('PHASE_CHANGED', (phase) => this.handlePhaseChange(phase));
        bus.on('SLOTS_UPDATED', () => this.renderSlots());
        bus.on('HP_UPDATED', () => this.updateHealthUI());
        bus.on('DAMAGE_DEALT', (data) => this.showFloatingText({ ...data, type: 'damage' }));
        bus.on('SHOW_FLOATING_TEXT', (data) => this.showFloatingText(data));
        bus.on('HEAL_APPLIED', (data) => this.showFloatingText({ ...data, type: 'heal' }));
        bus.on('GOLD_UPDATED', () => this.updateStats());
        bus.on('LEVEL_UPDATED', () => this.updateStats());
        bus.on('LIVES_UPDATED', () => this.updateStats());
        bus.on('SHOP_UPDATED', (items) => this.updateShopUI());
        bus.on('REROLL_COST_UPDATED', (cost) => this.updateRerollButton(cost));
        bus.on('ITEM_SOLD', (data) => {
            this.showFloatingText({
                target: 'player',
                amount: data.price,
                isCrit: true,
                critType: 'gold'
            });
        });
        bus.on('ITEM_FUSED', (data) => this.showFusionNotification(data));
        bus.on('FIGHT_VICTORY', () => {
            this.showNotification("VICTORY!", "gold");
        });
        bus.on('FIGHT_DEFEAT', () => {
            this.showNotification("DEFEAT!", "red");
        });
        bus.on('METER_UPDATE', (data) => this.renderMeters(data));
        bus.on('COMBAT_TIMER_UPDATE', (seconds) => {
            if (this.elements.combatTimer) {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                this.elements.combatTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                // Visual urgency
                if (seconds <= 30) {
                    this.elements.combatTimer.classList.add('timer-low');
                } else {
                    this.elements.combatTimer.classList.remove('timer-low');
                }
            }
        });
    }

    updateRerollButton(cost) {
        if (this.elements.rerollShopBtn) {
            this.elements.rerollShopBtn.innerHTML = `🎲 Reroll Shop (${cost}g)`;
        }
    }

    handlePhaseChange(phase) {
        if (phase === PHASES.SHOPPING) {
            this.showScreen('screen-shop');
            this.updateShopUI();
        } else if (phase === PHASES.REWARDS) {
            this.showScreen('screen-rewards');
            this.renderRewards();
            this.updateStats();

            // Title is always Victory now as we only show this screen on win
            const titleEl = document.querySelector('.victory-title');
            const subtitleEl = document.querySelector('.victory-subtitle');
            if (titleEl && subtitleEl) {
                titleEl.innerText = "VICTORY!";
                titleEl.style.color = "#ffd700"; // Gold
                subtitleEl.innerText = "The Boss has been slain.";
            }
        } else if (phase === PHASES.COMBAT || phase === PHASES.EQUIP || phase === PHASES.BOSS_INTRO) {
            this.showScreen('screen-combat');

            // Handle sub-states within combat screen
            const bossOverlay = document.getElementById('boss-intro-overlay');
            if (phase === PHASES.BOSS_INTRO) {
                if (bossOverlay) {
                    bossOverlay.classList.remove('hidden');
                    if (this.elements.bossIntroName) this.elements.bossIntroName.innerText = gameState.enemy.name;
                    if (this.elements.bossIntroText) this.elements.bossIntroText.innerText = `"${gameState.enemy.introText || "..."}"`;
                }
            } else {
                if (bossOverlay) bossOverlay.classList.add('hidden');
            }

            // Hide shop/fight buttons during active combat
            const isFighting = phase === PHASES.COMBAT;
            if (this.elements.startFightBtn) {
                this.elements.startFightBtn.classList.toggle('hidden', isFighting);
            }
            if (this.elements.backToShopBtn) {
                this.elements.backToShopBtn.classList.toggle('hidden', isFighting);
            }
            if (this.elements.combatTimer) {
                this.elements.combatTimer.classList.toggle('hidden', !isFighting);
            }
            if (this.elements.surrenderBtn) {
                this.elements.surrenderBtn.classList.toggle('hidden', !isFighting);
            }
        }

        // Full render to update names, sprites, health bars, etc.
        this.render();
    }


    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.remove('hidden');
            target.scrollTop = 0;
        }
    }

    render() {
        this.renderSlots();
        this.updateHealthUI();
        this.updateStats();
        this.updatePlayerName();
        this.updateEnemyName();
        this.updateSprites();
    }

    updateStats() {
        if (this.elements.levelDisplay) this.elements.levelDisplay.innerText = gameState.level;
        if (this.elements.goldDisplay) this.elements.goldDisplay.innerText = gameState.gold;
        if (this.elements.livesDisplay) this.elements.livesDisplay.innerText = gameState.lives;
        if (this.elements.shopGoldDisplay) this.elements.shopGoldDisplay.innerText = gameState.gold;
        this.updateRerollButton(gameState.rerollCost);

        // Reward Screen Stats
        if (this.elements.rewardLives) this.elements.rewardLives.innerText = gameState.lives;
        if (this.elements.rewardGold) this.elements.rewardGold.innerText = gameState.gold;
        if (this.elements.rewardIncome) {
            const baseIncome = 100;
            const buffIncome = globalBuffSystem.hasBuff('INCOME_25') ? 25 : 0;
            this.elements.rewardIncome.innerText = `+${baseIncome + buffIncome}`;
        }
    }

    updatePlayerName() {
        if (this.elements.playerNameDisplay) {
            // Log what we try to set
            console.log(`[DEBUG] UIManager updating player name to: ${gameState.playerName}`);
            this.elements.playerNameDisplay.innerText = gameState.playerName || 'Hero';
        }
    }

    updateEnemyName() {
        if (this.elements.enemyNameDisplay) {
            console.log(`[DEBUG] UIManager updating enemy name to: ${gameState.enemy.name}`);
            this.elements.enemyNameDisplay.innerText = gameState.enemy.name || 'Enemy';
        }
    }

    updateSprites() {
        if (this.elements.playerSprite) {
            this.elements.playerSprite.innerText = '🧙'; // Default player icon
        }
        if (this.elements.enemySprite) {
            this.elements.enemySprite.innerText = gameState.enemy.icon || '👹';
        }
    }

    updateHealthUI() {
        const updateBar = (bar, ghost, text, current, max) => {
            if (bar && text) {
                const percent = Math.max(0, Math.min(100, (current / max) * 100));

                // If HP increased (heal), move ghost immediately
                const currentWidth = parseFloat(bar.style.width) || 0;
                if (percent > currentWidth) {
                    if (ghost) ghost.style.width = `${percent}%`;
                }

                bar.style.width = `${percent}%`;
                text.innerText = `${Math.ceil(current)} / ${max}`;

                // Ghost bar will transition slowly via CSS for damage
                if (ghost && percent < currentWidth) {
                    ghost.style.width = `${percent}%`;
                }
            }
        };

        const playerGhost = document.getElementById('player-hp-ghost');
        const enemyGhost = document.getElementById('enemy-hp-ghost');

        updateBar(this.elements.playerHpBar, playerGhost, this.elements.playerHpText, gameState.player.hp, gameState.player.maxHp);
        updateBar(this.elements.enemyHpBar, enemyGhost, this.elements.enemyHpText, gameState.enemy.hp, gameState.enemy.maxHp);

        if (gameState.player.shield > 0) {
            this.elements.playerHpText.innerText += ` (+${Math.ceil(gameState.player.shield)})`;
        }
        if (gameState.enemy.shield > 0) {
            this.elements.enemyHpText.innerText += ` (+${Math.ceil(gameState.enemy.shield)})`;
        }
    }

    renderSlots() {
        const renderSlot = (slotDiv, item, items) => {
            slotDiv.innerHTML = '';
            if (item) {
                const itemDiv = document.createElement('div');
                itemDiv.className = `item rarity-${item.rarity}`;
                itemDiv.draggable = true;

                if (item.starLevel > 0) {
                    itemDiv.classList.add(`star-${item.starLevel}`);
                }

                const iconSpan = document.createElement('span');
                iconSpan.className = 'item-icon';
                iconSpan.innerText = item.icon;
                itemDiv.appendChild(iconSpan);

                if (item.starLevel > 0) {
                    const starSpan = document.createElement('span');
                    starSpan.className = 'item-stars';
                    starSpan.innerText = item.getStarDisplay();
                    itemDiv.appendChild(starSpan);
                }

                // Tooltip Events
                itemDiv.addEventListener('mouseenter', (e) => this.showTooltip(item, e.clientX, e.clientY, items));
                itemDiv.addEventListener('mouseleave', () => this.hideTooltip());
                itemDiv.addEventListener('mousemove', (e) => this.updateTooltipPosition(e.clientX, e.clientY));

                // Drag Events
                itemDiv.addEventListener('dragstart', (e) => {
                    // Only allow drag during EQUIP phase or SHOPPING (for selling from stash)
                    if (gameState.phase !== PHASES.EQUIP && gameState.phase !== PHASES.SHOPPING) {
                        e.preventDefault();
                        return;
                    }
                    const slotType = slotDiv.dataset.type;
                    const slotIndex = slotDiv.dataset.index;
                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: slotType, index: parseInt(slotIndex) }));
                    this.hideTooltip();
                });

                if (item.cooldown > 0) {
                    const castbarContainer = document.createElement('div');
                    castbarContainer.className = 'castbar-container';

                    const castbarFill = document.createElement('div');
                    castbarFill.className = 'castbar-fill';

                    const progress = item.cooldown > 0 ?
                        Math.max(0, 100 - (item.currentCooldown / item.cooldown) * 100) : 100;
                    castbarFill.style.width = `${progress}%`;

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
                // Fix: Was recursively calling updateContainer which caused infinite loop
                renderSlot(slotDiv, items[index], items);
            });
        };

        updateContainer(this.elements.activeSlots, gameState.activeSlots);
        updateContainer(this.elements.enemySlots, gameState.enemySlots);
        updateContainer(this.elements.stashSlots, gameState.stashSlots);
    }

    updateShopUI() {
        const container = this.elements.shopItems;
        if (!container) return;

        container.innerHTML = '';

        if (this.elements.shopGoldDisplay) {
            this.elements.shopGoldDisplay.innerText = gameState.gold;
        }

        gameState.shopItems.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'shop-item';

            if (!item) {
                el.classList.add('sold-out');
                el.innerHTML = `<span class="sold-out-text">SOLD</span>`;
                container.appendChild(el);
                return;
            }

            if (item.price > gameState.gold) {
                el.classList.add('too-expensive');
            }

            el.classList.add(`rarity-${item.rarity}`);

            const setClass = item.set ? `set-badge-${item.set.toLowerCase()}` : '';
            el.innerHTML = `
                <div class="item-stars">${'★'.repeat(item.starLevel)}</div>
                <div class="item-icon">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-set-badge ${setClass}">${item.set ? item.set : ''}</div>
                <div class="shop-item-rarity rarity-text-${item.rarity}">${item.rarity.toUpperCase()}</div>
                <div class="shop-item-price">${item.price}g</div>
            `;

            // el.title = `${item.name} (${item.rarity})`; // Remove native tooltip

            // Tooltip Events
            el.addEventListener('mouseenter', (e) => {
                // console.log('mouseenter item', item);
                this.showTooltip(item, e.clientX, e.clientY, gameState.activeSlots);
            });
            el.addEventListener('mouseleave', () => this.hideTooltip());
            el.addEventListener('mousemove', (e) => {
                this.updateTooltipPosition(e.clientX, e.clientY);
            });

            el.onclick = () => {
                this.hideTooltip(); // Close tooltip on click

                if (this.isCheatActive()) {
                    gameState.upgradeItem('shop', index);
                    this.cheatUsed = true;
                    return;
                }

                if (gameState.buyItem(index)) {
                    this.updateShopUI();
                    this.update();
                }
            };

            container.appendChild(el);
        });

        if (this.elements.nextFloorNum) this.elements.nextFloorNum.innerText = gameState.level;

        // Render inventory preview
        this.renderShopInventoryPreview();
    }

    renderShopInventoryPreview() {
        const renderPreviewSlots = (container, items, maxSlots, type) => {
            if (!container) return;
            container.innerHTML = '';

            for (let i = 0; i < maxSlots; i++) {
                const slot = document.createElement('div');
                slot.className = 'slot';

                const item = items[i];
                if (item) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = `item rarity-${item.rarity}`;
                    itemDiv.innerHTML = item.icon;
                    itemDiv.draggable = true;

                    // Tooltip Events
                    itemDiv.addEventListener('mouseenter', (e) => this.showTooltip(item, e.clientX, e.clientY, items));
                    itemDiv.addEventListener('mouseleave', () => this.hideTooltip());
                    itemDiv.addEventListener('mousemove', (e) => this.updateTooltipPosition(e.clientX, e.clientY));

                    // Drag Events
                    itemDiv.addEventListener('dragstart', (e) => {
                        if (gameState.phase !== PHASES.SHOPPING) {
                            e.preventDefault();
                            return;
                        }
                        e.dataTransfer.setData('text/plain', JSON.stringify({ type: type, index: i }));
                        this.hideTooltip();
                    });

                    slot.appendChild(itemDiv);
                }

                container.appendChild(slot);
            }
        };

        renderPreviewSlots(this.elements.shopActivePreview, gameState.activeSlots, GAME_CONFIG.slotsCount, 'active');
        renderPreviewSlots(this.elements.shopStashPreview, gameState.stashSlots, GAME_CONFIG.stashCount, 'stash');
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

                // Add Drag and Drop Events
                slot.addEventListener('dragover', (e) => {
                    if (gameState.phase !== PHASES.EQUIP) return;
                    e.preventDefault();
                    slot.classList.add('drag-over');
                });
                slot.addEventListener('dragleave', () => {
                    slot.classList.remove('drag-over');
                });
                slot.addEventListener('drop', (e) => {
                    if (gameState.phase !== PHASES.EQUIP) return;
                    e.preventDefault();
                    slot.classList.remove('drag-over');
                    const textData = e.dataTransfer.getData('text/plain');
                    if (textData) {
                        try {
                            const data = JSON.parse(textData);
                            if (data.type && data.index !== undefined) {
                                // If dropping on same slot, ignore
                                if (data.type === type && data.index === i) return;

                                // Enemy slots are read-only
                                if (type === 'enemy') return;

                                this.moveItem(data.type, data.index, type, i);
                            }
                        } catch (err) {
                            console.error("Failed to parse drop data", err);
                        }
                    }
                });

                container.appendChild(slot);
            }
        };

        createSlots(this.elements.activeSlots, GAME_CONFIG.slotsCount, 'active');
        createSlots(this.elements.enemySlots, GAME_CONFIG.slotsCount, 'enemy');
        createSlots(this.elements.stashSlots, GAME_CONFIG.stashCount, 'stash');

        // Setup Sell Zone
        if (this.elements.sellZone) {
            this.elements.sellZone.addEventListener('dragover', (e) => {
                if (gameState.phase !== PHASES.EQUIP && gameState.phase !== PHASES.SHOPPING) return;
                e.preventDefault();
                this.elements.sellZone.classList.add('drag-over');
            });
            this.elements.sellZone.addEventListener('dragleave', () => {
                this.elements.sellZone.classList.remove('drag-over');
            });
            this.elements.sellZone.addEventListener('drop', (e) => {
                if (gameState.phase !== PHASES.EQUIP && gameState.phase !== PHASES.SHOPPING) return;
                e.preventDefault();
                this.elements.sellZone.classList.remove('drag-over');
                const textData = e.dataTransfer.getData('text/plain');
                if (textData) {
                    try {
                        const data = JSON.parse(textData);
                        if (data.type && data.index !== undefined) {
                            gameState.sellItem(data.type, data.index);
                        }
                    } catch (err) {
                        console.error("Failed to parse drop data", err);
                    }
                }
            });
        }
    }

    handleSlotClick(type, index) {
        this.hideTooltip(); // Close tooltip on click

        if (this.isCheatActive()) {
            gameState.upgradeItem(type, index);
            this.cheatUsed = true;
            return;
        }

        if (gameState.phase !== PHASES.EQUIP) {
            return;
        }

        const item = gameState.getArray(type)[index];

        // Simple click-move logic:
        // - If in stash, try move to active
        // - If in active, try move to stash
        // - Enemy slots are read-only for player

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
            bus.emit('ITEM_MOVED', { fromType, fromIndex: fromIdx, toType, toIndex: toIdx });
            this.refreshTooltip();
        }
    }

    showFloatingText(data) {
        // data: { target, damage, amount, type, isCrit, critType, sourceType, debuffType }
        const { target, damage, amount, type, isCrit, critType, sourceType, debuffType } = data;

        let text = '';
        let colorClass = '';
        let sideClass = 'damage'; // Default to damage side

        const val = amount || damage || 0;
        if (val === 0) return;

        if (type === 'heal' || amount !== undefined || (isCrit && critType === 'gold')) {
            text = (type === 'heal' || amount !== undefined) ? `+${val}` : `${val}`;
            colorClass = (isCrit && critType === 'gold') ? 'gold-text' : 'heal-text';
            sideClass = 'gain';
        } else {
            text = `-${val}`;
            // Add blocked text if present
            if (data.blocked > 0) {
                text += ` (${data.blocked} blocked)`;
            }
            colorClass = 'damage-text';
            sideClass = 'damage';
        }

        if (isCrit) {
            const hasPlus = String(val).startsWith('+');
            const hasMinus = String(val).startsWith('-');
            if (sideClass === 'gain') {
                text = (hasPlus ? val : `+${val}`) + '!';
            } else {
                text = (hasMinus ? val : `-${val}`) + '!';
            }
            if (critType !== 'gold') colorClass = 'crit-text';
        }

        if (sourceType === 'debuff') {
            colorClass = `debuff-text-${debuffType}`;
        } else if (sourceType === 'reflect') {
            colorClass = 'reflect-text';
            text = `🌵 ${val}`;
        }

        // Find position
        const panelId = target === 'player' ? 'player-hp-bar' : 'enemy-hp-bar';
        const anchor = document.getElementById(panelId);

        if (anchor) {
            const rect = anchor.getBoundingClientRect();

            // Initial positioning: Damage starts slightly left, Gains start slightly right
            const sideOffset = sideClass === 'damage' ? -40 : 40;
            const randomX = (Math.random() - 0.5) * 40;
            const randomY = (Math.random() - 0.5) * 40;

            const el = document.createElement('div');
            el.className = `floating-text ${colorClass} ${sideClass}`;
            if (isCrit) el.classList.add('crit');

            el.innerText = text;
            el.style.left = `${rect.left + rect.width / 2 + sideOffset + randomX}px`;
            el.style.top = `${rect.top + randomY}px`;

            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1200); // 1.2s to match gain animation

            // Trigger visual impact if it's damage
            if (sideClass === 'damage') {
                this.triggerHitEffect(target, isCrit);
            }
        }
    }

    triggerHitEffect(target, isCrit) {
        const panel = target === 'player' ? this.elements.playerPanel : this.elements.enemyPanel;
        const sprite = target === 'player' ? this.elements.playerSprite : this.elements.enemySprite;
        const screenFlash = document.getElementById('screen-flash');

        if (panel) {
            const shakeClass = isCrit ? 'crit-shake' : 'shake';
            panel.classList.remove('shake', 'crit-shake');
            void panel.offsetWidth; // Trigger reflow
            panel.classList.add(shakeClass);
            setTimeout(() => panel.classList.remove(shakeClass), 500);
        }

        if (sprite) {
            sprite.classList.remove('hit-flash', 'sprite-impact');
            void sprite.offsetWidth; // Trigger reflow
            sprite.classList.add('hit-flash', 'sprite-impact');
            setTimeout(() => sprite.classList.remove('hit-flash', 'sprite-impact'), 500);
        }

        // Global screen flash for crits
        if (isCrit && screenFlash) {
            screenFlash.classList.remove('flash-active');
            void screenFlash.offsetWidth;
            screenFlash.classList.add('flash-active');
        }
    }



    update() {
        this.updateCooldowns();
        this.renderDebuffs();
        this.renderBuffs();
    }

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

            // Frozen
            const frozenDebuffs = debuffs.filter(d => d.type === 'frozen');
            if (frozenDebuffs.length > 0) {
                const stacks = frozenDebuffs.length;
                // Each stack adds 10% slow (or get it from debuff data if available)
                const slowPercent = stacks * 10;
                // Get the longest remaining duration from all frozen stacks
                const maxDuration = Math.max(...frozenDebuffs.map(d => d.duration || 0));
                const durationSec = Math.ceil(maxDuration / 1000);

                const debuffEl = document.createElement('div');
                debuffEl.className = 'debuff-icon debuff-frozen';
                debuffEl.innerHTML = `
                    <span class="debuff-emoji">❄️</span>
                    <span class="debuff-value">-${slowPercent}%</span>
                    <span class="debuff-duration">${durationSec}s</span>
                    <span class="debuff-count">x${stacks}</span>
                `;
                debuffEl.title = `Frozen: ${stacks} stacks, ${slowPercent}% slower, ${durationSec}s remaining`;
                container.appendChild(debuffEl);
            }

            // DoTs
            const dotTypes = ['bleed', 'poison', 'fire', 'shadow', 'curse'];
            dotTypes.forEach(type => {
                const debuff = debuffs.find(d => d.type === type);
                if (debuff) {
                    const debuffEl = document.createElement('div');
                    debuffEl.className = `debuff-icon debuff-${type}`;

                    // Calculate remaining duration in seconds
                    const durationSec = Math.ceil(debuff.duration / 1000);

                    debuffEl.innerHTML = `
                        <span class="debuff-emoji">${debuffIcons[type] || ''}</span>
                        <span class="debuff-value">${debuff.damagePerTick}</span>
                        <span class="debuff-duration">${durationSec}s</span>
                        <span class="debuff-count">x${debuff.stacks || 1}</span>
                    `;
                    debuffEl.title = `${type}: ${debuff.damagePerTick} dmg/tick, ${durationSec}s remaining, ${debuff.stacks || 1} stacks`;
                    container.appendChild(debuffEl);
                }
            });
        };

        renderDebuffContainer(this.elements.playerDebuffs, gameState.combatState.playerDebuffs);
        renderDebuffContainer(this.elements.enemyDebuffs, gameState.combatState.enemyDebuffs);

        // Toggle Frozen visual state on panels (Ice Lock)
        // Only trigger if the target is literally "Ice Locked" (frozenTimer > 0)
        const isPlayerFrozen = (gameState.combatState.playerFrozenTimer || 0) > 0;
        const isEnemyFrozen = (gameState.combatState.enemyFrozenTimer || 0) > 0;

        if (this.elements.playerPanel) {
            this.elements.playerPanel.classList.toggle('state-frozen', isPlayerFrozen);
        }
        if (this.elements.enemyPanel) {
            this.elements.enemyPanel.classList.toggle('state-frozen', isEnemyFrozen);
        }
    }

    renderBuffs() {
        const buffIcons = {
            speedBonus: '⚡',
            critChance: '🎯',
            multihitChance: '💥',
            critDmg: '💢',
            shieldBonus: '🛡️',
            blockChance: '🧱'
        };

        const renderBuffContainer = (container, slots) => {
            if (!container) return;
            container.innerHTML = '';
            const buffs = BuffSystem.calculateBuffs(slots);

            // Multihit logic for display: if we have hits, we set chance to 1.0 to show the icon
            if (buffs.multihitCount > 0) {
                buffs.multihitChance = 1.0;
            }

            Object.entries(buffs).forEach(([key, value]) => {
                if (value > 0 || (key === 'critDmg' && value > 2.0)) {
                    if (buffIcons[key]) {
                        const el = document.createElement('div');
                        el.className = `buff-icon buff-${key}`;

                        let displayValue = '';
                        let title = '';

                        if (key === 'speedBonus') {
                            displayValue = `+${Math.round(value * 100)}%`;
                            title = `Haste: ${displayValue}`;
                        } else if (key === 'critChance') {
                            displayValue = `${Math.round(value * 100)}%`;
                            title = `Global Crit: ${displayValue}`;
                        } else if (key === 'multihitChance') {
                            // Logic change: Multihit is now always 100% if count > 0
                            const count = buffs.multihitCount || 0;
                            if (count > 0) {
                                displayValue = `x${count}`;
                                title = `Multihit: Always hits ${count} times`;
                            } else {
                                return; // Don't show if count is 0
                            }
                        } else if (key === 'critDmg') {
                            displayValue = `x${value.toFixed(1)}`;
                            title = `Crit Damage: ${displayValue}`;
                        } else if (key === 'shieldBonus') {
                            displayValue = `${value}`;
                            title = `Shield: Gain ${value} Absorb per hit`;
                        } else if (key === 'blockChance') {
                            displayValue = `${Math.round(value * 100)}%`;
                            title = `Block: Reduce incoming damage by ${Math.round(value * 100)}%`;
                        }

                        el.innerHTML = `
                            <span class="buff-emoji">${buffIcons[key]}</span>
                            <span class="buff-value">${displayValue}</span>
                        `;
                        el.title = title;
                        container.appendChild(el);
                    }
                }
            });
        };

        renderBuffContainer(this.elements.playerBuffs, gameState.activeSlots);
        renderBuffContainer(this.elements.enemyBuffs, gameState.enemySlots);

        this.renderBlessings();
    }

    renderBlessings() {
        const container = this.elements.playerBlessings;
        if (!container) return;

        container.innerHTML = '';
        const allBuffs = globalBuffSystem.getAllBuffs();
        const activeBuffs = allBuffs.filter(buff => globalBuffSystem.hasBuff(buff.id));

        if (activeBuffs.length > 0) {
            // Add blessings header
            const headerEl = document.createElement('div');
            headerEl.className = 'blessing-header';
            headerEl.innerHTML = `<span class="blessing-icon-small">✨</span><span class="blessing-name">Blessings</span>`;
            container.appendChild(headerEl);

            activeBuffs.forEach(buff => {
                const el = document.createElement('div');
                el.className = `blessing-icon active`;
                el.innerText = buff.icon;

                // Tooltip
                el.title = `${buff.name}\n${buff.description}`;

                container.appendChild(el);
            });
        }

        // Render Set Bonuses in separate container (moved outside of the early return)
        this.renderSetBonuses();
    }

    renderSetBonuses() {
        const container = this.elements.playerSetBonuses;
        if (!container) return;

        container.innerHTML = '';

        const allSets = dataManager.getAllSets();
        const counts = globalBuffSystem.getActiveSetBonuses();

        allSets.forEach(setDef => {
            const count = counts[setDef.id] || 0;
            if (count < 2) return;

            // Add set header with piece count
            const headerEl = document.createElement('div');
            headerEl.className = 'set-bonus-header';

            // Try to find a nice icon for the set header. 
            // We can use the first item's icon or define icons in sets.json.
            // For now, let's use a default or look at items.
            let setIcon = "⚒️";
            if (setDef.id === 'elf') setIcon = "🍃";
            if (setDef.id === 'undead') setIcon = "💀";
            if (setDef.id === 'celestial') setIcon = "☀️";
            if (setDef.id === 'infernal') setIcon = "🔥";
            if (setDef.id === 'oceanic') setIcon = "🌊";
            if (setDef.id === 'assassin') setIcon = "🗡️";
            if (setDef.id === 'paladin') setIcon = "🛡️";
            if (setDef.id === 'warlock') setIcon = "🪄";
            if (setDef.id === 'titan') setIcon = "🗿";

            headerEl.innerHTML = `<span class="set-icon">${setIcon}</span><span class="set-name">${setDef.name} (${count}pc)</span>`;
            container.appendChild(headerEl);

            if (setDef.bonuses) {
                setDef.bonuses.forEach(bonus => {
                    if (count >= bonus.threshold) {
                        const el = document.createElement('div');
                        el.className = 'set-bonus-icon active';

                        // Pick an icon based on the bonus description if possible
                        let icon = '✨';
                        const desc = bonus.description.toLowerCase();
                        if (desc.includes('crit')) icon = '🎯';
                        else if (desc.includes('bleed')) icon = '🩸';
                        else if (desc.includes('poison')) icon = '🧪';
                        else if (desc.includes('speed')) icon = '💨';
                        else if (desc.includes('damage')) icon = '💥';
                        else if (desc.includes('block')) icon = '🛡️';
                        else if (desc.includes('holy') || desc.includes('heal')) icon = '✨';
                        else if (desc.includes('shadow')) icon = '🌑';
                        else if (desc.includes('curse')) icon = '🧿';
                        else if (desc.includes('frozen')) icon = '❄️';
                        else if (desc.includes('multihit')) icon = '⚔️';
                        else if (desc.includes('lifesteal')) icon = '🦇';

                        el.innerText = icon;
                        el.title = `${bonus.name}\n${bonus.description}`;
                        container.appendChild(el);
                    }
                });
            }
        });
    }

    // --- Tooltip Logic ---

    showTooltip(item, x, y, slots = null) {
        if (!this.elements.itemTooltip) {
            this.elements.itemTooltip = document.getElementById('item-tooltip');
        }

        if (!item || !this.elements.itemTooltip) return;

        // Store args for refresh
        this.currentTooltipArgs = [item, x, y, slots];

        let displayItem = item;
        let isPreview = false;

        // Handle Preview Mode (Alt Key)
        if (this.isAltPressed && item.starLevel < 10) {
            if (typeof item.getPreview === 'function') {
                const previewData = item.getPreview(item.starLevel + 1);
                if (previewData) {
                    displayItem = {
                        ...item,
                        starLevel: previewData.starLevel,
                        stats: previewData.stats,
                        effects: previewData.effects
                    };
                    isPreview = true;
                }
            }
        }

        const el = this.elements.itemTooltip;
        el.className = `item-tooltip rarity-${displayItem.rarity}`;

        // Get Combined Stats (Applied stats include global sets/blessings)
        const combined = BuffSystem.getItemCombinedStats(displayItem, slots || gameState.activeSlots);
        const base = displayItem.stats || {};

        // 1. Header
        let html = `
            ${isPreview ? '<div style="background: #4caf50; color: white; text-align: center; padding: 4px; border-radius: 6px; font-weight: bold; margin-bottom: 10px; font-size: 0.8em;">NEXT LEVEL PREVIEW</div>' : ''}
            <div class="tooltip-header">
                <div class="tooltip-icon">${displayItem.icon}</div>
                <div class="tooltip-title">
                    <div class="tooltip-name">${displayItem.getDisplayName ? displayItem.getDisplayName() : displayItem.name}</div>
                    <div class="tooltip-rarity rarity-text-${displayItem.rarity}">${displayItem.rarity}</div>
                    <div class="tooltip-type">${displayItem.type} ${displayItem.subtype ? `• ${displayItem.subtype}` : ''}</div>
                    ${displayItem.set ? `<div class="tooltip-set rarity-text-${displayItem.rarity}">Set: ${dataManager.getAllSets().find(s => s.id === displayItem.set)?.name || displayItem.set}</div>` : ''}
                </div>
            </div>
        `;

        // 2. Base Stats
        html += '<div class="tooltip-sub-header">Base Item Stats</div>';
        html += '<div class="stats-grid">';

        if (base.damage) html += `<div class="stat-box"><span class="stat-label-small">Damage</span><span class="stat-value-main">${base.damage}</span></div>`;
        if (base.cooldown) html += `<div class="stat-box"><span class="stat-label-small">Cooldown</span><span class="stat-value-main">${base.cooldown}s</span></div>`;
        if (base.shield) html += `<div class="stat-box"><span class="stat-label-small">Shield</span><span class="stat-value-main">${base.shield}</span></div>`;
        if (base.block) html += `<div class="stat-box"><span class="stat-label-small">Block</span><span class="stat-value-main">${Math.round(base.block * 100)}%</span></div>`;
        if (base.attackSpeed) html += `<div class="stat-box"><span class="stat-label-small">Speed</span><span class="stat-value-main">+${Math.round(base.attackSpeed * 100)}%</span></div>`;
        if (base.critChance) html += `<div class="stat-box"><span class="stat-label-small">Crit %</span><span class="stat-value-main">+${Math.round(base.critChance * 100)}%</span></div>`;

        html += '</div>';

        // 3. Crit Tiers
        const critChance = combined.critChance;
        if (critChance > 0) {
            html += '<div class="tooltip-sub-header">Crit Tiers</div>';

            const normalCrit = Math.min(1.0, critChance) * (1 - 0.2);
            const superCrit = Math.min(1.0, critChance) * 0.2 * (1 - 0.2);
            const hyperCrit = Math.min(1.0, critChance) * 0.2 * 0.2;

            html += `
                <div class="crit-tier crit-tier-normal"><span>Crit (2x)</span><span>${Math.round(normalCrit * 100)}%</span></div>
                <div class="crit-tier crit-tier-super"><span>SuperCrit (3x)</span><span>${Math.round(superCrit * 100)}%</span></div>
                <div class="crit-tier crit-tier-hyper"><span>HyperCrit (5x)</span><span>${Math.round(hyperCrit * 100)}%</span></div>
            `;
        }

        // 3. Total Applied Stats (The final combat values)
        html += '<div class="tooltip-sub-header">Total Applied (Combat)</div>';
        html += '<div class="stats-grid">';

        // Damage remains same if no global damage buffs exist yet
        html += `<div class="stat-box highlight"><span class="stat-label-small">Damage</span><span class="stat-value-main">${combined.damage}</span></div>`;

        // Final Attack Speed
        const finalAs = combined.attackSpeed.toFixed(2);
        html += `<div class="stat-box highlight"><span class="stat-label-small">Atk Speed</span><span class="stat-value-main">${finalAs}/s</span></div>`;

        // Final Crit Chance
        html += `<div class="stat-box highlight"><span class="stat-label-small">Crit Chance</span><span class="stat-value-main">${Math.round(combined.critChance * 100)}%</span></div>`;

        // Final Crit Damage
        html += `<div class="stat-box highlight"><span class="stat-label-small">Crit Dmg</span><span class="stat-value-main">x${combined.critDmg.toFixed(1)}</span></div>`;

        // Multihit
        if (combined.multihitCount > 1) {
            html += `<div class="stat-box highlight"><span class="stat-label-small">Hits</span><span class="stat-value-main">x${combined.multihitCount}</span></div>`;
        }

        // Lifesteal
        if (combined.lifesteal > 0) {
            html += `<div class="stat-box highlight"><span class="stat-label-small">Lifesteal</span><span class="stat-value-main">${Math.round(combined.lifesteal * 100)}%</span></div>`;
        }

        // Shield (Absorb)
        if (combined.shield > 0) {
            html += `<div class="stat-box highlight"><span class="stat-label-small">Shield</span><span class="stat-value-main">${combined.shield}</span></div>`;
        }

        // Block (Reduction)
        if (combined.block > 0) {
            html += `<div class="stat-box highlight"><span class="stat-label-small">Block</span><span class="stat-value-main">${Math.round(combined.block * 100)}%</span></div>`;
        }

        html += '</div>';

        // 5. All Set Bonuses
        if (combined.setBonuses && combined.setBonuses.length > 0) {
            const relevantBonuses = combined.setBonuses.filter(sb => sb.setId === displayItem.set);

            if (relevantBonuses.length > 0) {
                html += '<div class="tooltip-sub-header">Set Progression</div>';
                relevantBonuses.forEach(sb => {
                    const statusClass = sb.active ? '' : 'inactive';
                    html += `
                        <div class="set-bonus-line ${statusClass}">
                            <span class="set-bonus-dot">${sb.active ? '●' : '○'}</span>
                            <span class="set-bonus-text">${sb.name}: ${sb.description}</span>
                        </div>
                    `;
                });
            }
        }

        // 6. Bonus Sources (Active only)
        const activeSources = combined.sources;
        if (activeSources.length > 0) {
            html += '<div class="tooltip-sub-header">Active Bonuses</div>';
            activeSources.forEach(src => {
                html += `
                    <div class="bonus-source source-type-${src.type}">
                        <span style="flex:1">${src.name}</span>
                        <span style="font-weight:bold">${src.bonus}</span>
                    </div>
                `;
            });
        }

        // 7. Effects
        const effects = combined.modifiedEffects;
        if (Object.keys(effects).length > 0) {
            html += '<div class="tooltip-sub-header">Special Effects</div>';
            html += '<div class="tooltip-effects">';
            for (const [type, data] of Object.entries(effects)) {
                let effectDesc = '';
                // Chance removed - using implicit 100%

                if (type === 'goldOnHit') effectDesc = `+${data.amount} Gold on Hit`;
                else if (type === 'poison') effectDesc = `Poison: ${data.damagePerTick} dmg (${data.duration}s)`;
                else if (type === 'shadow') effectDesc = `Shadow: ${data.damagePerTick} dmg (${data.duration}s)`;
                else if (type === 'curse') effectDesc = `Curse: ${data.damagePerTick} dmg (${data.duration}s)`;
                else if (type === 'bleed') {
                    effectDesc = `Bleed: ${data.damagePerTick} dmg`;
                    if (data.isModified) {
                        effectDesc += ` <span class="effect-mod-label">(Base: ${data.original.damagePerTick})</span>`;
                    }
                    effectDesc += ` (${data.duration}s)`;
                    if (data.tickInterval && data.tickInterval < 1000) {
                        effectDesc += ` <span class="effect-mod-label">Rapid Ticks!</span>`;
                    }
                }
                else if (type === 'fire') effectDesc = `Burn: ${data.damagePerTick} dmg (${data.duration}s)`;
                else if (type === 'frozen') effectDesc = `Freeze Target`;
                else if (type === 'holy') effectDesc = `Heal ${data.heal} & +${data.maxHpGain || 0} MaxHP`;
                else if (type === 'multihit') effectDesc = `Multihit: x${data.count}`;
                else if (type === 'lifesteal') effectDesc = `Lifesteal: ${Math.round((data.factor || 0) * 100)}%`;
                else effectDesc = type.charAt(0).toUpperCase() + type.slice(1);

                const modClass = data.isModified ? 'modified' : '';
                html += `<div class="effect-row ${modClass}">✦ ${effectDesc}</div>`;
            }
            html += '</div>';
        }

        // 6. Price
        if (displayItem.price) {
            html += `<div class="tooltip-price">BUY PRICE: ${displayItem.price}G</div>`;
        }

        el.innerHTML = html;
        el.classList.remove('hidden');
        this.updateTooltipPosition(x, y);
    }

    updateTooltipPosition(x, y) {
        const el = this.elements.itemTooltip;
        if (!el || el.classList.contains('hidden')) return;

        const rect = el.getBoundingClientRect();
        const tooltipWidth = rect.width || 300; // Fallback to CSS width

        // Default: right of cursor
        let leftPos = x + 20;
        let topPos = y;

        // Check overflow
        if (leftPos + tooltipWidth > window.innerWidth) {
            // Flip to left of cursor
            leftPos = x - tooltipWidth - 20;
        }

        // Prevent overflow bottom
        if (topPos + rect.height > window.innerHeight) {
            topPos = window.innerHeight - rect.height - 10;
        }

        el.style.left = `${leftPos}px`;
        el.style.top = `${topPos}px`;
    }

    refreshTooltip() {
        if (!this.elements.itemTooltip || this.elements.itemTooltip.classList.contains('hidden')) return;
        if (this.currentTooltipArgs) {
            this.showTooltip(...this.currentTooltipArgs);
        }
    }

    hideTooltip() {
        if (this.elements.itemTooltip) {
            this.elements.itemTooltip.classList.add('hidden');
        }
    }

    updateCooldowns() {
        const updateContainer = (container, items) => {
            if (!container) return;
            Array.from(container.children).forEach((slotDiv, index) => {
                const item = items[index];
                if (!item) return;

                const itemDiv = slotDiv.querySelector('.item');
                if (!itemDiv) return;

                let castbarFill = itemDiv.querySelector('.castbar-fill');
                if (item.cooldown > 0) {
                    if (!castbarFill) {
                        // If castbar missing (e.g. dynamic update), re-render slot is best, 
                        // but for perf we can just query it.
                        // It should be there from renderSlot.
                    }
                    if (castbarFill) {
                        const progress = Math.max(0, 100 - (item.currentCooldown / item.cooldown) * 100);
                        castbarFill.style.width = `${progress}%`;
                        if (item.currentCooldown <= 0) castbarFill.classList.add('ready');
                        else castbarFill.classList.remove('ready');
                    }
                }
            });
        };

        updateContainer(this.elements.activeSlots, gameState.activeSlots);
        updateContainer(this.elements.enemySlots, gameState.enemySlots);
        updateContainer(this.elements.stashSlots, gameState.stashSlots);
    }

    renderRewards() {
        const container = this.elements.rewardChoices;
        if (!container) return;

        container.innerHTML = '';

        const buffs = globalBuffSystem.getBuffsForLevel(gameState.level);

        buffs.forEach(buff => {
            const card = document.createElement('div');
            card.className = 'reward-card';

            card.innerHTML = `
                <div class="reward-icon">${buff.icon}</div>
                <div class="reward-name">${buff.name}</div>
                <div class="reward-desc">${buff.description}</div>
            `;

            card.onclick = () => {
                gameState.selectReward(buff.id);
                this.refreshTooltip();
            };

            container.appendChild(card);
        });
    }

    showNotification(text, color) {
        const el = document.createElement('div');
        el.className = 'notification';
        el.innerText = text;
        el.style.color = color;
        // Styles should ideally be in CSS, but inline for quick fix
        el.style.position = 'absolute';
        el.style.top = '50%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.fontSize = '4em';
        el.style.fontWeight = 'bold';
        el.style.textShadow = '0 0 10px #000';
        el.style.zIndex = '2000';
        el.style.pointerEvents = 'none';

        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }

    showFusionNotification(data) {
        const { item } = data;
        const el = document.createElement('div');
        el.className = 'fusion-notification';
        el.innerHTML = `
            <div class="fusion-title">⚡ FUSION! ⚡</div>
            <div class="fusion-item">
                <span class="fusion-icon">${item.icon}</span>
                <span class="fusion-name">${item.name}</span>
            </div>
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    renderMeters(data) {
        this.lastMeterData = data; // Store for tab switching
        if (!this.meterModes) this.meterModes = { player: 'damage', enemy: 'damage' };

        this.renderMeter(this.elements.playerMeter, this.elements.playerDps, data.player, this.meterModes.player);
        this.renderMeter(this.elements.enemyMeter, this.elements.enemyDps, data.enemy, this.meterModes.enemy);
    }

    renderMeter(container, dpsLabel, stats, mode = 'damage') {
        if (!container) return;

        // Update Label
        if (dpsLabel) {
            let val = stats.dps;
            let label = 'DPS';
            if (mode === 'healing') { val = stats.hps; label = 'HPS'; }
            else if (mode === 'gold') { val = 0; label = 'Gold'; /* No GPS yet */ }

            dpsLabel.innerText = `${Math.round(val || 0)} ${label}`;
        }

        container.innerHTML = '';

        // Filter entries based on mode
        const filteredEntries = stats.entries.filter(entry => {
            if (mode === 'damage') return entry.type === 'damage';
            if (mode === 'healing') return entry.type === 'healing';
            if (mode === 'gold') return entry.type === 'gold';
            return false;
        });

        // Sum local total
        let localTotal = 0;
        filteredEntries.forEach(e => {
            if (e.type === 'damage') localTotal += e.damage;
            else if (e.type === 'healing') localTotal += e.healing;
            else if (e.type === 'gold') localTotal += e.gold;
        });

        filteredEntries.sort((a, b) => {
            const valA = (a.type === 'damage' ? a.damage : (a.type === 'healing' ? a.healing : a.gold));
            const valB = (b.type === 'damage' ? b.damage : (b.type === 'healing' ? b.healing : b.gold));
            return valB - valA;
        });

        filteredEntries.forEach(entry => {
            const row = document.createElement('div');

            let type = entry.type;
            let value = 0;
            if (type === 'damage') value = entry.damage;
            else if (type === 'healing') value = entry.healing;
            else if (type === 'gold') value = entry.gold;

            // ... specific classes ...
            let specificClass = '';
            const nameLower = entry.name.toLowerCase();
            if (nameLower.includes('poison')) specificClass = 'source-poison';
            else if (nameLower.includes('bleed')) specificClass = 'source-bleed';
            else if (nameLower.includes('fire') || nameLower.includes('burn')) specificClass = 'source-fire';
            else if (nameLower.includes('ice') || nameLower.includes('frozen')) specificClass = 'source-ice';
            else if (nameLower.includes('shadow')) specificClass = 'source-shadow';
            else if (nameLower.includes('reflect')) specificClass = 'source-reflect';
            else if (nameLower.includes('absorb')) specificClass = 'source-absorb'; // New for shield

            row.className = `meter-row type-${type} ${specificClass}`;

            // Calc pct
            let pct = localTotal > 0 ? (value / localTotal) * 100 : 0;
            const barWidth = Math.min(100, Math.max(0, pct));

            row.innerHTML = `
                <div class="meter-bar-fill" style="width: ${barWidth}%"></div>
                <div class="meter-text-left">${entry.name}</div>
                <div class="meter-text-right">
                    ${Math.round(value || 0)}${type === 'gold' ? 'g' : ''}
                    ${(type === 'damage' && entry.blocked > 0) ? `<span class="meter-blocked">(${Math.round(entry.blocked)})</span>` : ''}
                </div>
            `;

            let tooltip = `${entry.name}\nTotal: ${Math.round(value || 0)}`;
            if (entry.blocked > 0) tooltip += `\nBlocked: ${Math.round(entry.blocked)}`;
            row.title = tooltip;

            container.appendChild(row);
        });
    }
}

export const uiManager = new UIManager();