/**
 * SoundManager - Handles all game audio using Web Audio API.
 * 
 * Generates procedural sounds for attacks, crits, and other game events.
 * No external audio files needed - all sounds are synthesized.
 */
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.initialized = false;
    }
    
    /**
     * Initialize the audio context. Must be called after user interaction.
     */
    init() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log("SoundManager initialized");
        } catch (e) {
            console.warn("Web Audio API not supported:", e);
            this.enabled = false;
        }
    }
    
    /**
     * Resume audio context if suspended (required by browsers after user interaction)
     */
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    /**
     * Play attack sound based on item type
     * @param {string} itemType - 'weapon', 'shield', or 'relic'
     * @param {string} subtype - 'sword', 'axe', 'dagger', 'wand', etc.
     */
    playAttackSound(itemType, subtype) {
        if (!this.enabled || !this.audioContext) return;
        this.resume();
        
        switch (subtype) {
            case 'sword':
                this.playSwordSound();
                break;
            case 'axe':
                this.playAxeSound();
                break;
            case 'dagger':
                this.playDaggerSound();
                break;
            case 'wand':
                this.playWandSound();
                break;
            default:
                if (itemType === 'shield') {
                    this.playShieldSound();
                } else {
                    this.playGenericAttackSound();
                }
        }
    }
    
    /**
     * Play critical hit sound
     * @param {string} critType - 'Crit', 'SuperCrit', or 'HyperCrit'
     */
    playCritSound(critType) {
        if (!this.enabled || !this.audioContext) return;
        this.resume();
        
        const baseFreq = critType === 'HyperCrit' ? 880 : critType === 'SuperCrit' ? 660 : 440;
        this.playTone(baseFreq, 0.1, 'square', 0.2);
        setTimeout(() => this.playTone(baseFreq * 1.5, 0.1, 'square', 0.15), 50);
        if (critType === 'HyperCrit') {
            setTimeout(() => this.playTone(baseFreq * 2, 0.15, 'square', 0.2), 100);
        }
    }
    
    // === Sound Generators ===
    
    playSwordSound() {
        // Metallic slash sound
        this.playNoise(0.08, 2000, 4000);
        this.playTone(200, 0.05, 'sawtooth', 0.15);
    }
    
    playAxeSound() {
        // Heavy thud with metallic ring
        this.playTone(80, 0.15, 'triangle', 0.25);
        this.playNoise(0.1, 1000, 3000);
    }
    
    playDaggerSound() {
        // Quick stab sound
        this.playNoise(0.04, 3000, 6000);
        this.playTone(400, 0.03, 'sine', 0.1);
    }
    
    playWandSound() {
        // Magical sparkle
        this.playTone(800, 0.1, 'sine', 0.15);
        setTimeout(() => this.playTone(1200, 0.08, 'sine', 0.1), 30);
        setTimeout(() => this.playTone(1600, 0.06, 'sine', 0.08), 60);
    }
    
    playShieldSound() {
        // Block/thud sound
        this.playTone(100, 0.1, 'triangle', 0.2);
        this.playNoise(0.05, 500, 1500);
    }
    
    playGenericAttackSound() {
        // Generic hit
        this.playNoise(0.06, 1500, 3500);
        this.playTone(150, 0.05, 'triangle', 0.15);
    }
    
    /**
     * Play a simple tone
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {string} type - Oscillator type: 'sine', 'square', 'sawtooth', 'triangle'
     * @param {number} volume - Volume multiplier (0-1)
     */
    playTone(frequency, duration, type = 'sine', volume = 0.2) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(volume * this.volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    /**
     * Play filtered noise (for impact/slash sounds)
     * @param {number} duration - Duration in seconds
     * @param {number} lowFreq - Low frequency cutoff
     * @param {number} highFreq - High frequency cutoff
     */
    playNoise(duration, lowFreq = 1000, highFreq = 4000) {
        if (!this.audioContext) return;
        
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        
        // Bandpass filter
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime((lowFreq + highFreq) / 2, this.audioContext.currentTime);
        filter.Q.setValueAtTime(1, this.audioContext.currentTime);
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        noise.start(this.audioContext.currentTime);
    }
    
    /**
     * Toggle sound on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        console.log(`Sound ${this.enabled ? 'enabled' : 'disabled'}`);
        return this.enabled;
    }
    
    /**
     * Set volume (0-1)
     */
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }
}

export const soundManager = new SoundManager();
