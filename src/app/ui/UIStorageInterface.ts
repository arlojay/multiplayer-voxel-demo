import { capabilities } from "../capability";
import { BinaryBuffer, BOOL } from "../serialization/binaryBuffer";
import { Inventory, StorageSlot } from "../storage/inventory";
import { InventoryMap, StorageLayoutMap } from "../storage/inventoryMap";
import { ItemStack } from "../storage/item";
import { StorageInterface } from "../storage/storageInterface";
import { StorageLayout } from "../storage/storageLayout";
import { DisplayBlockRenderer } from "./displayBlockRenderer";
import { UIElement, UIElementRegistry, UIEvent } from "./UIElement";

function updateStackViewElement(target: HTMLElement, stack: ItemStack) {
    if(stack == null) {
        target.replaceChildren();
    } else {
        const slotItemView = document.createElement("canvas");
        const data = DisplayBlockRenderer.instance.getImage(stack.state.saveKey);
        slotItemView.width = data.width;
        slotItemView.height = data.height;
        slotItemView.getContext("2d").putImageData(data, 0, 0);

        const stackAmount = document.createElement("span");
        stackAmount.textContent = stack.amount + "";

        target.replaceChildren(slotItemView, stackAmount);
    }
}

let movingItemElement: HTMLDivElement;
let tooltipElement: HTMLDivElement;
let mouseX = 0;
let mouseY = 0;

function updateMovingItem(stack: ItemStack) {
    if(movingItemElement == null) {
        movingItemElement = document.createElement("div");
        movingItemElement.classList.add("moving-item");
    }
    updateStackViewElement(movingItemElement, stack);
}
function updateTooltip(text: string) {
    if(tooltipElement == null) {
        tooltipElement = document.createElement("div");
        tooltipElement.classList.add("ui-tooltip");
    }
    tooltipElement.hidden = false;
    tooltipElement.textContent = text;
}
function updateTooltips() {
    if(movingItemElement != null) {
        movingItemElement.style.left = mouseX + "px";
        movingItemElement.style.top = mouseY + "px";
    }
    if(tooltipElement != null) {
        tooltipElement.style.left = mouseX + "px";
        tooltipElement.style.top = mouseY + "px";
    }
}
function handleMouseEvent(event: MouseEvent) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    updateTooltips();
}

if(capabilities.DOCUMENT) {
    document.body.addEventListener("mousemove", event => {
        if(tooltipElement != null) {
            tooltipElement.hidden = true;
        }
        handleMouseEvent(event);
    });
}

export class UIStorageInterface extends UIElement {
    public static readonly id = UIElementRegistry.register(this);
    public readonly id = UIStorageInterface.id;

    public title: string = "Storage";
    public storageInterface: StorageInterface;
    public layout: StorageLayout;

    public inventoryId: string;
    public layoutId: string;
    private slotElements: Map<StorageSlot, HTMLElement> = new Map;

    public constructor();
    public constructor(title: string);
    public constructor(title: string, inventory: Inventory, layout: StorageLayout, movingSlot: StorageSlot);
    public constructor(title?: string, inventory?: Inventory, layout?: StorageLayout, movingSlot?: StorageSlot) {
        super();

        if(title != null) {
            this.title = title;
        }
        if(inventory != null && layout != null && movingSlot != null) {
            this.layoutId = layout.uuid;
            this.layout = layout;

            this.inventoryId = inventory.uuid;
            this.initStorageInterface(inventory, movingSlot);
        }
    }

