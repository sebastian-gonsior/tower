/**
 * GAME_CONSTANTS.js - Centralized configuration values
 * 
 * All magic numbers and configurable values should be defined here
 * to improve maintainability and enable easy balancing.
 */

// =============================================================================
// COMBAT SETTINGS
// =============================================================================

/** Duration of combat timer in seconds */
export const COMBAT_TIMER_SECONDS = 180;

/** Attack speed slow per frozen stack (5% = 0.05) */
export const FROZEN_SLOW_PER_STACK = 0.05;

/** Maximum attack speed slow from frozen (95% = 0.95) */
export const FROZEN_MAX_SLOW = 0.95;

/** Stacks required to trigger full freeze */
export const FROZEN_SHATTER_THRESHOLD = 10;

/** Duration of full freeze in milliseconds */
export const FROZEN_SHATTER_DURATION_MS = 1000;

/** Maximum block damage reduction (90% = 0.9) */
export const MAX_BLOCK_REDUCTION = 0.9;

// =============================================================================
// CRIT SETTINGS
// =============================================================================

/** Base crit damage multiplier */
export const CRIT_BASE_MULTIPLIER = 2;

/** SuperCrit damage multiplier */
export const SUPER_CRIT_MULTIPLIER = 3;

/** HyperCrit damage multiplier */
export const HYPER_CRIT_MULTIPLIER = 5;

/** Chance for crit to upgrade to SuperCrit */
export const SUPER_CRIT_CHANCE = 0.2;

/** Chance for SuperCrit to upgrade to HyperCrit */
export const HYPER_CRIT_CHANCE = 0.2;

// =============================================================================
// ECONOMY SETTINGS
// =============================================================================

/** Gold reward for victory */
export const WIN_GOLD_REWARD = 100;

/** Gold consolation for defeat */
export const LOSS_GOLD_CONSOLATION = 50;

/** Income blessing bonus gold */
export const INCOME_BLESSING_BONUS = 25;

/** Base cost to reroll shop */
export const REROLL_BASE_COST = 5;

/** Cost increase per reroll */
export const REROLL_COST_INCREMENT = 10;

/** Sell item return percentage (80% = 0.8) */
export const SELL_RETURN_PERCENTAGE = 0.8;

// =============================================================================
// PLAYER SETTINGS
// =============================================================================

/** Starting gold amount */
export const STARTING_GOLD = 100;

/** Starting lives */
export const STARTING_LIVES = 3;

/** Starting player max HP */
export const PLAYER_STARTING_MAX_HP = 1000;

// =============================================================================
// ITEM SETTINGS
// =============================================================================

/** Maximum star level for items */
export const MAX_STAR_LEVEL = 10;

/** Items required for fusion */
export const FUSION_REQUIRED_COUNT = 3;

/** Stat multiplier per star level (2 = doubling) */
export const STAR_STAT_MULTIPLIER_BASE = 2;

// =============================================================================
// SLOT COUNTS
// =============================================================================

/** Number of active item slots */
export const ACTIVE_SLOTS_COUNT = 6;

/** Number of stash slots */
export const STASH_SLOTS_COUNT = 24;

/** Number of shop item slots */
export const SHOP_SLOTS_COUNT = 6;

// =============================================================================
// DEBUFF DURATIONS (in seconds)
// =============================================================================

export const DEBUFF_DURATIONS = {
    bleed: 10,
    poison: 15,
    fire: 5,
    shadow: 10,
    curse: 20,
    frozen: 5
};

/** Default tick interval for DoT effects (milliseconds) */
export const DEFAULT_TICK_INTERVAL_MS = 1000;

/** Fast tick interval for set bonus (milliseconds) */
export const FAST_TICK_INTERVAL_MS = 500;

// =============================================================================
// UI SETTINGS
// =============================================================================

/** Floating text display duration (milliseconds) */
export const FLOATING_TEXT_DURATION_MS = 1200;

/** Notification display duration (milliseconds) */
export const NOTIFICATION_DURATION_MS = 2000;

/** Fusion notification duration (milliseconds) */
export const FUSION_NOTIFICATION_DURATION_MS = 2500;

/** Victory/Defeat delay before phase change (milliseconds) */
export const RESULT_DELAY_MS = 2000;

/** Chance for all shop items to be star level 1 (1% = 0.01) */
export const LUCKY_ROLL_CHANCE = 0.01;

/** Chance for each shop slot to be a Star Shard (1% = 0.01) */
export const STAR_SHARD_CHANCE = 0.01;

/** Chance for each shop slot to be a Fortune Coin (5% = 0.05) */
export const FREE_REROLLS_ITEM_CHANCE = 0.05;

/** Number of free rerolls granted by a Fortune Coin */
export const REROLLS_PER_TOKEN = 4;

// =============================================================================
// LEVEL PROGRESSION
// =============================================================================

/** Final boss level (triggers VICTORY on completion) */
export const FINAL_LEVEL = 20;

/** Maximum rarity config level (caps at this for shop generation) */
export const MAX_RARITY_CONFIG_LEVEL = 5;
