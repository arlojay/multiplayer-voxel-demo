import { BinaryBuffer, F32 } from "../serialization/binaryBuffer";
import { UIElement, UIElementRegistry } from "./UIElement";
import { UIFormContributor } from "./UIForm";

export class UISliderInput extends UIElement implements UIFormContributor {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UISliderInput.id;

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
    public getFormContributionValue(): number {
        const value = +(this.element as HTMLInputElement)?.value;
        if(isNaN(value)) return this.value;
        return value;
    }
    public setFormContributionValue(value: any): void {
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

    public serialize(bin: BinaryBuffer) {
        super.serialize(bin);
        bin.write_f32(this.value);
        bin.write_f32(this.min);
        bin.write_f32(this.max);
        bin.write_f32(this.step);
    }
    public deserialize(bin: BinaryBuffer): void {
        super.deserialize(bin);
        this.value = bin.read_f32();
        this.min = bin.read_f32();
        this.max = bin.read_f32();
        this.step = bin.read_f32();
    }
    protected getOwnExpectedSize(): number {
        return (
            super.getOwnExpectedSize() +
            F32 +
            F32 +
            F32 +
            F32
        )
    }
}