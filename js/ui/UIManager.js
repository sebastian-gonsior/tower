import { gameState, PHASES, GAME_CONFIG } from '../state/GameState.js';
import { bus } from '../utils/EventBus.js';
import { BuffSystem } from '../systems/BuffSystem.js';

export class UIManager {
    constructor() {
        this.elements = {
            // Screens
            screenWelcome: document.getElementById('screen-welcome'),
            screenShop: document.getElementById('screen-shop'),
            screenCombat: document.getElementById('screen-combat'),

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
            enemyBuffs: document.getElementById('enemy-buffs'),

            // Sprites
            playerSprite: document.querySelector('.player-sprite'),
            enemySprite: document.querySelector('.enemy-sprite'),

            // Tooltip
            itemTooltip: document.getElementById('item-tooltip'),

            // Panels for state effects
            playerPanel: document.querySelector('.player-panel'),
            enemyPanel: document.querySelector('.enemy-panel')
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

        // Boss Intro -> Equip Phase (Fight)
        if (this.elements.proceedToEquipBtn) {
            this.elements.proceedToEquipBtn.onclick = () => gameState.startEquipPhase();
        }

        if (this.elements.startFightBtn) {
            this.elements.startFightBtn.onclick = () => bus.emit('UI_REQUEST_START_FIGHT');
        }

        if (this.elements.backToShopBtn) {
            this.elements.backToShopBtn.onclick = () => {
                // Return to shop
                gameState.setPhase(PHASES.SHOPPING);
            };
        }

        // Add Alt key listener for tooltip preview
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Alt') {
                // console.log('Alt key pressed');
                e.preventDefault(); // Prevent menu focus
                this.isAltPressed = true;
                if (this.elements.itemTooltip && !this.elements.itemTooltip.classList.contains('hidden') && this.currentTooltipArgs) {
                    // console.log('Refreshing tooltip for preview...');
                    this.showTooltip(...this.currentTooltipArgs);
                }
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Alt') {
                // console.log('Alt key released');
                this.isAltPressed = false;
                if (this.elements.itemTooltip && !this.elements.itemTooltip.classList.contains('hidden') && this.currentTooltipArgs) {
                    this.showTooltip(...this.currentTooltipArgs);
                }
            }
        });
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
        bus.on('ITEM_FUSED', (data) => this.showFusionNotification(data));
        bus.on('FIGHT_VICTORY', () => {
            this.showNotification("VICTORY!", "gold");
        });
        bus.on('FIGHT_DEFEAT', () => {
            this.showNotification("DEFEAT!", "red");
        });
    }

    handlePhaseChange(phase) {
        if (phase === PHASES.SHOPPING) {
            this.showScreen('screen-shop');
            this.updateShopUI();
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
    }

    updatePlayerName() {
        if (this.elements.playerNameDisplay) {
            this.elements.playerNameDisplay.innerText = gameState.playerName || 'Hero';
        }
    }

    updateEnemyName() {
        if (this.elements.enemyNameDisplay) {
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

                // itemDiv.title = `${item.getDisplayName()}\n${item.description}`; // Remove native tooltip

                // Tooltip Events
                itemDiv.addEventListener('mouseenter', (e) => this.showTooltip(item, e.clientX, e.clientY));
                itemDiv.addEventListener('mouseleave', () => this.hideTooltip());
                itemDiv.addEventListener('mousemove', (e) => this.updateTooltipPosition(e.clientX, e.clientY));

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
                renderSlot(slotDiv, items[index]);
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

            el.innerHTML = `
                <div class="item-stars">${'★'.repeat(item.starLevel)}</div>
                <div class="item-icon">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-rarity rarity-text-${item.rarity}">${item.rarity.toUpperCase()}</div>
                <div class="shop-item-price">${item.price}g</div>
            `;

            // el.title = `${item.name} (${item.rarity})`; // Remove native tooltip

            // Tooltip Events
            el.addEventListener('mouseenter', (e) => {
                // console.log('mouseenter item', item);
                this.showTooltip(item, e.clientX, e.clientY);
            });
            el.addEventListener('mouseleave', () => this.hideTooltip());
            el.addEventListener('mousemove', (e) => {
                this.updateTooltipPosition(e.clientX, e.clientY);
            });

            el.onclick = () => {
                this.hideTooltip(); // Close tooltip on click
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
        const renderPreviewSlots = (container, items, maxSlots) => {
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
                    // itemDiv.title = `${item.name} (${item.rarity})`;

                    // Tooltip Events
                    itemDiv.addEventListener('mouseenter', (e) => this.showTooltip(item, e.clientX, e.clientY));
                    itemDiv.addEventListener('mouseleave', () => this.hideTooltip());
                    itemDiv.addEventListener('mousemove', (e) => this.updateTooltipPosition(e.clientX, e.clientY));

                    slot.appendChild(itemDiv);
                }

                container.appendChild(slot);
            }
        };

        renderPreviewSlots(this.elements.shopActivePreview, gameState.activeSlots, GAME_CONFIG.slotsCount);
        renderPreviewSlots(this.elements.shopStashPreview, gameState.stashSlots, GAME_CONFIG.stashCount);
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
                    e.preventDefault();
                    slot.classList.add('drag-over');
                });
                slot.addEventListener('dragleave', () => {
                    slot.classList.remove('drag-over');
                });
                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    slot.classList.remove('drag-over');
                    const textData = e.dataTransfer.getData('text/plain');
                    if (textData) {
                        const fromIndex = parseInt(textData);
                        // This part needs the source type, which we'd need to store in dataTransfer in a richer way or global state
                        // For simplicity, we rely on click for now or add proper D&D later
                        // Reverting to click-based movement as primary
                    }
                });

                container.appendChild(slot);
            }
        };

        createSlots(this.elements.activeSlots, GAME_CONFIG.slotsCount, 'active');
        createSlots(this.elements.enemySlots, GAME_CONFIG.slotsCount, 'enemy');
        createSlots(this.elements.stashSlots, GAME_CONFIG.stashCount, 'stash');
    }

    handleSlotClick(type, index) {
        this.hideTooltip(); // Close tooltip on click

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
        }
    }

    showFloatingText(data) {
        // data: { target, damage, amount, type, isCrit, critType, sourceType, debuffType }
        const { target, damage, amount, type, isCrit, critType, sourceType, debuffType } = data;

        let text = '';
        let colorClass = '';
        let sideClass = 'damage'; // Default to damage side

        const val = amount || damage;
        if (type === 'heal' || amount !== undefined || (isCrit && critType === 'gold')) {
            text = (type === 'heal' || amount !== undefined) ? `+${val}` : `${val}`;
            colorClass = (isCrit && critType === 'gold') ? 'gold-text' : 'heal-text';
            sideClass = 'gain';
        } else {
            text = `-${val}`;
            colorClass = 'damage-text';
            sideClass = 'damage';
        }

        if (isCrit) {
            const hasPlus = String(val).startsWith('+');
            text = (sideClass === 'gain' && !hasPlus) ? `+${val}!` : `${val}!`;
            if (critType !== 'gold') colorClass = 'crit-text';
        }

        if (sourceType === 'debuff') {
            colorClass = `debuff-text-${debuffType}`;
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
            critDmg: '💢'
        };

        const renderBuffContainer = (container, slots) => {
            if (!container) return;
            container.innerHTML = '';
            const buffs = BuffSystem.calculateBuffs(slots);

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
                            const count = buffs.multihitCount || 0;
                            displayValue = `${Math.round(value * 100)}% x${count}`;
                            title = `Global Multihit: ${Math.round(value * 100)}% chance for x${count} hits`;
                        } else if (key === 'critDmg') {
                            displayValue = `x${value.toFixed(1)}`;
                            title = `Crit Damage: ${displayValue}`;
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
    }

    // --- Tooltip Logic ---

    showTooltip(item, x, y) {
        // Retry fetch if missing
        if (!this.elements.itemTooltip) {
            this.elements.itemTooltip = document.getElementById('item-tooltip');
        }

        if (!item || !this.elements.itemTooltip) {
            console.warn('Tooltip missing elements:', { item, el: this.elements.itemTooltip });
            return;
        }

        // Store args for refresh
        this.currentTooltipArgs = [item, x, y];

        let displayItem = item;
        let isPreview = false;

        // Handle Preview Mode (Alt Key)
        if (this.isAltPressed && item.starLevel < 10) {
            // console.log('Attempting preview for:', item.name, 'Level:', item.starLevel);
            if (typeof item.getPreview === 'function') {
                const previewData = item.getPreview(item.starLevel + 1);
                // console.log('Preview Data:', previewData);
                if (previewData) {
                    // Create a temporary object for display
                    displayItem = {
                        ...item,
                        starLevel: previewData.starLevel,
                        stats: previewData.stats,
                        effects: previewData.effects,
                        // Keep other props
                        rarity: item.rarity,
                        icon: item.icon,
                        name: item.name,
                        type: item.type,
                        subtype: item.subtype,
                        price: item.price
                    };
                    isPreview = true;
                }
            } else {
                console.warn('Item missing getPreview method:', item);
            }
        }

        const el = this.elements.itemTooltip;
        el.className = `item-tooltip rarity-${displayItem.rarity}`; // Reset classes

        // Format Stats
        let statsHtml = '';
        if (displayItem.stats) {
            statsHtml += '<div class="tooltip-stats">';
            for (const [key, value] of Object.entries(displayItem.stats)) {
                // Format key (e.g., "attackSpeed" -> "Attack Speed")
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                statsHtml += `
                    <div class="stat-row">
                        <span class="stat-label">${label}</span>
                        <span class="stat-value">${value}</span>
                    </div>`;
            }
            statsHtml += '</div>';
        }

        // Format Effects
        let effectsHtml = '';
        if (displayItem.effects) {
            effectsHtml += '<div class="tooltip-effects">';
            for (const [type, data] of Object.entries(displayItem.effects)) {
                let text = '';
                const chance = data.chance !== undefined ? data.chance : 1.0;
                // Always show chance for consistency if requested, or at least handle it better
                // User complaint: "gold dagger show no chance" implies they want to see it.
                // Let's show it if it's explicitly defined in the data or just always.
                // Simplest interpretation of "show no chance" when it HAS chance 1.0 is they want to see "100%"
                const chanceText = ` <span style="color:#aaa">(${Math.round(chance * 100)}%)</span>`;

                if (type === 'goldOnHit') text = `+${data.amount || 1} Gold on Hit${chanceText}`;
                else if (type === 'lifesteal') {
                    const factor = data.factor !== undefined ? data.factor : 1.0;
                    text = `Lifesteal: ${Math.round(factor * 100)}% of Dmg${chanceText}`;
                }
                else if (type === 'poison') text = `Poison: ${data.damagePerTick} dmg (${data.duration}s)${chanceText}`;
                else if (type === 'bleed') text = `Bleed: ${data.damagePerTick} dmg (${data.duration}s)${chanceText}`;
                else if (type === 'fire') text = `Burn: ${data.damagePerTick} dmg (${data.duration}s)${chanceText}`;
                else if (type === 'shadow') text = `Shadow: ${data.damagePerTick} dmg (${data.duration}s)${chanceText}`;
                else if (type === 'curse') text = `Curse: ${data.damagePerTick} dmg (${data.duration}s)${chanceText}`;
                else if (type === 'frozen') text = `Freeze Chance (${Math.round((data.chance || 1) * 100)}%)`;
                else if (type === 'holy') text = `Heal Chance (${Math.round((data.chance || 1) * 100)}%)`;
                else if (type === 'multihit') text = `Multihit: x${data.count}${chanceText}`;
                else {
                    // Start with basic Name
                    text = `${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} Effect`;

                    // Add details if available
                    const details = [];
                    if (data.amount) details.push(`Amount: ${data.amount}`);
                    if (data.damagePerTick) details.push(`Dmg: ${data.damagePerTick}`);
                    if (data.duration) details.push(`Dur: ${data.duration}s`);
                    if (data.factor) details.push(`Factor: ${data.factor}`);
                    if (data.count) details.push(`Count: ${data.count}`);

                    if (details.length > 0) {
                        text += ` [${details.join(', ')}]`;
                    }
                    text += chanceText;
                }

                effectsHtml += `
                    <div class="effect-row">
                        <span class="effect-bullet">✦</span>
                        <span>${text}</span>
                    </div>`;
            }
            effectsHtml += '</div>';
        }

        el.innerHTML = `
            ${isPreview ? '<div style="background: #4caf50; color: white; text-align: center; padding: 2px; border-radius: 4px; font-weight: bold; margin-bottom: 5px;">>>> NEXT LEVEL >>></div>' : ''}
            <div class="tooltip-header">
                <div class="tooltip-icon">${displayItem.icon}</div>
                <div class="tooltip-title">
                    <span class="tooltip-name">${displayItem.name}</span>
                    <span class="tooltip-rarity rarity-text-${displayItem.rarity}">${displayItem.rarity}</span>
                    <div class="tooltip-type">${displayItem.type} ${displayItem.subtype ? `- ${displayItem.subtype}` : ''}</div>
                </div>
            </div>
            ${statsHtml}
            ${effectsHtml}
            ${displayItem.price ? `<div class="tooltip-price">Value: ${displayItem.price}g</div>` : ''}
        `;

        // Show and Position
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
}

export const uiManager = new UIManager();