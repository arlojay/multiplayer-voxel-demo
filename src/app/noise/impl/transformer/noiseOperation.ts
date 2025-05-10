import { $enum } from "ts-enum-util";
import { loadNoiseNode, registerNoiseNode } from "../../noiseLoader";
import { NoiseNode } from "../../noiseNode";

export enum OperationType {
    ADD = "ADD",
    SUBTRACT = "SUBTRACT",
    MULTIPLY = "MULTIPLY",
    DIVIDE = "DIVIDE",
    POWER = "POWER"
};

export class NoiseOperation implements NoiseNode {
    sourceA: NoiseNode;
    sourceB: NoiseNode;
    operation: OperationType;

    static register() {
        registerNoiseNode("operation", (data, loaderProps) => {
            if(data.a == null) throw new ReferenceError("operation transformer must have a source `a`");
            const sourceA = loadNoiseNode(data.a, loaderProps);
            
            if(data.b == null) throw new ReferenceError("operation transformer must have a source `b`");
            const sourceB = loadNoiseNode(data.b, loaderProps);

            const operationString = data.op;
            if(operationString == null) throw new ReferenceError("operation transformer must have an `op` operator");
            const operation = $enum(OperationType).getValueOrThrow(operationString.toUpperCase());
            
            return new NoiseOperation(
                sourceA,
                sourceB,
                operation
            );
        });
    }

    public serialize() {
        return {
            type: "operation",
            op: typeof this.operation == "number" ? (OperationType as unknown as Record<string, OperationType>)[this.operation] : this.operation,
            a: this.sourceA.serialize(),
            b: this.sourceB.serialize()
        }
    }

    public constructor(sourceA: NoiseNode, sourceB: NoiseNode, operation: OperationType) {
        this.sourceA = sourceA;
        this.sourceB = sourceB;
        this.operation = operation;
    }

    private operate(a: number, b: number): number {
        if(this.operation == OperationType.ADD) return a + b;
        if(this.operation == OperationType.SUBTRACT) return a - b;
        if(this.operation == OperationType.MULTIPLY) return a * b;
        if(this.operation == OperationType.DIVIDE) return a / b;
        if(this.operation == OperationType.POWER) return a ** b;

        return 0;
    }

    sample1d(t: number): number {
        return this.operate(this.sourceA.sample1d(t), this.sourceB.sample1d(t));
    }
    sample2d(x: number, y: number): number {
        return this.operate(this.sourceA.sample2d(x, y), this.sourceB.sample2d(x, y));
    }
    sample3d(x: number, y: number, z: number): number {
        return this.operate(this.sourceA.sample3d(x, y, z), this.sourceB.sample3d(x, y, z));
    }
    sample4d(x: number, y: number, z: number, w: number): number {
        return this.operate(this.sourceA.sample4d(x, y, z, w), this.sourceB.sample4d(x, y, z, w));
    }
    setSeed(seed: number): void {
        this.sourceA.setSeed(seed);
        this.sourceB.setSeed(seed);
    }
    asCopy(): NoiseOperation {
        return new NoiseOperation(this.sourceA.asCopy(), this.sourceB.asCopy(), this.operation);
    }

    getSources(): NoiseNode[] {
        return [ this.sourceA, this.sourceB ];
    }
}