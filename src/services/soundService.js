import { Audio } from 'expo-av';

const SOUNDS = {
    click: require('../../assets/sounds/click (2).mp3'),
    correct: require('../../assets/sounds/correct answer.mp3'),
    wrong: require('../../assets/sounds/wrong answer.mp3'),
    win: require('../../assets/sounds/win.mp3'),
    gameover: require('../../assets/sounds/gameover.mp3'),
    levelup: require('../../assets/sounds/levelup.mp3'),
    rankup: require('../../assets/sounds/rankup.mp3'),
    ranking: require('../../assets/sounds/ranking.mp3'),
    logo: require('../../assets/sounds/logo.mp3'),
};

class SoundService {
    static instance = null;
    sounds = {};

    constructor() {
        if (SoundService.instance) {
            return SoundService.instance;
        }
        SoundService.instance = this;
    }

    async playSound(soundKey) {
        try {
            const { sound } = await Audio.Sound.createAsync(SOUNDS[soundKey]);
            await sound.playAsync();

            // Auto unload after playing
            sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.didJustFinish) {
                    await sound.unloadAsync();
                }
            });
        } catch (error) {
            console.log('Error playing sound:', error);
        }
    }

    // Specialized play for logo/loading that might need to be pre-loaded or handled differently
    async playLogoSound() {
        return this.playSound('logo');
    }
}

const soundService = new SoundService();
export default soundService;
