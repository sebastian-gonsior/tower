import { gameState } from '../state/GameState.js';
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
        // Stash starts empty as requested
    }

    moveItem(sourceType, sourceIndex, targetType, targetIndex) {
        if (sourceType === targetType && sourceIndex === targetIndex) return;

        // Prevent moving items from/to enemy slots (Boss items are restricted)
        if (sourceType === 'enemy' || targetType === 'enemy') {
            console.warn("Interaction with enemy items is restricted.");
            return;
        }

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
