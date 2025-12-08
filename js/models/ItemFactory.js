import { Item } from './Item.js';

export class ItemFactory {
    static createSword() {
        return new Item("Sword", "⚔️", 25, 3000, 'sword', 0.1, 100);
    }
    
    static createWhetstone() {
        const item = new Item("Whetstone", "🪨", 0, 0, 'accessory', 0, 50);
        item.description = "Swords Crit Dmg -> 250%";
        return item;
    }

    static createGloves() {
        const item = new Item("Gloves", "🧤", 0, 0, 'accessory', 0, 50);
        item.description = "Swords Attack Speed +80%";
        return item;
    }

    static createLuckyCharm() {
        const item = new Item("Lucky Charm", "🍀", 0, 0, 'accessory', 0, 50);
        item.description = "Swords Crit Chance +25%";
        return item;
    }
}
