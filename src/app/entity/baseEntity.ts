import { Box3, Scene, Vector3 } from "three";
import { BinaryBuffer, F16, U16 } from "../binary";
import { BufferSerializable, BufferSerializableRegistry } from "../bufferSerializable";
import { CHUNK_INC_SCL } from "../voxelGrid";
import { Chunk, World } from "../world";
import { LocalEntity } from "./localEntity";
import { RemoteEntity } from "./remoteEntity";
import { Server } from "../server/server";

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

export interface EntityComponent {
    serialize(bin: BinaryBuffer): void;
    deserialize(bin: BinaryBuffer): void;
    getExpectedSize(): number;
}

export class EntityRotation implements EntityComponent {
    public pitch = 0;
    public yaw = 0;

    private lastYaw = this.yaw;
    private lastPitch = this.pitch;
    private lastMoveTime = 0;
    
    public serialize(bin: BinaryBuffer): void {
        bin.write_f16(this.pitch);
        bin.write_f16(this.yaw);
    }
    public deserialize(bin: BinaryBuffer): void {
        this.pitch = bin.read_f16();
        this.yaw = bin.read_f16();
    }
    public getExpectedSize(): number {
        return F16 * 2;
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

export abstract class BaseEntity<
    RemoteLogic extends RemoteEntity = RemoteEntity,
    LocalLogic extends LocalEntity = LocalEntity
> extends BufferSerializable {
    public abstract id: number;

    public readonly position = new Vector3;
    public readonly velocity = new Vector3;
    public readonly hitbox: Box3 = new Box3;
    public server: Server = null;
    public world: World = null;
    public uuid: string = crypto.randomUUID();

    public readonly localLogic: LocalLogic;
    public readonly remoteLogic: RemoteLogic;
    public readonly logicType: EntityLogicType;
    public readonly update: (dt: number) => void = () => {};

    protected abstract instanceLogic(local: boolean): LocalLogic | RemoteLogic;

    public constructor(logicType: EntityLogicType) {
        super();

        this.init();

        
        this.logicType = logicType;
        if(logicType != EntityLogicType.NO_LOGIC) {
            const logic = this.instanceLogic(logicType == EntityLogicType.LOCAL_LOGIC);

            if(logic instanceof LocalEntity) {
                this.localLogic = logic;
            }
            if(logic instanceof RemoteEntity) {
                this.remoteLogic = logic;
            }
            this.update = logic.update.bind(logic);
        }
    }

    protected abstract init(): void;

    public setWorld(world: World) {
        this.world = world;
        this.localLogic?.setWorld(world);
        this.remoteLogic?.setWorld(world);
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
        return this.position.x >> CHUNK_INC_SCL;
    }
    public get chunkY() {
        return this.position.y >> CHUNK_INC_SCL;
    }
    public get chunkZ() {
        return this.position.z >> CHUNK_INC_SCL;
    }

    protected abstract serialize(bin: BinaryBuffer): void;
    protected abstract deserialize(bin: BinaryBuffer): void;

    public read(bin: BinaryBuffer) {
        this.deserialize(bin);
    }
    
    public write(bin: BinaryBuffer) {
        bin.write_u16(this.id);
        this.serialize(bin);
    }

    public getBufferSize() {
        return super.getBufferSize() + U16;
    }

    protected abstract getExpectedSize(): number;
}