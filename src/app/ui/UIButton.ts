import { SerializedUIElement, UIElement } from "./UIElement";

export interface SerializedUIButton extends SerializedUIElement {
    text: string;
}
export class UIButton extends UIElement<SerializedUIButton> {
    public static type = UIElement.register("btn", () => new this);
    public type = UIButton.type;

    
    public text: string = "";
    private onClickCallback: (event?: Event) => void;

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

    public click() {
        this.onClickCallback();
    }

    public onClick(callback: () => void) {
        const newCallback = (event?: Event) => {
            if(event != null) event.preventDefault();
            callback();
        };

        const oldCallback = this.onClickCallback;
        this.onClickCallback = newCallback;

        if(this.element != null) {
            this.element.removeEventListener("click", oldCallback);
            this.element.addEventListener("click", newCallback);
        }
    }
    public serialize() {
        const data = super.serialize();
        data.text = this.text;
        return data;
    }
    public deserialize(data: SerializedUIButton): void {
        super.deserialize(data);
        this.text = data.text;
    }
}