    protected async buildElement() {
        const root = document.createElement("div");
        root.classList.add("ui-storage-root");

        const storageElement = document.createElement("div");

        storageElement.classList.add("ui-storage");

        const titleElement = document.createElement("div");
        titleElement.textContent = this.title;
        titleElement.classList.add("ui-title");
        storageElement.append(titleElement);

        const contentsElement = document.createElement("div");
        contentsElement.classList.add("ui-contents");

        const cellSize = 64;
        storageElement.style.setProperty("--cellSize", cellSize + "px");

        const bounds = this.layout.getBounds();
        contentsElement.style.width = (bounds.max.x - bounds.min.x) * cellSize + "px";
        contentsElement.style.height = (bounds.max.y - bounds.min.y) * cellSize + "px";

        const movingSlot = this.storageInterface.getMovingSlot();

        const inventorySize = this.layout.slotCount();
        for(let i = 0; i < inventorySize; i++) {
            const slotIndex = i;
            const slot = this.layout.getSlot(slotIndex);
            const inventorySlot = this.storageInterface.getTargetInventory().getSlot(slotIndex);

            const slotElement = document.createElement("div");
            slotElement.classList.add("ui-slot");
            slotElement.style.left = (slot.x - bounds.min.x) * cellSize + "px";
            slotElement.style.top = (slot.y - bounds.min.y) * cellSize + "px";

            this.slotElements.set(inventorySlot, slotElement);

            updateStackViewElement(slotElement, inventorySlot.stack);
            slotElement.addEventListener("mousedown", (event) => {
                if(event.button == 0) {
                    if(movingSlot.isEmpty()) {
                        if(!inventorySlot.isEmpty()) {
                            this.storageInterface.pickUpStack(slotIndex);
                        }
                    } else {
                        if(inventorySlot.isEmpty()) {
                            this.storageInterface.dropStack(slotIndex);
                        } else if(movingSlot.stack.isSameType(inventorySlot.stack)) {
                            this.storageInterface.mergeStack(slotIndex);
                        } else {
                            this.storageInterface.swapStack(slotIndex);
                        }
                    }
                } else if(event.button == 2) {
                    if(movingSlot.isEmpty()) {
                        if(!inventorySlot.isEmpty()) {
                            this.storageInterface.splitStack(slotIndex);
                        }
                    } else {
                        this.storageInterface.dropOne(slotIndex);
                    }
                }
                handleMouseEvent(event);
                if(inventorySlot.isEmpty()) {
                    tooltipElement.hidden = true;
                } else {
                    updateTooltip(inventorySlot.stack.state.saveKey);
                }
            });
            slotElement.addEventListener("contextmenu", event => {
                event.preventDefault();
            })
            slotElement.addEventListener("mousemove", (event) => {
                if(!inventorySlot.isEmpty() && movingSlot.isEmpty()) {
                    event.stopPropagation();

                    updateTooltip(inventorySlot.stack.state.saveKey);
                    handleMouseEvent(event);
                }
            });
            contentsElement.append(slotElement);
        }

        storageElement.append(contentsElement);
        root.append(storageElement);

        updateMovingItem(movingSlot.stack);
        updateTooltip("");
        updateTooltips();
        root.append(movingItemElement);
        root.append(tooltipElement);
        
        return root;
    }
    public loadStorageInterface(inventoryMap: InventoryMap, layoutMap: StorageLayoutMap, movingSlot: StorageSlot) {
        console.log(this.inventoryId, inventoryMap);
        console.log(this.layoutId, layoutMap);

        const inventory = inventoryMap.get(this.inventoryId);
        this.layout = layoutMap.get(this.layoutId);
        this.initStorageInterface(inventory, movingSlot);
    }
    private initStorageInterface(inventory: Inventory, movingSlot: StorageSlot) {
        this.storageInterface = inventory.createInterface(movingSlot);

        this.storageInterface.addListener("update", (slot) => {
            if(this.element == null) return;

            if(slot == movingSlot) {
                updateMovingItem(movingSlot.stack);
            } else {
                updateStackViewElement(this.slotElements.get(slot), slot.stack);
            }
        })
        this.storageInterface.addListener("operation", (slotId, interaction) => {
            this.bubbleEvent(new UIEvent("inventoryinteract", this, { slotId, interaction }));
        });
        this.storageInterface.addListener("updateall", () => {
            this.update();
        })
    }

    public serialize(bin: BinaryBuffer) {
        super.serialize(bin);
        bin.write_string(this.inventoryId);
        bin.write_string(this.layoutId);
        bin.write_string(this.title);
    }
    public deserialize(bin: BinaryBuffer) {
        super.deserialize(bin);
        this.inventoryId = bin.read_string();
        this.layoutId = bin.read_string();
        this.title = bin.read_string();
    }
    protected getOwnExpectedSize(): number {
        return (
            super.getOwnExpectedSize() +
            BinaryBuffer.stringByteCount(this.inventoryId) +
            BinaryBuffer.stringByteCount(this.layoutId) +
            BinaryBuffer.stringByteCount(this.title)
        )
    }
}