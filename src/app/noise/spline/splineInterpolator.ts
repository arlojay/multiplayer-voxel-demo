export interface SplinePoint {
    x: number;
    y: number;
}

export abstract class SplineInterpolator<Implementer extends SplineInterpolator<Implementer>> {
    protected points: SplinePoint[];

    constructor(points: SplinePoint[]) {
        this.points = points;
    }

    protected abstract interpolateSample(a: number, b: number, t: number): number;

    public interpolate(sample: number): number {
        let lastPoint = this.points[0];
        if (sample <= lastPoint.x) return lastPoint.y;

        for (const currentPoint of this.points) {
            if (currentPoint.x >= sample) {
                return this.interpolateSample(
                    lastPoint.y,
                    currentPoint.y,
                    (sample - lastPoint.x) / (currentPoint.x - lastPoint.x)
                );
            }
            lastPoint = currentPoint;
        }

        return this.points[this.points.length - 1].y;
    }

    public toString(): string {
        return this.points
            .map(point => `(${point.x}, ${point.y})`)
            .join(", ");
    }

    public asCopy(): Implementer {
        const pointClones = this.points.map(point => ({ ...point }));
        return this.makeNew(pointClones);
    }

    protected abstract makeNew(points: SplinePoint[]): Implementer;
}
