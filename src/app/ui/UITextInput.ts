import { SerializedUIElement, UIElement, UIEvent } from "./UIElement";
import { UIFormContributor } from "./UIForm";

export interface SerializedUITextInput extends SerializedUIElement {
    placeholder: string;
    value: string;
    clearOnSubmit: boolean;
}
export class UITextInput extends UIElement<SerializedUITextInput> implements UIFormContributor {
    public static type = UIElement.register("itxt", () => new this);
    public type = UITextInput.type;

    
    public name: string = "";
    public placeholder: string = "";
    public value: string = "";
    public clearOnSubmit = false;

    public constructor(placeholder?: string, value?: string) {
        super();
        if(placeholder != null) this.placeholder = placeholder;
        if(value != null) this.value = value;
    }
    getFormContributionValue(): string {
        return (this.element as HTMLInputElement)?.value ?? this.value;
    }
    setFormContributionValue(value: string): void {
        this.value = value;
        if(this.element != null) {
            (this.element as HTMLInputElement).value = value;
        }
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("input");
        element.type = "text";
        element.placeholder = this.placeholder;

        element.addEventListener("input", () => {
            this.value = element.value;
        });
        element.addEventListener("keydown", e => {
            if(e.key.toLowerCase() == "enter") {
                this.bubbleEvent(new UIEvent("trysubmit"));
                e.preventDefault();
            }
        })

        return element;
    }

    public onChange(callback: () => void) {
        this.eventBinder.on("change", (event?: Event) => {
            callback();
        });
    }
    public onInput(callback: () => void) {
        this.eventBinder.on("input", (event?: Event) => {
            callback();
        });
    }
    public percolateEvent(event: UIEvent): void {
        super.percolateEvent(event);
        if(event.name == "submit") {
            if(this.clearOnSubmit) {
                this.value = "";
                if(this.element != null) {
                    (this.element as HTMLInputElement).value = "";
                }
            }
        }
    }
    public serialize() {
        const data = super.serialize();
        data.placeholder = this.placeholder;
        data.value = this.value;
        data.clearOnSubmit = this.clearOnSubmit;
        return data;
    }
    public deserialize(data: SerializedUITextInput): void {
        super.deserialize(data);
        this.placeholder = data.placeholder;
        this.value = data.value;
        this.clearOnSubmit = data.clearOnSubmit;
    }
}