import { Item } from './Item.js';
import { dataManager } from '../managers/DataManager.js';

/**
 * ItemFactory - Creates item instances from templates.
 * 
 * Star Level System:
 * - Items can be created with a specific star level (0-10)
 * - 3 identical items (same templateId + starLevel) can be fused into a higher star item
 * - Each star level applies manual bonuses from the template
 */
export class ItemFactory {
    /**
     * Create an item from a template ID.
     * @param {string} id - The template ID from items.json
     * @param {number} starLevel - Star level (0-10), default 0
     * @returns {Item|null} The created item or null if template not found
     */
    static createItem(id, starLevel = 0) {
        const template = dataManager.getItemTemplate(id);
        if (!template) {
            console.error(`Item template not found: ${id}`);
            return null;
        }
        return new Item(template, starLevel);
    }

    /**
     * Create an upgraded (fused) item from an existing item.
     * Used when 3 identical items are combined.
     * @param {Item} sourceItem - The source item to upgrade
     * @returns {Item|null} A new item with starLevel + 1
     */
    static createUpgradedItem(sourceItem) {
        if (!sourceItem || sourceItem.starLevel >= 10) {
            console.warn("Cannot upgrade item: max star level reached or invalid item");
            return null;
        }
        return this.createItem(sourceItem.templateId, sourceItem.starLevel + 1);
    }
}
