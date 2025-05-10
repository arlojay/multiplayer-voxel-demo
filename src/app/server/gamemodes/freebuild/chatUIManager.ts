import { UIButton, UIForm, UISection, UIText, UITextInput } from "../../../ui";
import { ServerPeer } from "../../serverPeer";

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

export class ChatUIManager {
    private messages: ChatMessage[] = new Array;
    private chatUIs: Map<ServerPeer, ChatUIInstance> = new Map;

    public onPeerJoin(peer: ServerPeer) {
        this.sendMessage({ text: peer.username + " joined the game" });


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
            const message: ChatMessage = { peer, text: chatInput.value };
            const validated = this.validateMessage(message);
            if(!validated) return;

            this.sendMessage(message);
        });

        this.chatUIs.set(peer, {
            peer: peer,
            root: chatUI,
            input: chatInput,
            logs: chatLogs
        });
        peer.showUI(chatUI);
    }

    public onPeerLeave(peer: ServerPeer) {
        this.sendMessage({ text: peer.username + " left the game" });
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

    public sendMessage(message: ChatMessage) {
        this.messages.push(message);

        for(const ui of this.chatUIs.values()) {
            const element = this.createTextElement(message);
            ui.logs.addChild(element);
        }
    }
}