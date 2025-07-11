import { map } from "./math";

export class LoadingScreen {
    public element: HTMLDivElement;
    public visible: boolean;
    
    private titleElement: HTMLHeadingElement;
    private hintElement: HTMLDivElement;
    private stateElement: HTMLParagraphElement;
    private progressElement: HTMLDivElement;
    private progressBarElement: HTMLProgressElement;
    private progressTextElement: HTMLSpanElement;
    private cancelButton: HTMLButtonElement;

    public showHint = false;
    public showProgress = false;
    
    public title = "Loading";
    public hint: string = "";
    public progressMin = 0;
    public progressMax = 100;
    public progressValue = 0;

    public cancellable = true;
    private onCancelCallback: () => void;

    constructor(element: HTMLDivElement) {
        this.element = element;

        this.titleElement = this.element.querySelector("h1");
        this.hintElement = this.element.querySelector(".hint");
        this.stateElement = this.hintElement.querySelector(".state");
        this.progressElement = this.element.querySelector(".progress");
        this.progressBarElement = this.progressElement.querySelector("progress");
        this.progressTextElement = this.progressElement.querySelector("span");
        this.cancelButton = this.element.querySelector(".cancel");

        this.cancelButton.addEventListener("click", () => {
            if(!this.cancellable) return;

            this.onCancelCallback?.();
        });
    }
    public setVisible(visible: boolean) {
        if(visible) this.element.classList.add("visible");
        else this.element.classList.remove("visible");

        this.visible = visible;
    }

    public onCancel(callback: () => void) {
        this.onCancelCallback = callback;
    }

    public setTitle(title: string) {
        this.title = title;
        this.titleElement.textContent = this.title;
    }
    public setCancellable(cancellable: boolean) {
        this.cancellable = cancellable;
        this.cancelButton.hidden = !cancellable;
    }
    public clearHint() {
        this.showHint = false;
        this.stateElement.hidden = true;
    }
    public setHint(text: string) {
        this.showHint = true;
        this.stateElement.hidden = false;
        this.hint = text;

        this.stateElement.textContent = this.hint;
    }
    public clearProgress() {
        this.showProgress = false;
        this.progressElement.hidden = true;
    }
    public setProgress(progress: { min?: number, max?: number, value?: number, undefined?: boolean }) {
        this.showProgress = true;
        this.progressElement.hidden = false;

        if(progress.min != null) this.progressMin = progress.min;
        if(progress.max != null) this.progressMax = progress.max;
        if(progress.value != null) this.progressValue = progress.value;
        
        if(progress.undefined === true) {
            this.progressBarElement.removeAttribute("min");
            this.progressBarElement.removeAttribute("max");
            this.progressBarElement.removeAttribute("value");
            
            this.progressBarElement.textContent = "";
            this.progressTextElement.textContent = "";
        } else {
            this.progressBarElement.setAttribute("min", this.progressMin.toString());
            this.progressBarElement.setAttribute("max", this.progressMax.toString());
            this.progressBarElement.setAttribute("value", this.progressValue.toString());
        
            const percent = Math.round(map(this.progressValue, this.progressMin, this.progressMax, 0, 100)) + "%";
            this.progressBarElement.textContent = percent;
            this.progressTextElement.textContent = percent;
        }
    }
}