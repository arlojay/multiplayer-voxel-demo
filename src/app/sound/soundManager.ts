import { AudioClip } from "./audioClip";

export class AudioManager {
    public context: AudioContext;

    constructor() {
        
    }

    public async init() {
        this.context = new AudioContext();
    }

    public loadSound(url: string): AudioClip {
        const clip = new AudioClip(this);

        fetch(url)
            .then(d => d.arrayBuffer())
            .then(buffer => this.context.decodeAudioData(buffer))
            .then(audioBuffer => {
                clip.setBuffer(audioBuffer);
            });


        return clip;
    }
}