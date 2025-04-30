import { SerializedUIElement, UIElement } from "./UIElement";

export interface SerializedUITextInput extends SerializedUIElement {
    placeholder: string;
    value: string;
}
export class UITextInput extends UIElement<SerializedUITextInput> {
    public static type = UIElement.register("itxt", () => new this);
    public type = UITextInput.type;

    
    public placeholder: string = "";
    public value: string = "";

    public constructor(placeholder?: string, value?: string) {
        super();
        if(placeholder != null) this.placeholder = placeholder;
        if(value != null) this.value = value;
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("input");
        element.type = "text";
        element.placeholder = this.placeholder;

        return element;
    }

    public onChange(callback: () => void) {
        this.eventBinder.on("change", (event?: Event) => {
            event?.preventDefault();
            callback();
        });
    }
    public onInput(callback: () => void) {
        this.eventBinder.on("input", (event?: Event) => {
            event?.preventDefault();
            callback();
        });
    }
    public serialize() {
        const data = super.serialize();
        data.placeholder = this.placeholder;
        data.value = this.value;
        return data;
    }
    public deserialize(data: SerializedUITextInput): void {
        super.deserialize(data);
        this.placeholder = data.placeholder;
        this.value = data.value;
    }
}