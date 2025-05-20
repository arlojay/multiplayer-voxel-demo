import { Box3, Vector3 } from "three";
import { BinaryBuffer, U16 } from "../binary";
import { BufferSerializable, BufferSerializableRegistry } from "../bufferSerializable";
import { CHUNK_INC_SCL } from "../voxelGrid";
import { World } from "../world";
import { LocalEntity } from "./localEntity";
import { RemoteEntity } from "./remoteEntity";

export const entityRegistry = new class EntityRegistry extends BufferSerializableRegistry<
    BaseEntity<any, any, any>,
    ConstructorParameters<typeof BaseEntity<any, any, any>>
> {

}

export abstract class BaseEntity<
    RemoteLogic extends RemoteEntity<RemoteLogic>,
    LocalLogic extends LocalEntity<LocalLogic>,
    Parameters extends ConstructorParameters<any> = []
> extends BufferSerializable {
    public abstract id: number;

    public position = new Vector3;
    public velocity = new Vector3;
    public hitbox: Box3 = new Box3;
    public world: World = null;
    public uuid = crypto.randomUUID();

    protected localLogic: LocalLogic;
    protected remoteLogic: RemoteLogic;
    public isLocal: boolean;
    public update: (dt: number) => void;

    protected abstract instanceLogic(local: boolean): LocalLogic | RemoteLogic;

    public constructor(local: boolean) {
        super();

        this.isLocal = local;
        const logic = this.instanceLogic(local);

        if(logic instanceof LocalEntity) {
            this.localLogic = logic;
        }
        if(logic instanceof RemoteEntity) {
            this.remoteLogic = logic;
        }
        this.update = logic.update;
    }

    public setWorld(world: World) {
        this.world = world;
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