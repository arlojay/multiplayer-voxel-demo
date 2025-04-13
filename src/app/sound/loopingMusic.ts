import { AudioClip } from "./audioClip";

export class LoopingMusic {
    public clip: AudioClip;
    public loopingLength: number;
    public context: AudioContext;
    public playCounts: number = 0;
    public gainNode: GainNode;
    public sources: Set<AudioBufferSourceNode> = new Set;
    public _volume: number = 1;
    public mediaSource: MediaStreamAudioSourceNode;

    constructor(clip: AudioClip, loopingLength: number) {
        this.clip = clip;
        this.loopingLength = loopingLength;
        
        this.context = new AudioContext;
        this.context.suspend();

        const media = this.context.createMediaStreamDestination();
        this.mediaSource = clip.manager.context.createMediaStreamSource(media.stream);
        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = this._volume;
        this.gainNode.connect(this.context.destination);

        
        clip.getBuffer().then(buffer => {
            for(let i = 0; i < buffer.duration; i += loopingLength) {
                this.queueNext();
            }
        })
    }

    public destroy() {
        this.mediaSource.disconnect();
        this.gainNode.disconnect();
        for(const source of this.sources) {
            source.disconnect();
        }
    }

    public pause() {
        this.context.suspend();
    }

    public resume() {
        this.context.resume();
    }

    public get volume() {
        return this._volume;
    }

    public set volume(volume: number) {
        this._volume = volume;
        this.gainNode.gain.value = volume;
    }

    public async queueNext() {
        const buffer = await this.clip.getBuffer();

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode);
        source.start(this.loopingLength * this.playCounts);


        this.sources.add(source);

        source.addEventListener("ended", () => {
            this.queueNext();
            this.sources.delete(source);
        });

        this.playCounts++;
    }
}