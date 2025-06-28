import { TypedEmitter } from "tiny-typed-emitter";
import { UIButton, UIContainer, UIElement, UIForm, UIGameBlock } from "../ui";
import { BinaryBuffer } from "../serialization/binaryBuffer";

export enum UIInteractions {
    CLICK,
    SUBMIT
}

export class NetworkUI extends TypedEmitter<{
    interaction: (path: number[], interaction: number, data?: any) => void;
}> {
    public root: UIContainer;
    public id: string;

    public constructor(root: UIElement, interfaceId: string) {
        super();

        if(!(root instanceof UIContainer)) throw new TypeError("UI root must be a UIContainer");

        this.root = root as UIContainer;
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
        for(const blockImage of this.root.getAllElementsOfType(UIGameBlock)) {
            const path = this.root.getPathOfElement(blockImage);
            blockImage.onClick(() => {
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
    public updateElement(path: number[], bin: ArrayBuffer) {
        const element = this.root.getElementByPath(path);
        element.deserialize(new BinaryBuffer(bin));
        element.update();
    }
}