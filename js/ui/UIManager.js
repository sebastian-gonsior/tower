import { gameState } from '../state/GameState.js';
import { BuffSystem } from '../systems/BuffSystem.js';
import { bus } from '../utils/EventBus.js';
import { GAME_CONFIG } from '../config.js';
import { ItemFactory } from '../models/ItemFactory.js';

export class UIManager {
    constructor() {
        this.elements = {
            activeSlots: document.getElementById('active-slots'),
            enemySlots: document.getElementById('enemy-slots'),
            stashSlots: document.getElementById('stash-slots'),
            playerHpBar: document.getElementById('player-hp-bar'),
            playerHpText: document.getElementById('player-hp-text'),
            enemyHpBar: document.getElementById('enemy-hp-bar'),
            enemyHpText: document.getElementById('enemy-hp-text'),
            startFightBtn: document.getElementById('start-fight-btn'),
            levelDisplay: document.getElementById('level-display'),
            goldDisplay: document.getElementById('gold-display'),
            shopOverlay: document.getElementById('shop-overlay'),
            shopItems: document.getElementById('shop-items'),
            nextLevelBtn: document.getElementById('next-level-btn'),
            playerNameDisplay: document.getElementById('player-name-display'),
            enemyNameDisplay: document.getElementById('enemy-name-display'),
            livesDisplay: document.getElementById('lives-display'),
            shopGoldDisplay: document.getElementById('shop-gold-display')
        };
        
        this.init();
    }

    init() {
        this.generateSlots();
        this.setupGlobalListeners();
        this.setupEventBusListeners();
        this.render();
    }

    setupEventBusListeners() {
        bus.on('SLOTS_UPDATED', () => this.renderSlots());
        bus.on('HP_UPDATED', () => this.updateHealthUI());
        bus.on('DAMAGE_DEALT', (data) => this.showFloatingText(data));
        bus.on('FIGHT_STATUS_CHANGED', (isActive) => {
            this.elements.startFightBtn.style.display = isActive ? 'none' : 'inline-block';
            this.elements.startFightBtn.disabled = isActive;
        });
        bus.on('STATE_RESET', () => {
             this.render();
             this.elements.startFightBtn.style.display = 'inline-block';
             this.elements.startFightBtn.disabled = false;
        });
        bus.on('GOLD_UPDATED', () => this.updateStats());
        bus.on('LEVEL_UPDATED', () => this.updateStats());
        bus.on('LIVES_UPDATED', () => this.updateStats());
        bus.on('FIGHT_RESULT', (result) => this.handleFightResult(result));
        bus.on('PLAYER_READY', () => {
            this.updatePlayerName();
            this.openShop(true);
        });
    }

    setupGlobalListeners() {
        this.elements.startFightBtn.onclick = () => bus.emit('UI_REQUEST_START_FIGHT');
    }

    generateSlots() {
        const createSlots = (container, count, type) => {
            container.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const slot = document.createElement('div');
                slot.className = 'slot';
                slot.dataset.type = type;
                slot.dataset.index = i;
                
                slot.ondragover = (e) => this.handleDragOver(e);
                slot.ondragleave = (e) => this.handleDragLeave(e);
                slot.ondrop = (e) => this.handleDrop(e, type, i);
                
                container.appendChild(slot);
            }
        };

        createSlots(this.elements.activeSlots, GAME_CONFIG.slotsCount, 'active');
        createSlots(this.elements.enemySlots, GAME_CONFIG.slotsCount, 'enemy');
        createSlots(this.elements.stashSlots, GAME_CONFIG.stashCount, 'stash');
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

    handleFightResult(result) {
        if (result === 'VICTORY') {
            this.openShop(false);
        } else {
            gameState.removeLife();
            if (gameState.lives > 0) {
                alert(`DEFEAT! You received 100g. Lives remaining: ${gameState.lives}. Try again.`);
                gameState.reset();
                this.openShop(true);
            } else {
                alert("GAME OVER! You ran out of lives.");
                location.reload();
            }
        }
    }

