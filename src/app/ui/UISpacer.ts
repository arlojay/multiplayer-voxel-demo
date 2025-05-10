import { UIElement } from "./UIElement";

export class UISpacer extends UIElement {
    public static readonly type = UIElement.register("br", () => new this);
    public readonly type = UISpacer.type;

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");
        element.style.width = "2em";
        element.style.height = "2em";

        return element;
    }
}