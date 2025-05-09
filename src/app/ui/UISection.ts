import { UIContainer } from "./UIContainer";
import { UIElement } from "./UIElement";


export class UISection extends UIContainer {
    public static readonly type = UIElement.register("sct", () => new this);
    public readonly type = UISection.type;

    async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");

        this.appendContainerElements(element);

        return element;
    }
}