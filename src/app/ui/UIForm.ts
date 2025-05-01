import { UIContainer } from "./UIContainer";
import { UIElement } from "./UIElement";

export interface UIFormContributor {
    getFormContributionValue(): string;
    setFormContributionValue(value: string): void;
}
function isUIFormContributor(element: any): element is UIFormContributor {
    return "getFormContributionValue" in element && "setFormContributionValue" in element;
}

export class UIForm extends UIContainer {
    public static type = UIElement.register("frm", () => new this);
    public type = UIForm.type;

    async buildElement(): Promise<HTMLElement> {
        const element = document.createElement("div");

        this.appendContainerElements(element);

        return element;
    }

    public onSubmit(callback: () => void) {
        this.eventBinder.on("submit", (event?: Event) => {
            event?.preventDefault();
            callback();
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

    public handleEvent(event: string, data?: any): void {
        if(event == "trysubmit") {
            this.eventBinder.call("submit");
        }
        super.handleEvent(event, data);
    }
}