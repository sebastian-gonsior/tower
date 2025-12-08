import { gameState } from '../state/GameState.js';
import { ItemFactory } from '../models/ItemFactory.js';
import { bus } from '../utils/EventBus.js';

export class InventorySystem {
    constructor() {
        this.initStarterItems();
        this.setupListeners();
    }

    setupListeners() {
        bus.on('UI_REQUEST_MOVE_ITEM', (data) => {
            this.moveItem(data.sourceType, data.sourceIndex, data.targetType, data.targetIndex);
        });
    }

    initStarterItems() {
        const stash = gameState.stashSlots;
        
        stash[0] = ItemFactory.createSword();
        stash[9] = ItemFactory.createSword();
        
        stash[1] = ItemFactory.createWhetstone();
        stash[3] = ItemFactory.createWhetstone();
        stash[4] = ItemFactory.createWhetstone();
        
        stash[2] = ItemFactory.createGloves();
        stash[10] = ItemFactory.createGloves();
        stash[11] = ItemFactory.createGloves();

        stash[5] = ItemFactory.createLuckyCharm();
        stash[6] = ItemFactory.createLuckyCharm();
        stash[7] = ItemFactory.createLuckyCharm();
        stash[8] = ItemFactory.createLuckyCharm();
        
        // No need to emit here if we do this before UI init, but for safety:
        // We are directly mutating the array here which is accessible via reference.
        // Ideally we use gameState methods, but initial setup is fine.
    }

    moveItem(sourceType, sourceIndex, targetType, targetIndex) {
        if (sourceType === targetType && sourceIndex === targetIndex) return;

        const sourceArray = gameState.getArray(sourceType);
        const targetArray = gameState.getArray(targetType);

        if (!sourceArray || !targetArray) return;

        const item = sourceArray[sourceIndex];
        if (!item) return;

        const targetItem = targetArray[targetIndex];

        // Swap in state
        gameState.updateSlot(targetType, targetIndex, item);
        gameState.updateSlot(sourceType, sourceIndex, targetItem);
    }

    returnAllItemsToStash() {
        this.returnItemsFromSource(gameState.activeSlots, 'active');
        this.returnItemsFromSource(gameState.enemySlots, 'enemy');
    }

    returnItemsFromSource(sourceArray, sourceType) {
        sourceArray.forEach((item, index) => {
            if (item) {
                const stashIndex = gameState.stashSlots.findIndex(s => s === null);
                if (stashIndex !== -1) {
                    gameState.updateSlot('stash', stashIndex, item);
                    gameState.updateSlot(sourceType, index, null);
                } else {
                    console.warn(`Stash full! Could not uneven equip ${item.name}`);
                }
            }
        });
    }
}

export const inventorySystem = new InventorySystem();
