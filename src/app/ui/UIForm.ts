import { UIContainer } from "./UIContainer";
import { UIElement, UIElementRegistry, UIEvent } from "./UIElement";

export interface UIFormContributor {
    getFormContributionValue(): any;
    setFormContributionValue(value: any): void;
}
function isUIFormContributor(element: any): element is UIFormContributor {
    return "getFormContributionValue" in element && "setFormContributionValue" in element;
}

export class UIForm extends UIContainer {
    public static readonly type = UIElementRegistry.register("frm", this);
    public readonly type = UIForm.type;

    async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");

        await this.appendContainerElements(element);

        return element;
    }

    public onSubmit(callback: (data: Record<string, string>) => void) {
        this.eventBinder.on("submit", (event?: Event) => {
            event?.preventDefault();
            callback(this.getData());
            this.percolateEvent(new UIEvent("submit", this));
        });
    }

    public submit(data: Record<string, string>) {
        this.loadData(data);
        this.eventBinder.call("submit");
    }

    public getData(): Record<string, string> {
        const data: Record<string, string> = {};
        for(const element of this.getAllElements()) {
            if(isUIFormContributor(element)) {
                const path = this.getPathOfElement(element).join(".");
                data[path] = element.getFormContributionValue();
            }
        }
        return data;
    }

    public loadData(data: Record<string, string>) {
        for(const element of this.getAllElements()) {
            if(isUIFormContributor(element)) {
                const key = this.getPathOfElement(element).join(".");
                if(key in data) element.setFormContributionValue(data[key]);
            }
        }
    }

    public bubbleEvent(event: UIEvent): void {
        if(event.name == "trysubmit") {
            event.preventDefault();
            this.eventBinder.call("submit");
            return;
        }
        super.bubbleEvent(event);
    }
}