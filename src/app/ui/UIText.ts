import { UIElement } from "./UIElement";

export class UIText extends UIElement {
    public text: string = "";

    public constructor(text?: string) {
        super();
        if(text != null) this.text = text;
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("span");
        element.textContent = this.text;

        return element;
    }
}