    openShop(isStart = false) {
        this.populateShop();
        this.elements.shopOverlay.classList.remove('hidden');
        
        if (isStart) {
            this.elements.nextLevelBtn.innerText = "Ready to Fight";
            this.elements.nextLevelBtn.onclick = () => this.closeShop();
        } else {
            this.elements.nextLevelBtn.innerText = "Start Next Level";
            this.elements.nextLevelBtn.onclick = () => this.startNextLevel();
        }
    }

    closeShop() {
        this.elements.shopOverlay.classList.add('hidden');
    }

    populateShop() {
        this.elements.shopItems.innerHTML = '';
        
        // Items to sell.
        const items = [
            ItemFactory.createSword(),
            ItemFactory.createWhetstone(),
            ItemFactory.createGloves(),
            ItemFactory.createLuckyCharm()
        ];

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'shop-item';
            el.innerHTML = `
                <div style="font-size: 24px;">${item.icon}</div>
                <div style="font-size: 10px;">${item.name}</div>
                <div class="shop-item-price">${item.price}g</div>
            `;
            el.title = item.description || item.name;
            el.onclick = () => {
                if (this.handleBuy(item)) {
                    el.remove();
                }
            };
            this.elements.shopItems.appendChild(el);
        });
    }

    handleBuy(templateItem) {
        if (gameState.gold >= templateItem.price) {
            // Check stash space
            const stashIndex = gameState.stashSlots.findIndex(s => s === null);
            if (stashIndex !== -1) {
                // Deduct gold
                gameState.addGold(-templateItem.price);
                
                // Create a NEW item instance because templateItem might be reused if I didn't create fresh ones above.
                // In populateShop I called createSword() etc, so 'item' is a fresh instance. 
                // BUT if I buy it, I use it. If I buy IT AGAIN, I need another fresh instance.
                // So 'templateItem' is just for info. I need to recreate.
                
                let newItem;
                if (templateItem.name === "Sword") newItem = ItemFactory.createSword();
                else if (templateItem.name === "Whetstone") newItem = ItemFactory.createWhetstone();
                else if (templateItem.name === "Gloves") newItem = ItemFactory.createGloves();
                else if (templateItem.name === "Lucky Charm") newItem = ItemFactory.createLuckyCharm();
                
                gameState.updateSlot('stash', stashIndex, newItem);
                return true;
            } else {
                alert("Stash is full!");
                return false;
            }
        } else {
            alert("Not enough gold!");
            return false;
        }
    }

    startNextLevel() {
        this.closeShop();
        gameState.nextLevel();
        gameState.reset();
    }

    renderSlots() {
        const buffs = BuffSystem.calculateBuffs(gameState.activeSlots);
        
        const renderContainer = (container, type) => {
             Array.from(container.children).forEach((slot, index) => {
                 const item = gameState.getArray(type)[index];
                 slot.innerHTML = '';
                 // Clear drag events from slot to prevent dupes? No, they are static on slot.
                 
                 if (item) {
                     const itemEl = this.createItemElement(item, buffs);
                     itemEl.draggable = true;
                     itemEl.ondragstart = (e) => this.handleDragStart(e, type, index);
                     slot.appendChild(itemEl);
                 }
             });
        };

        renderContainer(this.elements.activeSlots, 'active');
        renderContainer(this.elements.enemySlots, 'enemy');
        renderContainer(this.elements.stashSlots, 'stash');
    }

    createItemElement(item, buffs) {
        const div = document.createElement('div');
        div.className = 'item';

        div.title = this.generateTooltip(item, buffs);

        div.innerHTML = `
            ${item.icon}
            <div class="item-name">${item.name}</div>
            <div class="cooldown-overlay"></div>
        `;
        return div;
    }

    generateTooltip(item, buffs) {
        if (item.type === 'sword') {
            const effectiveCooldown = item.cooldown / (1 + buffs.speedBonus);
            const attackSpeedDisplay = Number((effectiveCooldown / 1000).toFixed(2));
            
            const effectiveCritChance = item.critChance + buffs.critChance;
            return `Damage: ${item.damage}\nKrit (%): ${Math.round(effectiveCritChance * 100)}\nAttackspeed: ${attackSpeedDisplay}`;
        }
        return item.description || item.name;
    }

    updateHealthUI() {
        const playerPct = (gameState.player.hp / gameState.player.maxHp) * 100;
        this.elements.playerHpBar.style.width = `${playerPct}%`;
        
        let playerText = `${Math.ceil(gameState.player.hp)}`;
        if (gameState.player.shield > 0) {
            playerText += ` (+${Math.ceil(gameState.player.shield)} Shield)`;
        }
        this.elements.playerHpText.innerText = playerText;

        const enemyPct = (gameState.enemy.hp / gameState.enemy.maxHp) * 100;
        this.elements.enemyHpBar.style.width = `${enemyPct}%`;
        
        let enemyText = `${Math.ceil(gameState.enemy.hp)}`;
        if (gameState.enemy.shield > 0) {
            enemyText += ` (+${Math.ceil(gameState.enemy.shield)} Shield)`;
        }
        this.elements.enemyHpText.innerText = enemyText;
    }

    update() {
        // Calculate buffs including stacking speed from combat state
        const playerBuffs = BuffSystem.calculateBuffs(gameState.activeSlots);
        playerBuffs.speedBonus += (gameState.combatState.playerStackingSpeed || 0);
        playerBuffs.critChance += (gameState.combatState.playerStackingCrit || 0);

        const enemyBuffs = BuffSystem.calculateBuffs(gameState.enemySlots);
        enemyBuffs.speedBonus += (gameState.combatState.enemyStackingSpeed || 0);
        enemyBuffs.critChance += (gameState.combatState.enemyStackingCrit || 0);

        this.updateSlotVisuals(this.elements.activeSlots, 'active', playerBuffs);
        this.updateSlotVisuals(this.elements.enemySlots, 'enemy', enemyBuffs);
    }

    updateSlotVisuals(container, type, buffs) {
        const arr = gameState.getArray(type);
        Array.from(container.children).forEach((slotEl, index) => {
            const item = arr[index];
            if (item) {
                // Update Overlay
                const overlay = slotEl.querySelector('.cooldown-overlay');
                if (overlay) {
                    if (item.cooldown > 0) {
                        let maxCd = item.cooldown;
                        // Apply speed bonus to swords and shields
                        if (item.type === 'sword' || item.type === 'shield') {
                            maxCd = item.cooldown / (1 + buffs.speedBonus);
                        }
                        
                        const pct = maxCd > 0 ? (item.currentCooldown / maxCd) * 100 : 0;
                        overlay.style.height = `${pct}%`;
                    } else {
                        overlay.style.height = '0%';
                    }
                }

                // Update Tooltip
                const itemEl = slotEl.querySelector('.item');
                if (itemEl) {
                    itemEl.title = this.generateTooltip(item, buffs);
                }
            }
        });
    }

    handleDragStart(e, type, index) {
        if (gameState.isFightActive) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', JSON.stringify({ type, index }));
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e, targetType, targetIndex) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        if (gameState.isFightActive) return;

        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;
        
        try {
            const source = JSON.parse(data);
            bus.emit('UI_REQUEST_MOVE_ITEM', {
                sourceType: source.type,
                sourceIndex: source.index,
                targetType,
                targetIndex
            });
        } catch (err) {
            console.error("Drag Drop Error:", err);
        }
    }

    showFloatingText({ target, damage, isCrit }) {
        const selector = target === 'player' ? '.player-sprite' : '.enemy-sprite';
        const targetElement = document.querySelector(selector);
        
        if (!targetElement) return;

        const rect = targetElement.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top;

        const el = document.createElement('div');
        el.className = `floating-text ${isCrit ? 'crit-text' : 'damage-text'}`;
        el.innerText = `-${damage}${isCrit ? '!' : ''}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.transform = `translateX(${Math.random() * 40 - 20}px)`;

        document.body.appendChild(el);

        setTimeout(() => {
            el.remove();
        }, 5000); // CSS animation might differ but 5s safe
    }
}

export const uiManager = new UIManager();
