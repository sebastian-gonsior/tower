export class DataManager {
    constructor() {
        this.items = new Map();
        this.bosses = [];
        this.loaded = false;
    }

    async loadData() {
        try {
            console.log("Loading data...");
            const itemsResp = await fetch('data/items.json');
            const items = await itemsResp.json();
            items.forEach(item => this.items.set(item.id, item));

            const bossesResp = await fetch('data/bosses.json');
            this.bosses = await bossesResp.json();

            this.loaded = true;
            this.loaded = true;
            console.log(`Data loaded: ${this.items.size} items, ${this.bosses.length} bosses`);
            if (this.bosses.length > 0) {
                console.log("[DEBUG] First Loaded Boss:", this.bosses[0]);
            } else {
                console.error("[DEBUG] NO BOSSES LOADED!");
            }
            return true;
        } catch (e) {
            console.error("Failed to load data", e);
            return false;
        }
    }

    getItemTemplate(id) {
        return this.items.get(id);
    }

    getBoss(level) {
        return this.bosses.find(b => b.level === level);
    }

    getAllItems() {
        return Array.from(this.items.values());
    }

    getItemsByRarity(rarity) {
        return this.getAllItems().filter(i => i.rarity === rarity);
    }
}

export const dataManager = new DataManager();
