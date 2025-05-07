import { SplineInterpolator, SplinePoint } from "./splineInterpolator";

export class LinearSplineInterpolator extends SplineInterpolator<LinearSplineInterpolator> {
    public constructor(points: SplinePoint[]) {
        super(points);
    }

    protected interpolateSample(a: number, b: number, t: number): number {
        return (b - a) * t + a;
    }

    protected makeNew(points: SplinePoint[]): LinearSplineInterpolator {
        return new LinearSplineInterpolator(points);
    }
}
