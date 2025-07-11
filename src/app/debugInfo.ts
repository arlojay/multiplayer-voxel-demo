import { Client } from "./client/client";
import { TimeMetric } from "./client/updateMetric";
import { dlerp } from "./math";
import { getStats } from "./turn";

export class DebugInfo {
    private performanceMeter: HTMLDivElement;
    private memCounter: HTMLDivElement;
    private fpsCounter: HTMLDivElement;
    private frametimeCounter: HTMLDivElement;
    private networkCounterUp: HTMLDivElement;
    private networkCounterDown: HTMLDivElement;
    private drawCallsCounter: HTMLDivElement;
    private memused: number;
    private displayMemused: number;
    private lastSentBytes: number;
    private lastSentByteInterval: number;
    private lastRecvBytes: number;
    private lastRecvByteInterval: number;
    private lastDrawCalls: number;
    private drawCalls: number;
    private lastNetworkUpdate: number;

    private cbs: ({ time: number, run: () => void })[];
    private client: Client;

    constructor(client: Client) {
        this.client = client;
        this.performanceMeter = document.querySelector("#perf-meters");
        this.memCounter = this.performanceMeter.querySelector(".mem");
        this.fpsCounter = this.performanceMeter.querySelector(".fps");
        this.frametimeCounter = this.performanceMeter.querySelector(".frametime");
        this.networkCounterUp = this.performanceMeter.querySelector(".network .up");
        this.networkCounterDown = this.performanceMeter.querySelector(".network .down");
        this.drawCallsCounter = this.performanceMeter.querySelector(".draw-calls");

        this.memused = 0;
        this.displayMemused = 0;
        this.lastNetworkUpdate = 0;
        this.lastSentBytes = 0;
        this.lastSentByteInterval = 0;
        this.lastRecvBytes = 0;
        this.lastRecvByteInterval = 0;

        this.cbs = new Array;
        this.lastDrawCalls = 0;

        setInterval(() => {
            const memory = (performance as any).memory;
            if(memory != null) {
                this.memused = memory.usedJSHeapSize / 1024 / 1024;
            }
            this.updateElements();
        }, 100)
    }
    public decimalToAccuracy(value: number, places: number) {
        const n = 10 ** places;
        const count = (Math.round(value * n) / n).toString();
        let [ whole, frac ] = count.split(".");
        if(frac == null) frac = "";
        frac = frac.padEnd(places, "0");

        return whole + "." + frac;
    }
    public update(metric: TimeMetric) {
        while(this.cbs.length > 0 && (this.cbs[0]?.time < metric.time || isNaN(+this.cbs[0]?.time))) this.cbs.shift()?.run?.();

        if(metric.time - this.lastNetworkUpdate > 1 && this.client.serverSession?.serverConnection != null) {
            getStats(this.client.serverSession.serverConnection).then(stats => {
                if(stats != null) {
                    const sent = stats.bytesSent - this.lastSentBytes;
                    this.lastSentBytes = stats.bytesSent;
                    this.lastSentByteInterval = sent;

                    const recv = stats.bytesReceived - this.lastRecvBytes;
                    this.lastRecvBytes = stats.bytesReceived;
                    this.lastRecvByteInterval = recv;
                }
            });
            this.lastNetworkUpdate = metric.time;
        }

        this.displayMemused = Math.min(this.memused, dlerp(this.displayMemused, this.memused, metric.dt, 5));
            
        this.drawCalls = this.client.gameRenderer.renderer.info.calls - this.lastDrawCalls;
        this.lastDrawCalls = this.client.gameRenderer.renderer.info.calls;
        this.client.gameRenderer.renderer.info.reset();
    }
    public updateElements() {
        this.memCounter.textContent = this.decimalToAccuracy(this.displayMemused, 2) + "MB mem";
        
        if(this.client.gameRenderer != null) {
            this.fpsCounter.textContent = Math.round(this.client.gameRenderer.framerate) + " FPS";
            this.frametimeCounter.textContent = this.decimalToAccuracy(this.client.gameRenderer.frametime, 3) + " ms/f";
            this.drawCallsCounter.textContent = this.decimalToAccuracy(this.client.lastMetric.budget.msLeft, 1) + " budget ms";
        }
        if(this.client.peer != null) {
            this.networkCounterUp.textContent =
                "↗ " + this.decimalToAccuracy(this.lastSentByteInterval / 128, 2).padStart(10, " ") + "kbps";

            this.networkCounterDown.textContent =
                "↘ " + this.decimalToAccuracy(this.lastRecvByteInterval / 128, 2).padStart(10, " ") + "kbps";
        }
    }
}