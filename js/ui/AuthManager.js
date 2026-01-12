import { gameState } from '../state/GameState.js';
import { uiManager } from './UIManager.js';

export class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        // Check for existing save
        const savedName = localStorage.getItem('tower_char_name');

        // Show Welcome Screen
        uiManager.showScreen('screen-welcome');

        if (savedName) {
            this.showWelcomeBack(savedName);
        } else {
            this.showNewEntry();
        }

        this.setupListeners();
    }

    setupListeners() {
        // New Character Entry
        if (uiManager.elements.createCharBtn) {
            uiManager.elements.createCharBtn.onclick = () => this.handleNewEntry();
        }

        // Resume Game
        if (uiManager.elements.resumeBtn) {
            uiManager.elements.resumeBtn.onclick = () => this.handleResume();
        }

        // Reset Save
        if (uiManager.elements.resetSaveBtn) {
            uiManager.elements.resetSaveBtn.onclick = () => this.handleReset();
        }
    }

    showWelcomeBack(name) {
        if (uiManager.elements.loginForm) uiManager.elements.loginForm.classList.add('hidden');
        if (uiManager.elements.welcomeBackForm) uiManager.elements.welcomeBackForm.classList.remove('hidden');
        if (uiManager.elements.welcomeCharName) uiManager.elements.welcomeCharName.innerText = name;
    }

    showNewEntry() {
        if (uiManager.elements.welcomeBackForm) uiManager.elements.welcomeBackForm.classList.add('hidden');
        if (uiManager.elements.loginForm) uiManager.elements.loginForm.classList.remove('hidden');
        if (uiManager.elements.charName) uiManager.elements.charName.value = '';
    }

    handleNewEntry() {
        const nameInput = uiManager.elements.charName;
        const name = nameInput.value.trim();

        if (name) {
            gameState.playerName = name;
            localStorage.setItem('tower_char_name', name);
            this.startGame();
        } else {
            alert("Please sign the guestbook (enter a name)!");
        }
    }

    handleResume() {
        const savedName = localStorage.getItem('tower_char_name');
        if (savedName) {
            gameState.playerName = savedName;
            this.startGame();
        } else {
            this.handleReset(); // Error state, fallback
        }
    }

    handleReset() {
        localStorage.removeItem('tower_char_name');
        // also clear other save data if we had it
        this.showNewEntry();
    }

    startGame() {
        // Start the game loop / enter shop
        gameState.startGame();
    }
}

export const authManager = new AuthManager();
