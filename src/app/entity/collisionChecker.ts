import { Box3, Vector3 } from "three";
import { World } from "../world";
import { COLOR_BLOCK_BITMASK } from "../voxelGrid";

export type SerializedCustomVoxelColliderBox = [
    number, number, number, // min coordinate
    number, number, number, // max coordinate
    boolean, // walkThrough
    boolean // raycastTarget
];

export class CustomVoxelColliderBox {
    public static deserialize(serialized: SerializedCustomVoxelColliderBox) {
        const instance = new CustomVoxelColliderBox(
            new Vector3(serialized[0], serialized[1], serialized[2]),
            new Vector3(serialized[3], serialized[4], serialized[5])
        )
        instance.walkThrough = serialized[6];
        instance.raycastTarget = serialized[7];

        return instance;
    }

    public readonly hitbox: Box3;
    public walkThrough = false;
    public raycastTarget = true;

    
    public constructor(hitbox: Box3);
    public constructor(min: Vector3, max: Vector3);
    public constructor(arg0: unknown, arg1?: unknown) {
        if(arg0 instanceof Box3) {
            this.hitbox = arg0;
        } else if(arg0 instanceof Vector3 && arg1 instanceof Vector3) {
            this.hitbox = new Box3(arg0, arg1);
        }
    }

    public serialize(): SerializedCustomVoxelColliderBox {
        return [
            this.hitbox.min.x, this.hitbox.min.y, this.hitbox.min.z,
            this.hitbox.max.x, this.hitbox.max.y, this.hitbox.max.z,
            this.walkThrough,
            this.raycastTarget
        ]
    }
}
export type SerializedCustomVoxelCollider = [ SerializedCustomVoxelColliderBox[] ];
export class CustomVoxelCollider {
    public static deserialize(serialized: SerializedCustomVoxelCollider) {
        return new CustomVoxelCollider(
            ...serialized[0].map(serializedBox => CustomVoxelColliderBox.deserialize(serializedBox))
        );
    }

    public readonly boxes: CustomVoxelColliderBox[];

    public constructor(...boxes: CustomVoxelColliderBox[]) {
        this.boxes = boxes;
    }

    public serialize(): SerializedCustomVoxelCollider {
        return [
            this.boxes.map(box => box.serialize())
        ];
    }
}

export interface CompiledCustomVoxelCollider {
    collider: CustomVoxelCollider;
    entityColliders: Box3[];
    raycastTargets: Box3[];
}

export const colliders: CompiledCustomVoxelCollider[] = new Array;
export const ignoreColliders: boolean[] = new Array;
export const ignoreRaycasters: boolean[] = new Array;

export function compileCollider(collider: CustomVoxelCollider) {
    const entityColliders: Box3[] = new Array;
    const raycastTargets: Box3[] = new Array;
    let colliderIgnored = true;
    let raycastIgnored = true;

    if(collider != null) {
        for(const box of collider.boxes) {
            if(box.raycastTarget) {
                raycastTargets.push(box.hitbox);
                raycastIgnored = false;
            }

            if(!box.walkThrough) {
                entityColliders.push(box.hitbox)
                colliderIgnored = false;
            }
        }
    }

    return {
        colliderIgnored, raycastIgnored,
        compiledCollider: { collider, entityColliders, raycastTargets } as CompiledCustomVoxelCollider
    };
}

export function addCustomVoxelCollider(collider: CustomVoxelCollider) {
    const { colliderIgnored, raycastIgnored, compiledCollider } = compileCollider(collider);

    console.log(collider, colliderIgnored);
    ignoreColliders.push(colliderIgnored);
    ignoreRaycasters.push(raycastIgnored);
    colliders.push(compiledCollider);

    console.log(collider);
}

export function resetCustomVoxelColliders() {
    colliders.splice(0);
    ignoreColliders.splice(0);
    ignoreRaycasters.splice(0);
    addCustomVoxelCollider(null);
}

resetCustomVoxelColliders();

