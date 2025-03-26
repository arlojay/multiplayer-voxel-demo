import { Box3, Vector3 } from "three";
import { World } from "../world";
import { AIR_BIT } from "../voxelMesher";

export const GRAVITY = new Vector3(0, -25, 0);
export const ZERO = new Vector3(0);
const BLOCK_HITBOX = new Box3(
    new Vector3(0, 0, 0),
    new Vector3(1, 1, 1)
);
const S = 0.001;

export class Entity {
    public world: World = null;
    public position: Vector3;
    public velocity: Vector3;
    public hitbox: Box3;
    public airTime: number = 0;
    private lastBlockCollision = {
        x: 0,
        y: 0,
        z: 0,
        block: 0,
        hitbox: BLOCK_HITBOX
    };
    
    constructor() {
        this.position = new Vector3;
        this.velocity = new Vector3;
    }

    public setWorld(world: World) {
        this.world = world;
    }

    public update(dt: number) {
        if(this.world == null) return;
        
        this.velocity.add(GRAVITY.clone().multiplyScalar(dt));
        this.velocity.lerp(ZERO, 1 - (0.5 ** (dt * 0.1)));

        this.airTime += dt;

        this.moveY(this.velocity.y * dt);
        this.moveX(this.velocity.x * dt);
        this.moveZ(this.velocity.z * dt);
    }

    public collidesWithHitbox(x: number, y: number, z: number, hitbox: Box3) {
        if(this.position.x + this.hitbox.min.x >= x + hitbox.max.x - S) return false;
        if(this.position.x + this.hitbox.max.x <= x + hitbox.min.x + S) return false;

        if(this.position.y + this.hitbox.min.y >= y + hitbox.max.y - S) return false;
        if(this.position.y + this.hitbox.max.y <= y + hitbox.min.y + S) return false;

        if(this.position.z + this.hitbox.min.z >= z + hitbox.max.z - S) return false;
        if(this.position.z + this.hitbox.max.z <= z + hitbox.min.z + S) return false;

        return true;
    }

    public isCollidingWithWorld() {
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
                    if((block & AIR_BIT) == 0) continue;

                    const hitbox = BLOCK_HITBOX;
                    if(!this.collidesWithHitbox(x, y, z, hitbox)) continue;

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

    public moveX(dx: number) {
        this.position.x += dx;
        if(!this.isCollidingWithWorld()) return;

        this.velocity.x = 0;
        if(dx < 0) {
            this.position.x += this.lastBlockCollision.x + this.lastBlockCollision.hitbox.max.x - (this.position.x + this.hitbox.min.x);
        } else if(dx > 0) {
            this.position.x += this.lastBlockCollision.x + this.lastBlockCollision.hitbox.min.x - (this.position.x + this.hitbox.max.x);
        }
    }
    public moveY(dy: number) {
        this.position.y += dy;
        if(!this.isCollidingWithWorld()) return;

        this.velocity.y = 0;
        if(dy < 0) {
            this.position.y += this.lastBlockCollision.y + this.lastBlockCollision.hitbox.max.y - (this.position.y + this.hitbox.min.y);
            this.airTime = 0;
        } else if(dy > 0) {
            this.position.y += this.lastBlockCollision.y + this.lastBlockCollision.hitbox.min.y - (this.position.y + this.hitbox.max.y);
        }
    }
    public moveZ(dz: number) {
        this.position.z += dz;
        if(!this.isCollidingWithWorld()) return;

        this.velocity.z = 0;
        if(dz < 0) {
            this.position.z += this.lastBlockCollision.z + this.lastBlockCollision.hitbox.max.z - (this.position.z + this.hitbox.min.z);
        } else if(dz > 0) {
            this.position.z += this.lastBlockCollision.z + this.lastBlockCollision.hitbox.min.z - (this.position.z + this.hitbox.max.z);
        }
    }
}