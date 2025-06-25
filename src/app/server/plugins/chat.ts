import { World } from "../../world";
import { UIButton, UIForm, UISection, UIText, UITextInput } from "../../ui";
import { Subscribe } from "../events";
import { PeerJoinEvent, PeerLeaveEvent, PluginEvents } from "../pluginEvents";
import { ServerPeer } from "../serverPeer";
import { ServerPlugin } from "../serverPlugin";

interface ChatMessage {
    peer?: ServerPeer;
    text: string;
}

interface ChatUIInstance {
    peer: ServerPeer;
    root: UISection;
    input: UITextInput;
    logs: UISection;
}

export class ChatPlugin extends ServerPlugin {
    public readonly name = "chat";
    
    private messages: ChatMessage[] = new Array;
    private chatUIs: Map<ServerPeer, ChatUIInstance> = new Map;

    @Subscribe(PluginEvents.PEER_JOIN)
    public onPeerJoin(event: PeerJoinEvent) {
        this.sendMessage({ text: event.peer.username + " joined the game" });


        const chatUI = new UISection;
        chatUI.style.alignSelf = "end";
        chatUI.style.justifySelf = "start";
        chatUI.style.width = "max(16rem, 33vw)";
        chatUI.style.display = "grid";
        chatUI.style.gridTemplateRows = "1fr max-content";
        chatUI.style.overflowY = "hidden";

        const chatLogs = new UISection;
        chatLogs.style.display = "flex";
        chatLogs.style.flexDirection = "column";
        chatLogs.style.wordBreak = "break-word";
        chatLogs.style.overflowY = "auto";

        for(const message of this.messages) {
            const element = this.createTextElement(message);
            chatLogs.addChild(element);
        }

        const chatForm = new UIForm;
        chatForm.style.display = "grid";
        chatForm.style.gridTemplateColumns = "1fr max-content";

        const chatInput = new UITextInput("Send a message to everyone...");
        chatInput.clearOnSubmit = true;
        chatForm.addChild(chatInput);

        const chatSubmit = new UIButton("Send");
        chatForm.addChild(chatSubmit);
        
        chatUI.addChild(chatLogs);
        chatUI.addChild(chatForm);

        chatForm.onSubmit(() => {
            const message: ChatMessage = { peer: event.peer, text: chatInput.value };
            const validated = this.validateMessage(message);
            if(!validated) return;

            if(!this.tryCommand(message)) {
                this.sendMessage(message);
            }
        });

        this.chatUIs.set(event.peer, {
            peer: event.peer,
            root: chatUI,
            input: chatInput,
            logs: chatLogs
        });
        event.peer.showUI(chatUI);
    }
    
    @Subscribe(PluginEvents.PEER_LEAVE)
    public onPeerLeave(event: PeerLeaveEvent) {
        this.sendMessage({ text: event.peer.username + " left the game" });
    }


    private createTextElement(message: ChatMessage) {
        let text = message.text;
        if(message.peer != null) text = message.peer.username + ": " + text;

        const element = new UIText(text);
        return element;
    }
    private validateMessage(message: ChatMessage) {
        if(message.text.replace(/[\s\t\r\n]/g, "").length == 0) return false;
        return true;
    }

    public sendMessageToPeer(peer: ServerPeer, message: string) {
        const chatUI = this.chatUIs.get(peer);
        chatUI.logs.addChild(this.createTextElement({ text: message }));
    }

    private doExplosion(world: World, centerX: number, centerY: number, centerZ: number, power: number) {
        const powerSq = power ** 2;
        for(let dx = -power; dx < power; dx++) for(let dy = -power; dy < power; dy++) for(let dz = -power; dz < power; dz++) {
            if(dx * dx + dy * dy + dz * dz > powerSq) continue;

            world.setBlockStateKey(Math.floor(centerX + dx), Math.floor(centerY + dy), Math.floor(centerZ + dz), "air#default");
        }
    }

    private tryCommand(message: ChatMessage) {
        const world = message.peer.serverPlayer.world;
        const { x, y, z } = message.peer.serverPlayer.base.position;

        if(message.text == "EXPLODE") {
            this.doExplosion(world, x, y, z, 6);
            this.sendMessageToPeer(message.peer, "Boom!!");
            return true;
        }
        if(message.text.startsWith("EXPLODE ")) {
            let severity = message.text.replace("EXPLODE ", "");
            if(isNaN(+severity)) {
                this.sendMessageToPeer(message.peer, " Invalid severity \"" + severity + "\"");
            } else {
                this.doExplosion(world, x, y, z, +severity);
                this.sendMessageToPeer(message.peer, "Boom!!");
            }
            return true;
        }
        return false;
    }
    public sendMessage(message: ChatMessage) {
        this.messages.push(message);

        for(const ui of this.chatUIs.values()) {
            const element = this.createTextElement(message);
            ui.logs.addChild(element);
        }
    }
}