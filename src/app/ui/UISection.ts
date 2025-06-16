import { UIContainer } from "./UIContainer";
import { UIElementRegistry } from "./UIElement";


export class UISection extends UIContainer {
    public static readonly type = UIElementRegistry.register("sct", this);
    public readonly type = UISection.type;

    async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");

        await this.appendContainerElements(element);

        return element;
    }
}