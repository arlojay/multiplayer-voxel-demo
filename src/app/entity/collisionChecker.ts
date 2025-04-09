import { Box3, Vector3 } from "three";
import { SOLID_BITMASK } from "../voxelGrid";
import { World } from "../world";
import { BLOCK_HITBOX } from "./entity";

export class CollisionChecker {
    public hitbox: Box3;
    public position: Vector3;
    public world: World;
    public lastBlockCollision = {
        x: 0,
        y: 0,
        z: 0,
        block: 0,
        hitbox: BLOCK_HITBOX
    };

    constructor(hitbox: Box3, position: Vector3, world: World) {
        this.hitbox = hitbox;
        this.position = position;
        this.world = world;
    }
    public collidesWithHitbox(x: number, y: number, z: number, hitbox: Box3, expand: number = 0.001) {
        if(this.position.x + this.hitbox.min.x >= x + hitbox.max.x - expand) return false;
        if(this.position.x + this.hitbox.max.x <= x + hitbox.min.x + expand) return false;

        if(this.position.y + this.hitbox.min.y >= y + hitbox.max.y - expand) return false;
        if(this.position.y + this.hitbox.max.y <= y + hitbox.min.y + expand) return false;

        if(this.position.z + this.hitbox.min.z >= z + hitbox.max.z - expand) return false;
        if(this.position.z + this.hitbox.max.z <= z + hitbox.min.z + expand) return false;

        return true;
    }

    public isCollidingWithWorld(expand: number = 0.001) {
        const minX = Math.floor(this.position.x + this.hitbox.min.x);
        const maxX = Math.ceil(this.position.x + this.hitbox.max.x);
        const minY = Math.floor(this.position.y + this.hitbox.min.y);
        const maxY = Math.ceil(this.position.y + this.hitbox.max.y);
        const minZ = Math.floor(this.position.z + this.hitbox.min.z);
        const maxZ = Math.ceil(this.position.z + this.hitbox.max.z);

        let block = 0;

        for(let x = minX; x < maxX; x++) {
            for(let y = minY; y < maxY; y++) {
                for(let z = minZ; z < maxZ; z++) {
                    block = this.world.getRawValue(x, y, z);
                    if(~block & SOLID_BITMASK) continue;

                    const hitbox = BLOCK_HITBOX;
                    if(!this.collidesWithHitbox(x, y, z, hitbox, expand)) continue;

                    this.lastBlockCollision.x = x;
                    this.lastBlockCollision.y = y;
                    this.lastBlockCollision.z = z;
                    this.lastBlockCollision.block = block;
                    this.lastBlockCollision.hitbox = hitbox;
                    return true;
                }
            }
        }

        return false;
    }
}