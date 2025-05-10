import { SplineInterpolator, SplinePoint } from "./splineInterpolator";

export class ConstantSplineInterpolator extends SplineInterpolator<ConstantSplineInterpolator> {
    public constructor(points: SplinePoint[]) {
        super(points);
    }

    protected interpolateSample(a: number, b: number, t: number): number {
        return t > 0.5 ? b : a;
    }

    protected makeNew(points: SplinePoint[]): ConstantSplineInterpolator {
        return new ConstantSplineInterpolator(points);
    }
}
