import { UUIDMapModifyable } from "../uuidMap";
import { Inventory } from "./inventory";
import { StorageLayout } from "./storageLayout";

export class InventoryMap extends Map<string, Inventory> implements UUIDMapModifyable<Inventory> {
    public static instance: InventoryMap;
    public constructor() {
        super();
    }
    public becomeActiveInstance() {
        InventoryMap.instance = this;
    }
    public add(inventory: Inventory) {
        this.set(inventory.uuid, inventory);
    }
}
export class StorageLayoutMap extends Map<string, StorageLayout> implements UUIDMapModifyable<StorageLayout> {
    public static instance: StorageLayoutMap;
    public constructor() {
        super();
    }
    public becomeActiveInstance() {
        StorageLayoutMap.instance = this;
    }
    public add(storageLayout: StorageLayout) {
        this.set(storageLayout.uuid, storageLayout);
    }
}