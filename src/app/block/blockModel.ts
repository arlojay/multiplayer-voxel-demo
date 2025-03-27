import { Vector2 } from "three";

export class BlockCuboidFace {
    texture: string;
    uvMin: Vector2;
    uvMax: Vector2;
    uvRotation: number;
}
export class BlockModelCuboid {
    public north: BlockCuboidFace;
    public east: BlockCuboidFace;
    public south: BlockCuboidFace;
    public west: BlockCuboidFace;
    public up: BlockCuboidFace;
    public down: BlockCuboidFace;
}
export class BlockModel {
    public cuboids: BlockModelCuboid[] = new Array;
}

export class ModelPart {
    public faceCount: number;
    public position: Float32Array;
    public uv: Float32Array;

    
}