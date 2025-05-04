import { TypedEmitter } from "tiny-typed-emitter";
import { SerializedUIElement, UIButton, UIContainer, UIElement, UIForm } from "../ui";

export enum UIInteractions {
    CLICK,
    SUBMIT
}

export class NetworkUI extends TypedEmitter<{
    interaction: (path: number[], interaction: number, data?: any) => void;
}> {
    public root: UIContainer;
    public id: string;

    public constructor(data: SerializedUIElement, interfaceId: string) {
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
            form.onSubmit((data) => {
                this.emit("interaction", path, UIInteractions.SUBMIT, data);
            });
        }
    }

    public removeElement(path: number[]) {
        this.root.removeElementByPath(path);
    }
    public insertElement(path: number[], element: UIElement) {
        this.root.addElementAtPath(path, element);
    }
}