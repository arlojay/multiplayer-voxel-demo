import { $enum } from "ts-enum-util";
import { ConstantSplineInterpolator } from "./constantSplineInterpolator";
import { CubicSplineInterpolator } from "./cubicSplineInterpolator";
import { LinearSplineInterpolator } from "./linearSplineInterpolator";
import { SmoothstepSplineInterpolator } from "./smoothstepSplineInterpolator";
import { SplineInterpolator, SplinePoint } from "./splineInterpolator"

type InterpolatorFactory<T extends SplineInterpolator<T>> = (points: SplinePoint[]) => SplineInterpolator<T>;

export enum InterpolatorType {
    SMOOTHSTEP = "SMOOTHSTEP",
    LINEAR = "LINEAR",
    CONSTANT = "CONSTANT",
    CUBIC = "CUBIC"
}

export class Interpolator<T extends SplineInterpolator<T>> {
    static [InterpolatorType.SMOOTHSTEP] = new Interpolator(points => new SmoothstepSplineInterpolator(points));
    static [InterpolatorType.LINEAR] = new Interpolator(points => new LinearSplineInterpolator(points));
    static [InterpolatorType.CONSTANT] = new Interpolator(points => new ConstantSplineInterpolator(points));
    static [InterpolatorType.CUBIC] = new Interpolator(points => new CubicSplineInterpolator(points));


    private factory: InterpolatorFactory<T>;
    private constructor(factory: InterpolatorFactory<T>) {
        this.factory = factory;
    }
    public create(points: SplinePoint[]): SplineInterpolator<T> {
        return this.factory(points);
    }

    public getType() {
        for(const value of $enum(InterpolatorType).getValues()) {
            if((Interpolator[value] as unknown as typeof this) == this) return value;
        }
        return null;
    }

    public static getInterpolator(type: InterpolatorType): Interpolator<any> {
        return Interpolator[type];
    }
}