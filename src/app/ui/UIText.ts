import { UIElement } from "./UIElement";

export class UIText extends UIElement {
    public static type = UIElement.register("txt", () => new this);
    public type = UIText.type;

    public text: string = "";

    public constructor(text?: string) {
        super();
        if(text != null) this.text = text;
    }

    protected async buildElement(): Promise<HTMLElement> {
        if(this.element == null) {
            console.trace("create new text element");
            const element = document.createElement("span");
            element.textContent = this.text;

            return element;
        }
        
        this.element.textContent = this.text;
        return this.element;
    }
}