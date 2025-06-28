import { UIElement, UIElementRegistry } from "./UIElement";

export class UISpacer extends UIElement {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UISpacer.id;

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");
        element.style.width = "2em";
        element.style.height = "2em";

        return element;
    }
}