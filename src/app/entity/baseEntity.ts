import { Box3, Vector3 } from "three";
import { World } from "../world";
import { CHUNK_INC_SCL } from "../voxelGrid";
import { BinaryBuffer, U16 } from "../binary";
import { BufferSerializable, BufferSerializableRegistry } from "../bufferSerializable";
import { LocalEntity } from "./localEntity";
import { RemoteEntity } from "./remoteEntity";

export const entityRegistry = new class EntityRegistry extends BufferSerializableRegistry<BaseEntity<any, any>> {

}

export abstract class BaseEntity<RemoteLogic extends RemoteEntity, LocalLogic extends LocalEntity> extends BufferSerializable {
    public abstract id: number;

    public position = new Vector3;
    public velocity = new Vector3;
    public hitbox: Box3 = new Box3;
    public world: World = null;
    public uuid = crypto.randomUUID();

    protected localLogic: LocalLogic;
    protected remoteLogic: RemoteLogic;

    public constructor(local: boolean) {
        super();

        if(local) {
            const Constructor = this.getLocalLogicConstructor();
            this.localLogic = new Constructor(this);
        } else {
            const Constructor = this.getRemoteLogicConstructor();
            this.remoteLogic = new Constructor(this);
        }
    }

    protected abstract getLocalLogicConstructor(): new (base: this) => LocalLogic;
    protected abstract getRemoteLogicConstructor(): new (base: this) => RemoteLogic;

    public setWorld(world: World) {
        this.world = world;
    }

    public update(dt: number) {
        this.localLogic?.update(dt);
        this.remoteLogic?.update(dt);
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
        return this.getExpectedSize() + U16;
    }

    protected abstract getExpectedSize(): number;
}