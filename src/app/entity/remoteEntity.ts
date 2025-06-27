import { Box3, Scene, Vector3 } from "three";
import { CHUNK_SIZE } from "../world/voxelGrid";
import { World } from "../world/world";
import { BaseEntity } from "./baseEntity";
import { positionLerp } from "../math";
import { TimeMetric } from "../client/updateMetric";

export abstract class RemoteEntity<Base extends BaseEntity = BaseEntity<RemoteEntity<any>, any>> {
    protected readonly base: Base;
    public readonly renderPosition = new Vector3;
    private timeSinceLastUpdate = 0;
    
    public readonly position: Vector3;
    public readonly velocity: Vector3;
    public readonly acceleration: Vector3;
    public readonly drag: Vector3;
    
    public readonly hitbox: Box3;

    /** do NOT override */
    public constructor(base: typeof this.base) {
        this.base = base;
        this.position = base.position;
        this.velocity = base.velocity;
        this.acceleration = base.acceleration;
        this.drag = base.drag;
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

    public update(metric: TimeMetric) {
        const dt = metric.dt;
        
        this.timeSinceLastUpdate += dt;
        const newPosition = this.base.position.clone();
        newPosition.x = positionLerp(dt, newPosition.x, this.velocity.x, this.acceleration.x, this.drag.x);
        newPosition.y = positionLerp(dt, newPosition.y, this.velocity.y, this.acceleration.y, this.drag.y);
        newPosition.z = positionLerp(dt, newPosition.z, this.velocity.z, this.acceleration.z, this.drag.z);

        this.renderPosition.lerp(newPosition, 1 - 0.5 ** (dt * 100));
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
    public get ax() {
        return this.acceleration.x;
    }
    public get ay() {
        return this.acceleration.y;
    }
    public get az() {
        return this.acceleration.z;
    }
    public get dx() {
        return this.drag.x;
    }
    public get dy() {
        return this.drag.y;
    }
    public get dz() {
        return this.drag.z;
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