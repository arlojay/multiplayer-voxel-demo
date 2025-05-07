import { SplineInterpolator, SplinePoint } from "./splineInterpolator";

export class CubicSplineInterpolator extends SplineInterpolator<CubicSplineInterpolator> {
    private h: number[];  // Differences between x values
    private a: number[];  // a coefficients (same as y values)
    private b: number[];  // b coefficients
    private c: number[];  // c coefficients
    private d: number[];  // d coefficients

    constructor(points: SplinePoint[]) {
        super(points);
        const n = points.length - 1;
        this.h = new Array(n);
        this.a = new Array(n + 1);
        this.b = new Array(n);
        this.c = new Array(n + 1);
        this.d = new Array(n);

        for (let i = 0; i <= n; i++) {
            this.a[i] = points[i].y;
        }

        for (let i = 0; i < n; i++) {
            this.h[i] = points[i + 1].x - points[i].x;
        }

        this.calculateCoefficients(n);
    }

    private calculateCoefficients(n: number): void {
        const alpha = new Array(n).fill(0);
        const l = new Array(n + 1).fill(0);
        const mu = new Array(n + 1).fill(0);
        const z = new Array(n + 1).fill(0);

        for (let i = 1; i < n; i++) {
            alpha[i] =
                (3.0 / this.h[i]) * (this.a[i + 1] - this.a[i]) -
                (3.0 / this.h[i - 1]) * (this.a[i] - this.a[i - 1]);
        }

        l[0] = 1.0;
        mu[0] = z[0] = 0.0;

        for (let i = 1; i < n; i++) {
            l[i] = 2.0 * (this.points[i + 1].x - this.points[i - 1].x) - this.h[i - 1] * mu[i - 1];
            mu[i] = this.h[i] / l[i];
            z[i] = (alpha[i] - this.h[i - 1] * z[i - 1]) / l[i];
        }

        l[n] = 1.0;
        z[n] = this.c[n] = 0.0;

        for (let j = n - 1; j >= 0; j--) {
            this.c[j] = z[j] - mu[j] * this.c[j + 1];
            this.b[j] =
                (this.a[j + 1] - this.a[j]) / this.h[j] -
                (this.h[j] * (this.c[j + 1] + 2.0 * this.c[j])) / 3.0;
            this.d[j] = (this.c[j + 1] - this.c[j]) / (3.0 * this.h[j]);
        }
    }

    public interpolate(x: number): number {
        const n = this.points.length - 1;
        const i = this.findSegment(x, n);

        const dx = x - this.points[i].x;
        return (
            this.a[i] +
            this.b[i] * dx +
            this.c[i] * dx * dx +
            this.d[i] * dx * dx * dx
        );
    }

    private findSegment(x: number, n: number): number {
        if (x <= this.points[0].x) return 0;
        if (x >= this.points[n].x) return n - 1;

        let low = 0;
        let high = n;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (x < this.points[mid].x) {
                high = mid - 1;
            } else if (x > this.points[mid + 1].x) {
                low = mid + 1;
            } else {
                return mid;
            }
        }
        return low;
    }

    protected makeNew(points: SplinePoint[]): CubicSplineInterpolator {
        return new CubicSplineInterpolator(points);
    }
    protected interpolateSample(a: number, b: number, t: number): number { return 0; }
}
