import { SerializedUIElement, UIElement, UIElementRegistry } from "./UIElement";
import { UIFormContributor } from "./UIForm";

export interface SerializedUISliderInput extends SerializedUIElement {
    value: number;
    min: number;
    max: number;
    step: number;
}
export class UISliderInput extends UIElement<SerializedUISliderInput> implements UIFormContributor {
    public static readonly type = UIElementRegistry.register("sldr", this);
    public readonly type = UISliderInput.type;

    public value: number = 0;
    public min: number = 0;
    public max: number = 1;
    public step: number = 1;

    public constructor(value?: number, min?: number, max?: number, step?: number) {
        super();
        if(value != null) this.value = value;
        if(min != null) this.min = min;
        if(max != null) this.max = max;
        if(step != null) this.step = step;
    }
    getFormContributionValue(): number {
        const value = +(this.element as HTMLInputElement)?.value;
        if(isNaN(value)) return this.value;
        return value;
    }
    setFormContributionValue(value: any): void {
        value = +value;
        if(isNaN(value)) return;

        this.value = value;
        if(this.element != null) {
            (this.element as HTMLInputElement).value = this.value + "";
        }
    }

    protected async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("input");
        element.type = "range";
        element.value = this.value + "";
        element.min = this.min + "";
        element.max = this.max + "";
        element.step = this.step + "";

        element.addEventListener("input", () => {
            const value = +element.value;
            if(isNaN(value)) return;
            this.value = value;
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
    public serialize() {
        const data = super.serialize();
        data.value = this.value;
        data.min = this.min;
        data.max = this.max;
        data.step = this.step;
        return data;
    }
    public deserialize(data: SerializedUISliderInput): void {
        super.deserialize(data);
        this.value = data.value;
        this.min = data.min;
        this.max = data.max;
        this.step = data.step;
    }
}