import { Box3, Vector3 } from "three";
import { World } from "../world";
import { AIR_BIT } from "../voxelMesher";

export const GRAVITY = new Vector3(0, -9.81, 0);
export const ZERO = new Vector3(0);

export class Entity {
    public world: World = null;
    public position: Vector3;
    public velocity: Vector3;
    public hitbox: Box3;
    
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

        this.moveY(this.velocity.y * dt);
    }

    public isCollidingWithWorld() {
        const minX = Math.floor(this.position.x + this.hitbox.min.x);
        const maxX = Math.ceil(this.position.x + this.hitbox.max.x);
        const minY = Math.floor(this.position.y + this.hitbox.min.y);
        const maxY = Math.ceil(this.position.y + this.hitbox.max.y);
        const minZ = Math.floor(this.position.z + this.hitbox.min.z);
        const maxZ = Math.ceil(this.position.z + this.hitbox.max.z);

        for(let x = minX; x <= maxX; x++) {
            for(let y = minY; y <= maxY; y++) {
                for(let z = minZ; z <= maxZ; z++) {
                    if(this.world.getRawValue(x, y, z) & AIR_BIT) {
                        console.log("colliding " + x + ", " + y + ", " + z + " (" + this.world.getRawValue(x, y, z) + ")");
                        return true;
                    }
                }
            }
        }

        return false;
    }

    public moveY(dy: number) {
        this.position.y += dy;
        if(!this.isCollidingWithWorld()) return;

        if(dy < 0) {
            this.velocity.y = 0;
            this.position.y -= dy;
        }
    }
}