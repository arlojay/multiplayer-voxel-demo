import { CloseUIPacket, Packet, OpenUIPacket, UIInteractionPacket } from "../packet";
import { UIInteractions } from "../client/networkUI";
import { ServerPeer } from "./serverPeer";
import { UIButton, UIContainer } from "../ui";
import { $enum } from "ts-enum-util";

export class ServerUI {
    public peer: ServerPeer;
    public ui: UIContainer;
    public interfaceId: string;

    private packetListener: (packet: Packet) => void;

    constructor(peer: ServerPeer, ui: UIContainer) {
        this.peer = peer;
        this.ui = ui;
        this.interfaceId = crypto.randomUUID();

        this.setupUIEvents();
    }

    public open() {
        const packet = new OpenUIPacket(this.ui.serialize(), this.interfaceId);
        this.peer.sendPacket(packet, true);
    }

    public close() {
        const packet = new CloseUIPacket(this.interfaceId);
        this.peer.sendPacket(packet, true);
        this.destroy();
    }

    private setupUIEvents() {
        this.peer.addListener("packet", this.packetListener = (packet: Packet) => {
            if(!(packet instanceof UIInteractionPacket)) return;
            if(packet.interfaceId != this.interfaceId) return;

            const element = this.ui.getElementByPath(packet.path);
            if(element == null) throw new Error("Invalid UI interaction (" + packet.path.join(" ") + " does not exist)");
            
            if(element instanceof UIButton) {
                if(packet.interaction == UIInteractions.CLICK) return element.click();
            }

            throw new Error("Invalid UI interaction (" + element?.constructor?.name + " cannot handle interaction " + $enum(UIInteractions).getKeyOrThrow(packet.interaction) + ")");
        })
    }

    public destroy() {
        this.peer.removeListener("packet", this.packetListener);
    }
}