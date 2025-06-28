import { UIContainer } from "./UIContainer";
import { UIElementRegistry } from "./UIElement";


export class UISection extends UIContainer {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UISection.id;

    async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");

        await this.appendContainerElements(element);

        return element;
    }
}