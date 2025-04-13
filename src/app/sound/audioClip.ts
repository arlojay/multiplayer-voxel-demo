import { AudioManager } from "./soundManager";

export class PlayingAudioClip {
    public manager: AudioManager;
    public clip: AudioClip;
    public source: AudioBufferSourceNode;
    public gainNode: GainNode;
    public playing: boolean = false;
    public onfinish: () => void;

    private playedTime = 0;
    private pausedTime = 0;
    private currentTime = 0;
    private _pitch: number = 1;
    private _volume: number = 1;
    
    constructor(manager: AudioManager, clip: AudioClip) {
        this.manager = manager;
        this.clip = clip;

        this.gainNode = manager.context.createGain();
        this.gainNode.gain.value = this._volume;
        this.gainNode.connect(manager.context.destination);
    }

    public destroy() {
        this.source.disconnect();
        this.gainNode.disconnect();
    }

    public pause() {
        if(!this.playing) return;

        this.pausedTime = this.manager.context.currentTime;
        this.currentTime += this.pausedTime - this.playedTime;
        this.source.stop();
        this.source.disconnect();
        this.source = null;
    }
    public resume(destination: AudioDestinationNode) {
        if(this.playing) return;
        
        const source = this.manager.context.createBufferSource();
        source.buffer = this.clip.buffer;
        source.playbackRate.value = this._pitch;

        this.source = source;

        this.source.addEventListener("ended", () => {
            this.onfinish?.();
        });
        this.source.connect(this.gainNode);
        this.playing = false;

        this.playedTime = this.manager.context.currentTime;
        this.source.start(0, this.currentTime);
    }
    public get pitch() {
        return this._pitch;
    }
    public set pitch(pitch: number) {
        this._pitch = pitch;
        this.source.playbackRate.value = pitch;
    }
    public get volume() {
        return this._volume;
    }
    public set volume(volume: number) {
        this._volume = volume;
        this.source.playbackRate.value = volume;
    }
}

export class AudioClip {
    public manager: AudioManager;
    public buffer: AudioBuffer | null;
    public playingClips: Set<PlayingAudioClip> = new Set;
    public getBufferPromise: Promise<AudioBuffer> | null;
    public getBufferResolve: ((buffer: AudioBuffer) => void) | null;

    constructor(manager: AudioManager, buffer?: AudioBuffer) {
        this.manager = manager;
        if(buffer != null) this.buffer = buffer;
    }

    public setBuffer(buffer: AudioBuffer) {
        if(buffer == null) return;
        this.buffer = buffer;
        this.getBufferResolve?.(buffer);
    }

    public async getBuffer() {
        this.getBufferPromise ??= new Promise<AudioBuffer>((res) => {
            this.getBufferResolve = res;
        });
        return await this.getBufferPromise;
    }

    public async play(destination: AudioDestinationNode = this.manager.context.destination) {
        await this.getBuffer();

        const playingClip = new PlayingAudioClip(this.manager, this);
        this.playingClips.add(playingClip);

        playingClip.resume(destination);

        return playingClip;
    }
}