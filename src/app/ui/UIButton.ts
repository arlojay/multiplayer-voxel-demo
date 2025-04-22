import { UIElement } from "./UIElement";

export class UIButton extends UIElement {
    public text: string = "";
    private onClickCallback: (event: Event) => void;

    public constructor(text?: string) {
        super();
        if(text != null) this.text = text;
    }

    protected cleanupElement(element: HTMLElement) {
        element.removeEventListener("click", this.onClickCallback);
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("button");
        element.textContent = this.text;
        
        element.addEventListener("click", this.onClickCallback);

        return element;
    }

    public onClick(callback: () => void) {
        const newCallback = (e: Event) => {
            e.preventDefault();
            callback();
        };

        const oldCallback = this.onClickCallback;
        this.onClickCallback = newCallback;

        if(this.element != null) {
            this.element.removeEventListener("click", oldCallback);
            this.element.addEventListener("click", newCallback);
        }
    }
}