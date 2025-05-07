import { SplineInterpolator, SplinePoint } from "./splineInterpolator";

export class SmoothstepSplineInterpolator extends SplineInterpolator<SmoothstepSplineInterpolator> {
    public constructor(points: SplinePoint[]) {
        super(points);
    }

    protected interpolateSample(a: number, b: number, t: number): number {
        return (b - a) * (t * t * (3 - 2 * t)) + a;
    }

    protected makeNew(points: SplinePoint[]): SmoothstepSplineInterpolator {
        return new SmoothstepSplineInterpolator(points);
    }
}
