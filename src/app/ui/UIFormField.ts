import { SerializedUIElement, UIElement, UIElementRegistry, UIEvent } from "./UIElement";
import { UIFormContributor } from "./UIForm";

type FormFieldInputType = "text" | "password" | "checkbox" | "slider" | "number";

interface SerializedUIFormField extends SerializedUIElement {
    ptext: string;
    value: string;
    inType: FormFieldInputType;
    clearOnSubmit: boolean;
    min: number;
    max: number;
    step: number;
    disp: boolean;
    align: UIFormFieldInputSide;
}

export enum UIFormFieldInputSide {
    LEFT, RIGHT
}

export class UIFormField extends UIElement<SerializedUIFormField> implements UIFormContributor {
    public static readonly type = UIElementRegistry.register("ff", this);
    public readonly type = UIFormField.type;
    
    public name: string = "";
    public placeholder: string = "";
    public value: string = "";
    public inputType: FormFieldInputType = "text";
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
        if(this.inputType == "checkbox") {
            return ((this.element as HTMLInputElement)?.checked ?? this.checked) ? "on" : "off";
        } else {
            return (this.element as HTMLInputElement)?.value ?? this.value;
        }
    }
    public setFormContributionValue(value: string): void {
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
        
        const inputText = document.createElement("span");
        inputText.style.width = "3rem";
        inputText.style.display = "inline-block";
        inputText.style.font = "monospace";
        inputText.style.marginLeft = "1ch";

        const updateInputText = () => {
            const value = this.inputType == "checkbox" ? (this.checked ? "Yes" : "No") : this.value;
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
        input.type = this.inputType == "slider" ? "range" : this.inputType;
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

        if(this.inputType == "slider") {
            input.min = this.min.toString();
            input.max = this.max.toString();
            input.step = this.step.toString();
        }

        input.addEventListener("input", () => {
            this.value = input.value;
            updateInputText();
        })
        input.addEventListener("change", () => {
            if(this.inputType != "checkbox") return;

            this.checked = input.checked;
            updateInputText();
        })

        if(this.inputType == "text" || this.inputType == "password" || this.inputType == "number") {
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
    public serialize() {
        const data = super.serialize();
        data.ptext = this.placeholder;
        data.value = this.value;
        data.inType = this.inputType;
        data.min = this.min;
        data.max = this.max;
        data.step = this.step;
        data.disp = this.displayValue;
        data.align = this.alignment;
        return data;
    }
    public deserialize(data: SerializedUIFormField): void {
        super.deserialize(data);
        this.placeholder = data.ptext;
        this.value = data.value;
        this.inputType = data.inType;
        this.min = data.min;
        this.max = data.max;
        this.step = data.step;
        this.displayValue = data.disp;
        this.alignment = data.align;
    }
}