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
            nextLevelBtn: document.getElementById('next-level-btn')
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
        bus.on('FIGHT_RESULT', (result) => this.handleFightResult(result));
    }

    setupGlobalListeners() {
        this.elements.startFightBtn.onclick = () => bus.emit('UI_REQUEST_START_FIGHT');
        this.elements.nextLevelBtn.onclick = () => this.startNextLevel();
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
    }

    updateStats() {
        if (this.elements.levelDisplay) this.elements.levelDisplay.innerText = gameState.level;
        if (this.elements.goldDisplay) this.elements.goldDisplay.innerText = gameState.gold;
    }

    handleFightResult(result) {
        if (result === 'VICTORY') {
            this.openShop();
        } else {
            alert("DEFEAT! Try again.");
            gameState.reset();
        }
    }

    openShop() {
        this.populateShop();
        this.elements.shopOverlay.classList.remove('hidden');
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
            el.onclick = () => this.handleBuy(item);
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
            } else {
                alert("Stash is full!");
            }
        } else {
            alert("Not enough gold!");
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

        let tooltip = item.description || item.name;
        if (item.type === 'sword') {
            const effectiveCooldown = item.cooldown / (1 + buffs.speedBonus);
            const attackSpeedDisplay = Number((effectiveCooldown / 1000).toFixed(2));
            
            const effectiveCritChance = item.critChance + buffs.critChance;
            tooltip = `Damage: ${item.damage}\nKrit (%): ${Math.round(effectiveCritChance * 100)}\nAttackspeed: ${attackSpeedDisplay}`;
        }
        div.title = tooltip;

        div.innerHTML = `
            ${item.icon}
            <div class="item-name">${item.name}</div>
            <div class="cooldown-overlay"></div>
        `;
        return div;
    }

    updateHealthUI() {
        const playerPct = (gameState.player.hp / gameState.player.maxHp) * 100;
        this.elements.playerHpBar.style.width = `${playerPct}%`;
        this.elements.playerHpText.innerText = `${Math.ceil(gameState.player.hp)}`;

        const enemyPct = (gameState.enemy.hp / gameState.enemy.maxHp) * 100;
        this.elements.enemyHpBar.style.width = `${enemyPct}%`;
        this.elements.enemyHpText.innerText = `${Math.ceil(gameState.enemy.hp)}`;
    }

    update() {
        // Cooldown overlays
        const drawOverlay = (container, type) => {
            // Recalculate buffs locally or get from somewhere. 
            // Ideally we cache buffs or pass them.
            // For simplicity re-calc.
            // Wait, visuals for enemy slots should use enemy buffs?
            // Original code used player buffs (activeSlots) for logic but what about overlay?
            // Original code:
            // drawOverlay calculated buffs locally:
            // "slots.forEach(item => ... if item.name == Gloves ...)"
            // It only checked Gloves (speed bonus).
            
            // I will just use BuffSystem for the specific container
            const arr = gameState.getArray(type);
            const buffs = BuffSystem.calculateBuffs(arr);

            Array.from(container.children).forEach((slotEl, index) => {
                const item = arr[index];
                if (item) {
                    const overlay = slotEl.querySelector('.cooldown-overlay');
                    if (overlay && item.cooldown > 0) {
                        let maxCd = item.cooldown;
                        if (item.type === 'sword') maxCd = item.cooldown / (1 + buffs.speedBonus);
                        
                        const pct = (item.currentCooldown / maxCd) * 100;
                        overlay.style.height = `${pct}%`;
                    } else if (overlay) {
                         overlay.style.height = '0%';
                    }
                }
            });
        };

        drawOverlay(this.elements.activeSlots, 'active');
        drawOverlay(this.elements.enemySlots, 'enemy');
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
