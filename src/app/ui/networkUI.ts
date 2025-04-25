import { TypedEmitter } from "tiny-typed-emitter";
import { UIButton } from "./UIButton";
import { SerializedUIContainer, UIContainer } from "./UIContainer";
import { UIElement } from "./UIElement";
import { UIInteractionPacket } from "../packet/packet";

export enum UIInteractions {
    CLICK
}

export class NetworkUI extends TypedEmitter<{
    interaction: (path: number[], interaction: number) => void;
}> {
    public root: UIContainer;
    public id: string;

    public constructor(data: SerializedUIContainer, interfaceId: string) {
        super();

        const deserialized = UIElement.deserialize(data);
        if(!(deserialized instanceof UIContainer)) throw new TypeError("UI root must be a UIContainer");

        this.root = deserialized as UIContainer;
        this.id = interfaceId;

        this.setupUIEvents();
    }

    private setupUIEvents() {
        for(const button of this.root.getAllElementsOfType(UIButton)) {
            const path = this.root.getPathOfElement(button);
            button.onClick(() => {
                this.emit("interaction", path, UIInteractions.CLICK);
            });
        }
    }
}