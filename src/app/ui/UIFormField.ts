import { SerializedUIElement, UIElement, UIEvent } from "./UIElement";
import { UIFormContributor } from "./UIForm";

type FormFieldInputType = "text" | "password" | "checkbox" | "slider" | "number";

interface SerializedUIFormField extends SerializedUIElement {
    placeholder: string;
    value: string;
    inputType: FormFieldInputType;
    clearOnSubmit: boolean;
    min: number;
    max: number;
    step: number;
    align: UIFormFieldInputSide;
}

export enum UIFormFieldInputSide {
    LEFT, RIGHT
}

export class UIFormField extends UIElement<SerializedUIFormField> implements UIFormContributor {
    public static readonly type = UIElement.register("ff", () => new this);
    public readonly type = UIFormField.type;
    
    public name: string = "";
    public placeholder: string = "";
    public value: string = "";
    public inputType: FormFieldInputType = "text";
    public min: number = 0;
    public max: number = 1;
    public step: number = 1;
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

    getFormContributionValue(): string {
        if(this.inputType == "checkbox") {
            return ((this.element as HTMLInputElement)?.checked ?? this.checked) ? "on" : "off";
        } else {
            return (this.element as HTMLInputElement)?.value ?? this.value;
        }
    }
    setFormContributionValue(value: string): void {
        this.value = value;
        if(this.element != null) {
            if(this.inputType == "checkbox") {
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
        
        if(this.alignment == UIFormFieldInputSide.LEFT) {
            label.style.marginLeft = "0.5rem";
        } else {
            label.style.marginRight = "0.5rem";
        }

        const input = document.createElement("input");
        input.type = this.inputType;
        input.id = name;
        if(this.inputType == "checkbox") {
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

        input.addEventListener("input", () => {
            this.value = input.value;
        })
        input.addEventListener("change", () => {
            if(this.inputType != "checkbox") return;

            this.checked = input.checked;
        })

        if(this.inputType == "text" || this.inputType == "password" || this.inputType == "number") {
            input.addEventListener("keydown", e => {
                if(e.key.toLowerCase() == "enter") {
                    this.bubbleEvent(new UIEvent("trysubmit"));
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
    public serialize() {
        const data = super.serialize();
        data.placeholder = this.placeholder;
        data.value = this.value;
        data.inputType = this.inputType;
        data.min = this.min;
        data.max = this.max;
        data.step = this.step;
        data.align = this.alignment;
        return data;
    }
    public deserialize(data: SerializedUIFormField): void {
        super.deserialize(data);
        this.placeholder = data.placeholder;
        this.value = data.value;
        this.inputType = data.inputType;
        this.min = data.min;
        this.max = data.max;
        this.step = data.step;
        this.alignment = data.align;
    }
}