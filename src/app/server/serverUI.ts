import { $enum } from "ts-enum-util";
import { UIInteractions } from "../client/networkUI";
import { CloseUIPacket, InsertUIElementPacket, InventoryInteractionPacket, OpenUIPacket, Packet, RemoveUIElementPacket, UIInteractionPacket } from "../packet";
import { UpdateUIElementPacket } from "../packet/updateUIElementPacket";
import { UIButton, UIContainer, UIElement, UIEvent, UIForm, UIGameBlock } from "../ui";
import { ServerPeer } from "./serverPeer";

export class ServerUI {
    public peer: ServerPeer;
    public root: UIContainer;
    public interfaceId: string;

    public blocking: boolean = false;
    public spotlight: boolean = false;
    public closable: boolean = false;

    private packetListener: (packet: Packet) => void;
    public opened: boolean = false;

    constructor(peer: ServerPeer, root: UIContainer) {
        this.peer = peer;
        this.root = root;
        this.interfaceId = crypto.randomUUID();

        this.setupUIEvents();
    }

    public open() {
        this.opened = true;
        
        const packet = new OpenUIPacket(this.root, this.interfaceId);
        packet.blocking = this.blocking;
        packet.spotlight = this.spotlight;
        packet.closable = this.closable;
        this.peer.sendPacket(packet, true);
    }

    public close() {
        this.opened = false;

        const packet = new CloseUIPacket(this.interfaceId);
        this.peer.sendPacket(packet, true);
        this.destroy();
    }

    private setupUIEvents() {
        this.peer.addListener("packet", this.packetListener = (packet: Packet) => {
            if(!this.opened) return;

            if(!(packet instanceof UIInteractionPacket)) return;
            if(packet.interfaceId != this.interfaceId) return;

            const element = this.root.getElementByPath(packet.path);
            if(element == null) throw new Error("Invalid UI interaction (" + packet.path.join(" ") + " does not exist)");
            
            if(element instanceof UIButton || element instanceof UIGameBlock) {
                if(packet.interaction == UIInteractions.CLICK) return element.click();
            }
            if(element instanceof UIForm) {
                if(packet.interaction == UIInteractions.SUBMIT) return element.submit(packet.data);
            }

            throw new Error("Invalid UI interaction (" + element?.constructor?.name + " cannot handle interaction " + $enum(UIInteractions).getKeyOrThrow(packet.interaction) + ")");
        });
        this.root.setEventHandler("removeElement", (event: UIEvent) => {
            if(!this.opened) return;

            const element: UIElement = event.data;
            const path = this.root.getPathOfElement(element);
            const packet = new RemoveUIElementPacket(this.interfaceId, path);
            this.peer.sendPacket(packet);
        });
        this.root.setEventHandler("addElement", (event: UIEvent) => {
            if(!this.opened) return;

            const element: UIElement = event.data;
            const path = this.root.getPathOfElement(element);
            const packet = new InsertUIElementPacket(this.interfaceId, path, element);
            this.peer.sendPacket(packet);
        });
        this.root.setEventHandler("updateElement", (event: UIEvent) => {
            if(!this.opened) return;

            const element: UIElement = event.emitter;
            const path = this.root.getPathOfElement(element);
            const packet = new UpdateUIElementPacket(this.interfaceId, path, element);
            this.peer.sendPacket(packet);
        });
    }

    public destroy() {
        this.peer.removeListener("packet", this.packetListener);
    }
}