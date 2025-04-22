export abstract class UIElement {
    public element: HTMLElement;

    constructor() {
        queueMicrotask(() => this.update());
    }
    protected abstract buildElement(): Promise<HTMLElement>;
    protected cleanupElement(element: HTMLElement) {

    }

    public async update() {
        if(this.element != null) {
            this.cleanupElement(this.element);
        }
        const element = await this.buildElement();
        if(element == null) throw new ReferenceError("Built element must not be null");
        this.element = element;
        this.element.replaceWith(element);

        return this.element;
    }
}