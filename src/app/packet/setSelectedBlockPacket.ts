import { BlockStateSaveKey } from "../block/blockState";
import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class SetSelectedBlockPacket extends Packet {
    public static readonly id = packetRegistry.register(this);
    public readonly id = SetSelectedBlockPacket.id;

    public state: BlockStateSaveKey;

    public constructor(state?: BlockStateSaveKey) {
        super();

        if(state != null) this.state = state;
    }

    protected serialize(bin: BinaryBuffer): void {
        bin.write_string(this.state);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.state = bin.read_string() as BlockStateSaveKey;
    }
    protected getExpectedSize(): number {
        return BinaryBuffer.stringByteCount(this.state);
    }
}