import { gameState } from '../state/GameState.js';
import { bus } from '../utils/EventBus.js';

class AuthManager {
    constructor() {
        this.registrationScreen = document.getElementById('registration-screen');
        this.charCreationScreen = document.getElementById('character-creation-screen');
        this.gameView = document.getElementById('game-view');

        this.regEmailInput = document.getElementById('reg-email');
        this.regBtn = document.getElementById('reg-btn');

        this.charNameInput = document.getElementById('char-name');
        this.createCharBtn = document.getElementById('create-char-btn');

        this.setupListeners();
    }

    setupListeners() {
        this.regBtn.addEventListener('click', () => this.handleRegistration());
        this.createCharBtn.addEventListener('click', () => this.handleCharacterCreation());
    }

    init() {
        // Check localStorage
        const savedEmail = localStorage.getItem('tower_email');
        const savedName = localStorage.getItem('tower_char_name');

        if (savedEmail) {
            gameState.email = savedEmail;
            if (savedName) {
                gameState.playerName = savedName;
                this.startGame();
            } else {
                this.showCharacterCreation();
            }
        } else {
            this.showRegistration();
        }
    }

    showRegistration() {
        this.registrationScreen.classList.remove('hidden');
        this.charCreationScreen.classList.add('hidden');
        this.gameView.classList.add('hidden');
    }

    showCharacterCreation() {
        this.registrationScreen.classList.add('hidden');
        this.charCreationScreen.classList.remove('hidden');
        this.gameView.classList.add('hidden');
    }

    startGame() {
        this.registrationScreen.classList.add('hidden');
        this.charCreationScreen.classList.add('hidden');
        this.gameView.classList.remove('hidden');
        console.log(`Game started for ${gameState.playerName} (${gameState.email})`);
        gameState.startGame(gameState.playerName);
        bus.emit('PLAYER_READY');
    }

    handleRegistration() {
        const email = this.regEmailInput.value.trim();
        if (email && email.includes('@')) { // Basic validation
            localStorage.setItem('tower_email', email);
            gameState.email = email;
            this.showCharacterCreation();
        } else {
            alert('Please enter a valid email address.');
        }
    }

    handleCharacterCreation() {
        const name = this.charNameInput.value.trim();
        if (name) {
            localStorage.setItem('tower_char_name', name);
            gameState.playerName = name;
            this.startGame();
        } else {
            alert('Please enter a character name.');
        }
    }
}

export const authManager = new AuthManager();
