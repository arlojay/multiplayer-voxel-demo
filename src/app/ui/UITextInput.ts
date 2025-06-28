import { BinaryBuffer, BOOL, U8 } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry, UIEvent } from "./UIElement";
import { UIFormContributor } from "./UIForm";

export enum UITextInputType {
    NUMBER,
    TEXT,
    PASSWORD
}

export class UITextInput extends UIElement implements UIFormContributor {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UITextInput.id;

    
    public name: string = "";
    public placeholder: string = "";
    public value: string = "";
    public inputType: UITextInputType = UITextInputType.TEXT;
    public clearOnSubmit = false;

    public constructor(placeholder?: string, value?: string) {
        super();
        if(placeholder != null) this.placeholder = placeholder;
        if(value != null) this.value = value;
    }
    public getFormContributionValue(): string {
        return (this.element as HTMLInputElement)?.value ?? this.value;
    }
    public setFormContributionValue(value: string): void {
        this.value = value;
        if(this.element != null) {
            (this.element as HTMLInputElement).value = value;
        }
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("input");
        element.value = this.value;
        switch (this.inputType) {
            case UITextInputType.NUMBER:
                element.type = "number";
            break;

            case UITextInputType.PASSWORD:
                element.type = "password";
            break;

            case UITextInputType.TEXT:
            default:
                element.type = "text";
            break;
        }
        element.placeholder = this.placeholder;

        element.addEventListener("input", () => {
            this.value = element.value;
        });
        element.addEventListener("keydown", e => {
            if(e.key.toLowerCase() == "enter") {
                this.bubbleEvent(new UIEvent("trysubmit", this));
                e.preventDefault();
            }
        });

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
    public serialize(bin: BinaryBuffer) {
        super.serialize(bin);
        bin.write_string(this.placeholder);
        bin.write_string(this.value);
        bin.write_u8(this.inputType);
        bin.write_boolean(this.clearOnSubmit);
    }
    public deserialize(data: BinaryBuffer): void {
        super.deserialize(data);
        this.placeholder = data.read_string();
        this.value = data.read_string();
        this.inputType = data.read_u8();
        this.clearOnSubmit = data.read_boolean();
    }
    protected getOwnExpectedSize(): number {
        return super.getOwnExpectedSize() + (
            BinaryBuffer.stringByteCount(this.placeholder) +
            BinaryBuffer.stringByteCount(this.value) +
            U8 +
            BOOL
        );
    }
}