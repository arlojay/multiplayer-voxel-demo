import { $enum } from "ts-enum-util";
import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";
import { SingleInputNoiseTransformer } from "../../singleInputNoiseTransformer";
import { Interpolator, InterpolatorType } from "../../spline/interpolator";
import { SplineInterpolator, SplinePoint } from "../../spline/splineInterpolator";

export class NoiseSpline<T extends SplineInterpolator<T>> extends SingleInputNoiseTransformer {
    interpolatorType: Interpolator<T>;
    interpolator: SplineInterpolator<T>;
    points: SplinePoint[];
    
    static register() {
        registerNoiseNode("graph", (data, loaderProps) => {
            if(data.source == null) throw new ReferenceError("graph transformer must have a `source`");
            const source = loadNoiseNode(data.source, loaderProps);

            if(data.points == null) throw new ReferenceError("graph transformer must have a `points` array");
            const pointsArray: any[] = Array.from(data.points);

            const interpolator = Interpolator.getInterpolator($enum(InterpolatorType).getValueOrDefault(data.interpolator?.toUpperCase(), InterpolatorType.SMOOTHSTEP));

            const splinePoints: SplinePoint[] = new Array;
            for(let i = 0; i < pointsArray.length; i++) {
                splinePoints.push({
                    x: pointsArray[i][0] ?? 0,
                    y: pointsArray[i][1] ?? 0
                });
            }
            
            return new NoiseSpline(
                source,
                splinePoints,
                interpolator
            );
        });
    }

    public serialize() {
        return {
            type: "graph",
            points: this.points.map(v => [ v.x, v.y ]),
            interpolator: $enum(InterpolatorType).getKeyOrThrow(this.interpolatorType.getType()),
            source: this.source.serialize()
        }
    }

    public constructor(source: NoiseNode, splinePoints: SplinePoint[], interpolatorType: Interpolator<T>) {
        super(source);
        this.points = splinePoints;
        this.interpolator = interpolatorType.create(splinePoints);
        this.interpolatorType = interpolatorType;
    }
    protected transform(v: number): number {
        return this.interpolator.interpolate(v);
    }
    asCopy(): NoiseSpline<T> {
        return new NoiseSpline(this.source.asCopy(), this.points, this.interpolatorType);
    }
}