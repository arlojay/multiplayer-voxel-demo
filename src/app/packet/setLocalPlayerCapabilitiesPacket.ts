import { Player, PlayerCapabilities } from "../entity/impl";
import { BinaryBuffer } from "../serialization/binaryBuffer";
import { Packet, packetRegistry } from "./packet";

export class SetLocalPlayerCapabilitiesPacket extends Packet {
    static id = packetRegistry.register(this);
    public id = SetLocalPlayerCapabilitiesPacket.id;

    public capabilities = new PlayerCapabilities;

    public constructor(player?: Player) {
        super();

        if(player != null) {
            this.capabilities.copy(player.capabilities);
        }
    }

    protected serialize(bin: BinaryBuffer): void {
        this.capabilities.serialize(bin);
    }
    protected deserialize(bin: BinaryBuffer): void {
        this.capabilities.deserialize(bin);
    }
    protected getOwnExpectedSize(): number {
        return this.capabilities.getExpectedSize();
    }
}