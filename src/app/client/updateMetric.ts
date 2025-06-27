export interface TimeMetric {
    time: number;
    timeMs: number;
    
    dt: number;
    dtMs: number;

    budget: {
        msLeft: number;
    }
}