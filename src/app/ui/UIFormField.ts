import { $enum } from "ts-enum-util";
import { BinaryBuffer, BOOL, F32, U8 } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry, UIEvent } from "./UIElement";
import { UIFormContributor } from "./UIForm";

export enum FormFieldInputType {
    TEXT,
    PASSWORD,
    CHECKBOX,
    SLIDER,
    NUMBER
}

export enum UIFormFieldInputSide {
    LEFT, RIGHT
}

export class UIFormField extends UIElement implements UIFormContributor {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UIFormField.id;
    
    public name: string = "";
    public placeholder: string = "";
    public value: string = "";
    public inputType: FormFieldInputType = FormFieldInputType.TEXT;
    public min: number = 0;
    public max: number = 1;
    public step: number = 1;
    public displayValue: boolean;
    public alignment = UIFormFieldInputSide.RIGHT;

    public get checked() {
        return this.value == "on";
    }
    public set checked(checked: boolean) {
        this.value = checked ? "on" : "off";
    }

    public constructor(inputType?: FormFieldInputType, name?: string, value?: string) {
        super();

        if(inputType != null) this.inputType = inputType;
        if(name != null) this.name = name;
        if(value != null) this.value = value;
    }

    public getFormContributionValue(): string {
        if(this.inputType == FormFieldInputType.CHECKBOX) {
            return ((this.element as HTMLInputElement)?.checked ?? this.checked) ? "on" : "off";
        } else {
            return (this.element as HTMLInputElement)?.value ?? this.value;
        }
    }
    public setFormContributionValue(value: string): void {
        this.value = value;
        if(this.element != null) {
            if(this.inputType == FormFieldInputType.CHECKBOX) {
                (this.element as HTMLInputElement).checked = value == "on";
            } else {
                (this.element as HTMLInputElement).value = value;
            }
        }
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");
        const name = crypto.randomUUID();

        element.style.display = "grid";

        const label = document.createElement("label");
        label.htmlFor = name;
        label.textContent = this.name;
        
        const inputText = document.createElement("span");
        inputText.style.width = "3rem";
        inputText.style.display = "inline-block";
        inputText.style.font = "monospace";
        inputText.style.marginLeft = "1ch";

        const updateInputText = () => {
            const value = this.inputType == FormFieldInputType.CHECKBOX ? (this.checked ? "Yes" : "No") : this.value;
            inputText.textContent = "(" + value + ")";
        }
        updateInputText();

        if(this.displayValue) {
            label.appendChild(inputText);
        }
        
        if(this.alignment == UIFormFieldInputSide.LEFT) {
            label.style.marginLeft = "0.5rem";
        } else {
            label.style.marginRight = "0.5rem";
        }

        const input = document.createElement("input");
        if(this.inputType == FormFieldInputType.SLIDER) {
            input.type = "range";
        } else if(this.inputType == FormFieldInputType.TEXT) {
            input.type = "text";
        } else if(this.inputType == FormFieldInputType.PASSWORD) {
            input.type = "password";
        } else if(this.inputType == FormFieldInputType.CHECKBOX) {
            input.type = "checkbox";
        } else if(this.inputType == FormFieldInputType.NUMBER) {
            input.type = "number";
        }
        input.id = name;
        if(this.inputType == FormFieldInputType.CHECKBOX) {
            input.checked = this.checked;
            
            if(this.alignment == UIFormFieldInputSide.LEFT) {
                element.style.gridTemplateColumns = "max-content 1fr";
            } else {
                element.style.gridTemplateColumns = "1fr max-content";
            }
        } else {
            input.value = this.value;

            if(this.alignment == UIFormFieldInputSide.LEFT) {
                element.style.gridTemplateColumns = "1fr max-content";
            } else {
                element.style.gridTemplateColumns = "max-content 1fr";
            }
        }

        if(this.inputType == FormFieldInputType.SLIDER) {
            input.min = this.min.toString();
            input.max = this.max.toString();
            input.step = this.step.toString();
        }

        input.addEventListener("input", () => {
            this.value = input.value;
            updateInputText();
        })
        input.addEventListener("change", () => {
            if(this.inputType != FormFieldInputType.CHECKBOX) return;

            this.checked = input.checked;
            updateInputText();
        })

        if(
            this.inputType == FormFieldInputType.TEXT ||
            this.inputType == FormFieldInputType.PASSWORD ||
            this.inputType == FormFieldInputType.NUMBER
        ) {
            input.addEventListener("keydown", e => {
                if(e.key.toLowerCase() == "enter") {
                    this.bubbleEvent(new UIEvent("trysubmit", this));
                    e.preventDefault();
                }
            });
        }

        if(this.alignment == UIFormFieldInputSide.LEFT) {
            element.append(input, label);
        } else {
            element.append(label, input);
        }

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
    public serialize(bin: BinaryBuffer) {
        super.serialize(bin);
        bin.write_string(this.placeholder);
        bin.write_string(this.value);
        bin.write_u8(this.inputType);
        bin.write_f32(this.min);
        bin.write_f32(this.max);
        bin.write_f32(this.step);
        bin.write_boolean(this.displayValue);
        bin.write_u8(this.alignment);
    }
    public deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.placeholder = bin.read_string();
        this.value = bin.read_string();
        this.inputType = $enum(FormFieldInputType).asValueOrThrow(bin.read_u8());
        this.min = bin.read_f32();
        this.max = bin.read_f32();
        this.step = bin.read_f32();
        this.displayValue = bin.read_boolean();
        this.alignment = $enum(UIFormFieldInputSide).asValueOrThrow(bin.read_u8());
    }
    protected getOwnExpectedSize(): number {
        return super.getOwnExpectedSize() + (
            BinaryBuffer.stringByteCount(this.placeholder) +
            BinaryBuffer.stringByteCount(this.value) +
            U8 +
            F32 +
            F32 +
            F32 +
            BOOL +
            U8
        )
    }
}