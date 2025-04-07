import { Box3, Vector3 } from "three";

export class VoxelGridVolume {
    public data: Uint16Array;
    private volume: Box3;
    private minX: number;
    private minY: number;
    private minZ: number;
    private maxX: number;
    private maxY: number;
    private maxZ: number;

    private sizeX: number;
    private sizeY: number;
    private sizeZ: number;

    constructor(volume: Box3) {
        const size = new Vector3;
        volume.getSize(size);

        this.sizeX = size.x;
        this.sizeY = size.y;
        this.sizeZ = size.z;

        this.data = new Uint16Array(this.sizeX * this.sizeY * this.sizeZ);

        this.volume.min.copy(volume.min);
        this.volume.max.copy(volume.max);

        this.minX = volume.min.x;
        this.minY = volume.min.y;
        this.minZ = volume.min.z;
        this.maxX = volume.max.x;
        this.maxY = volume.max.y;
        this.maxZ = volume.max.z;
    }

    public getVolume() {
        return this.volume.clone();
    }


    public get(x: number, y: number, z: number): number {
        if(x < this.minX) return 0;
        if(x > this.maxX) return 0;
        if(y < this.minY) return 0;
        if(y > this.maxY) return 0;
        if(z < this.minZ) return 0;
        if(z > this.maxZ) return 0;

        return this.data[
            (x + this.minX) * (this.sizeY * this.sizeZ) +
            (y + this.minY) * (this.sizeZ) +
            (z + this.minZ)
        ];
    }

    public set(x: number, y: number, z: number, value: number) {
        if(x < this.minX) return;
        if(x > this.maxX) return;
        if(y < this.minY) return;
        if(y > this.maxY) return;
        if(z < this.minZ) return;
        if(z > this.maxZ) return;

        this.data[
            (x + this.minX) * (this.sizeY * this.sizeZ) +
            (y + this.minY) * (this.sizeZ) +
            (z + this.minZ)
        ] = value;
    }

    public fill(value: number) {
        this.data.fill(value);
    }
}