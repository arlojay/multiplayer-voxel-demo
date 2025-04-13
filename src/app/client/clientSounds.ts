import { AudioClip } from "../sound/audioClip";
import { AudioManager } from "../sound/soundManager";

export class ClientSounds {
    private static audioManager: AudioManager;
    private static soundMap: Map<string, AudioClip> = new Map;


    public static readonly blockBreak = this.sound("assets/sounds/block-break.wav");
    public static readonly blockPlace = this.sound("assets/sounds/block-place.wav");



    private static sound(source: string): () => AudioClip {
        return () => {
            if(this.soundMap.has(source)) return this.soundMap.get(source);
            
            const sound = this.audioManager.loadSound(source);
            this.soundMap.set(source, sound);
            return sound;
        }
    }
    public static init(audioManager: AudioManager) {
        this.audioManager = audioManager;
    }
}