export const BASIC_COLLIDER = compileCollider(new CustomVoxelCollider(
    new CustomVoxelColliderBox(new Box3(
        new Vector3(0, 0, 0),
        new Vector3(1, 1, 1)
    ))
)).compiledCollider;

export const getCollider = (block: number) => (block & COLOR_BLOCK_BITMASK) ? BASIC_COLLIDER : colliders[block];
export const isColliderIgnored = (block: number) => (~block & COLOR_BLOCK_BITMASK) && ignoreColliders[block];
export const isRaycastIgnored = (block: number) => (~block & COLOR_BLOCK_BITMASK) && ignoreRaycasters[block];

export interface CollisionDescription {
    x: number, y: number, z: number,
    block: number,
    hitbox: Box3, collider: CompiledCustomVoxelCollider
}

export class CollisionChecker {
    public hitbox: Box3;
    public position: Vector3;
    public world: World;
    public lastBlockCollision: CollisionDescription = {
        x: 0,
        y: 0,
        z: 0,
        block: 0,
        hitbox: BASIC_COLLIDER.collider.boxes[0].hitbox,
        collider: BASIC_COLLIDER
    };

    constructor(hitbox: Box3, position: Vector3, world: World) {
        this.hitbox = hitbox;
        this.position = position;
        this.world = world;
    }
    public collidesWithHitbox(x: number, y: number, z: number, hitbox: Box3, expand: number = 0) {
        if(this.position.x + this.hitbox.min.x >= x + hitbox.max.x + expand) return false;
        if(this.position.x + this.hitbox.max.x <= x + hitbox.min.x - expand) return false;

        if(this.position.y + this.hitbox.min.y >= y + hitbox.max.y + expand) return false;
        if(this.position.y + this.hitbox.max.y <= y + hitbox.min.y - expand) return false;

        if(this.position.z + this.hitbox.min.z >= z + hitbox.max.z + expand) return false;
        if(this.position.z + this.hitbox.max.z <= z + hitbox.min.z - expand) return false;

        return true;
    }
    public collidesWithCollider(x: number, y: number, z: number, collider: CompiledCustomVoxelCollider, expand?: number) {
        for(const box of collider.entityColliders) {
            if(this.collidesWithHitbox(x, y, z, box, expand)) return true;
        }

        return false;
    }
    public collidesWithBlock(x: number, y: number, z: number, block: number, expand?: number) {
        return this.collidesWithCollider(x, y, z, getCollider(block), expand);
    }

    public isCollidingWithWorld(expand = 0, offsetX = 0, offsetY = 0, offsetZ = 0) {
        const minX = Math.floor(this.position.x + this.hitbox.min.x - 0.01 + offsetX);
        const maxX = Math.floor(this.position.x + this.hitbox.max.x + 0.01 + offsetX);
        const minY = Math.floor(this.position.y + this.hitbox.min.y - 0.01 + offsetY);
        const maxY = Math.floor(this.position.y + this.hitbox.max.y + 0.01 + offsetY);
        const minZ = Math.floor(this.position.z + this.hitbox.min.z - 0.01 + offsetZ);
        const maxZ = Math.floor(this.position.z + this.hitbox.max.z + 0.01 + offsetZ);

        let block = 0;

        for(let x = minX; x <= maxX; x++) {
            for(let y = minY; y <= maxY; y++) {
                for(let z = minZ; z <= maxZ; z++) {
                    block = this.world.getRawValue(x, y, z);
                    if(isColliderIgnored(block)) continue;

                    
                    const collider = getCollider(block);
                    
                    for(const hitbox of collider.entityColliders) {
                        if(!this.collidesWithHitbox(x - offsetX, y - offsetY, z - offsetZ, hitbox, expand)) continue;

                        this.lastBlockCollision.x = x;
                        this.lastBlockCollision.y = y;
                        this.lastBlockCollision.z = z;
                        this.lastBlockCollision.block = block;
                        this.lastBlockCollision.hitbox = hitbox;
                        this.lastBlockCollision.collider = collider;
                        return true;
                    }
                }
            }
        }

        return false;
    }
}