import { CHUNK_SIZE } from "./voxelGrid";

export class AugmentedUint16Array extends Uint16Array {
    dispose!: () => void;
}

export class Uint16ArrayPool {
    private static freeArrays: AugmentedUint16Array[] = new Array;
    
    static create(): AugmentedUint16Array {
        let object = Uint16ArrayPool.freeArrays.pop();

        if(object != null) return object;
        
        object = new AugmentedUint16Array(CHUNK_SIZE ** 3);
        object.dispose = () => {
            Uint16ArrayPool.freeArrays.push(object);

            new Float64Array(object.buffer).fill(0);
        }
        return object;
    }
}