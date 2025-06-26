import { Box3, Vector3 } from "three";
import { $enum } from "ts-enum-util";
import { BinaryBuffer, F32, U16, VEC3 } from "../serialization/binaryBuffer";
import { BufferSerializable, BufferSerializableRegistry } from "../serialization/bufferSerializable";
import { Server } from "../server/server";
import { CHUNK_SIZE } from "../world/voxelGrid";
import { World } from "../world/world";
import { LocalEntity } from "./localEntity";
import { RemoteEntity } from "./remoteEntity";

export const entityRegistry = new class EntityRegistry extends BufferSerializableRegistry<
    BaseEntity,
    ConstructorParameters<typeof BaseEntity>
> {

}

export enum EntityLogicType {
    LOCAL_LOGIC,
    REMOTE_LOGIC,
    NO_LOGIC
}

export interface EntityComponent<Implementer extends EntityComponent<Implementer>> {
    copy(other: Implementer): void;
    serialize(bin: BinaryBuffer): void;
    deserialize(bin: BinaryBuffer): void;
    getExpectedSize(): number;
}

export class EntityRotation implements EntityComponent<EntityRotation> {
    public pitch = 0;
    public yaw = 0;

    private lastYaw = this.yaw;
    private lastPitch = this.pitch;
    private lastMoveTime = 0;

    public copy(other: EntityRotation): void {
        this.pitch = other.pitch;
        this.yaw = other.yaw;
    }
    
    public serialize(bin: BinaryBuffer): void {
        bin.write_f32(this.pitch);
        bin.write_f32(this.yaw);
    }
    public deserialize(bin: BinaryBuffer): void {
        this.pitch = bin.read_f32();
        this.yaw = bin.read_f32();
    }
    public getExpectedSize(): number {
        return F32 * 2;
    }
    
    public hasMovedSince(time: number) {
        if(time == this.lastMoveTime) return true;
        
        let moved = false;
        if(this.yaw != this.lastYaw) {
            this.lastYaw = this.yaw;
            moved = true;
        }
        if(this.pitch != this.lastPitch) {
            this.lastPitch = this.pitch;
            moved = true;
        }
        if(moved) {
            this.lastMoveTime = time;
        } else {
            this.lastMoveTime = 0;
        }
        return moved;
    }
}

export interface RotatingEntity {
    rotation: EntityRotation;
}
export function instanceof_RotatingEntity(object: any): object is RotatingEntity {
    return "rotation" in object;
}

export abstract class BaseEntity<
    RemoteLogic extends RemoteEntity = RemoteEntity,
    LocalLogic extends LocalEntity = LocalEntity
> extends BufferSerializable {
    public abstract readonly id: number;

    public readonly position = new Vector3(0, 0, 0);
    public readonly velocity = new Vector3(0, 0, 0);
    public readonly acceleration = new Vector3(0, 0, 0);
    public readonly drag = new Vector3(0.1, 0.1, 0.1);
    public readonly hitbox: Box3 = new Box3;
    public server: Server = null;
    public world: World = null;
    public uuid: string = crypto.randomUUID();
    public hasUpdated = false;
    public updates = 0;
    public lifeTime = 0;

    public readonly localLogic: LocalLogic;
    public readonly remoteLogic: RemoteLogic;
    public readonly logicType: EntityLogicType;
    public readonly update: (dt: number) => void = () => {};

    protected abstract instanceLogic(local: boolean): LocalLogic | RemoteLogic;

    /** do NOT override */
    public constructor(logicType: EntityLogicType) {
        super();
        
        this.logicType = logicType;
        if(logicType != EntityLogicType.NO_LOGIC) {
            const logic = this.instanceLogic(logicType == EntityLogicType.LOCAL_LOGIC);

            const invalidTypeMessage = "Wrong logic type returned from instanceLogic (expected " + $enum(EntityLogicType).getKeyOrThrow(logicType) + " instance, got " + logic.constructor?.name + ")";
            if(logic instanceof LocalEntity) {
                if(logicType != EntityLogicType.LOCAL_LOGIC) throw new TypeError(invalidTypeMessage);
                this.localLogic = logic;
            }
            if(logic instanceof RemoteEntity) {
                if(logicType != EntityLogicType.REMOTE_LOGIC) throw new TypeError(invalidTypeMessage);
                this.remoteLogic = logic;
            }
            this.update = logic.update.bind(logic);
        }
    }

    public setWorld(world: World) {
        this.world = world;
        this.localLogic?.setWorld(world);
        this.remoteLogic?.setWorld(world);
    }

    public sendNetworkUpdate() {
        if(this.server != null) {
            this.server.broadcastUpdateEntity(this);
        }
    }

    public sendMovementUpdate(teleport = true) {
        if(this.server != null) {
            this.server.updateEntityLocation(this, this.server.time, false, teleport);
        }
    }

    public remove() {
        if(this.world == null) throw new ReferenceError("Entity already removed from world");
        this.world.removeEntity(this);
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

    protected abstract serialize(bin: BinaryBuffer): void;
    protected abstract deserialize(bin: BinaryBuffer): void;

    public read(bin: BinaryBuffer) {
        this.uuid = bin.read_string();
        bin.read_vec3(this.position);
        bin.read_vec3(this.velocity);
        bin.read_vec3(this.acceleration);
        bin.read_vec3(this.drag);
        this.deserialize(bin);
    }
    
    public write(bin: BinaryBuffer) {
        bin.write_u16(this.id);
        bin.write_string(this.uuid);
        bin.write_vec3(this.position);
        bin.write_vec3(this.velocity);
        bin.write_vec3(this.acceleration);
        bin.write_vec3(this.drag);
        this.serialize(bin);
    }

    public allocateExtraDataBuffer() {
        return new ArrayBuffer(this.getExpectedSize());
    }
    public writeExtraData(bin: BinaryBuffer) {
        this.serialize(bin);
    }
    public readExtraData(bin: BinaryBuffer) {
        this.deserialize(bin);
    }

    public getBufferSize() {
        return super.getBufferSize() + BinaryBuffer.stringByteCount(this.uuid) + VEC3 + VEC3 + VEC3 + VEC3 + U16;
    }

    protected abstract getExpectedSize(): number;
}