import { SerializedUIElement, UIElement, UIEvent } from "./UIElement";

export interface SerializedUIButton extends SerializedUIElement {
    text: string;
}
export class UIButton extends UIElement<SerializedUIButton> {
    public static readonly type = UIElement.register("btn", () => new this);
    public readonly type = UIButton.type;

    
    public text: string = "";

    public constructor(text?: string) {
        super();
        if(text != null) this.text = text;
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("button");
        element.textContent = this.text;

        return element;
    }

    public click() {
        this.eventBinder.call("click");
    }

    public onClick(callback: () => void) {
        this.eventBinder.on("click", (event?: Event) => {
            event?.preventDefault();

            const trySubmit = new UIEvent("trysubmit");
            this.bubbleEvent(trySubmit);
            
            if(!trySubmit.cancelled) {
                callback();
            }
        })
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