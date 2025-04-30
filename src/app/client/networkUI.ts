import { TypedEmitter } from "tiny-typed-emitter";
import { SerializedUIContainer, UIButton, UIContainer, UIElement, UIForm } from "../ui";

export enum UIInteractions {
    CLICK,
    SUBMIT
}

export class NetworkUI extends TypedEmitter<{
    interaction: (path: number[], interaction: number, data?: any) => void;
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
        for(const form of this.root.getAllElementsOfType(UIForm)) {
            const path = this.root.getPathOfElement(form);
            form.onSubmit(() => {
                const data = form.getData();
                this.emit("interaction", path, UIInteractions.SUBMIT, data);
            });
        }
    }
}