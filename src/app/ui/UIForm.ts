import { UIContainer } from "./UIContainer";
import { UIElement } from "./UIElement";

export interface FormContribution {
    name: string;
    value: string;
}

export interface UIFormContributor {
    getFormContribution(): FormContribution;
}
function isUIFormContributor(element: any): element is UIFormContributor {
    return "getFormContribution" in element;
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

    public getData(): Record<string, string> {
        const data: Record<string, string> = {};
        for(const element of this.getAllElements()) {
            if(isUIFormContributor(element)) {
                const contribution = element.getFormContribution();
                data[contribution.name] = contribution.value;
            }
        }
        return data;
    }

    public handleEvent(event: string, data?: any): void {
        if(event == "trysubmit") {
            this.eventBinder.call("submit");
        }
        super.handleEvent(event, data);
    }
}