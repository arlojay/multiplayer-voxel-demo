import { CloseUIPacket, Packet, OpenUIPacket, UIInteractionPacket, RemoveUIElementPacket, InsertUIElementPacket } from "../packet";
import { UIInteractions } from "../client/networkUI";
import { ServerPeer } from "./serverPeer";
import { UIButton, UIContainer, UIElement, UIForm } from "../ui";
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
            if(element instanceof UIForm) {
                if(packet.interaction == UIInteractions.CLICK) return element.submit(packet.data);
            }

            throw new Error("Invalid UI interaction (" + element?.constructor?.name + " cannot handle interaction " + $enum(UIInteractions).getKeyOrThrow(packet.interaction) + ")");
        });
        this.ui.setEventHandler("removeElement", (element: UIElement) => {
            const path = this.ui.getPathOfElement(element);
            const packet = new RemoveUIElementPacket(this.interfaceId, path);
            this.peer.sendPacket(packet);
        });
        this.ui.setEventHandler("addElement", (element: UIElement) => {
            const path = this.ui.getPathOfElement(element);
            const packet = new InsertUIElementPacket(this.interfaceId, path, element);
            this.peer.sendPacket(packet);
        });
    }

    public destroy() {
        this.peer.removeListener("packet", this.packetListener);
    }
}