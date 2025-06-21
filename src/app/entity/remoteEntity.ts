import { Box3, Scene, Vector3 } from "three";
import { BaseEntity } from "./baseEntity";
import { CHUNK_INC_SCL, CHUNK_SIZE } from "../voxelGrid";
import { World } from "../world";

export abstract class RemoteEntity<Base extends BaseEntity = BaseEntity<RemoteEntity<any>, any>> {
    protected readonly base: Base;
    public readonly renderPosition = new Vector3;
    private timeSinceLastUpdate = 0;
    
    public readonly position: Vector3;
    public readonly velocity: Vector3;
    public readonly hitbox: Box3;

    /** do NOT override */
    public constructor(base: typeof this.base) {
        this.base = base;
        this.position = base.position;
        this.velocity = base.velocity;
        this.hitbox = base.hitbox;
        this.init();
    }

    protected init() {

    }

    public setWorld(world: World) {
        
    }

    public resetTimer() {
        this.timeSinceLastUpdate = 0;
    }

    public update(dt: number) {
        this.timeSinceLastUpdate += dt;
        const newPosition = this.base.position.clone();
        newPosition.add(this.base.velocity.clone().multiplyScalar(1 - 0.5 ** (this.timeSinceLastUpdate)));

        this.renderPosition.lerp(newPosition, 1 - 0.5 ** (dt * 30));
        if(isNaN(this.renderPosition.x)) {
            this.renderPosition.copy(this.base.position);
        }
    }

    public onMoved() {

    }
    public onUpdated() {

    }
    public onAdd(scene: Scene) {
        
    }
    public onRemove() {
        
    }
    
    public get x() {
        return this.position.x;
    }
    public get y() {
        return this.position.y;
    }
    public get z() {
        return this.position.z;
    }
    public get vx() {
        return this.velocity.x;
    }
    public get vy() {
        return this.velocity.y;
    }
    public get vz() {
        return this.velocity.z;
    }

    public get chunkX() {
        return Math.floor(this.position.x / CHUNK_SIZE);
    }
    public get chunkY() {
        return Math.floor(this.position.y / CHUNK_SIZE);
    }
    public get chunkZ() {
        return Math.floor(this.position.z / CHUNK_SIZE);
    }
}