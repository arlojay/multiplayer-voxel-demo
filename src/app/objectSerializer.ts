export interface SerializableObject {
    deserialize(data: any): void;
    serialize(): any;
}

export class RichSerializedJson {
    private objectTypes: Map<string, () => SerializableObject> = new Map;
    private typeCheckers: Map<string, <T extends SerializableObject>(t: unknown) => t is T> = new Map;

    public register<T extends SerializableObject>(id: string, factory: () => T, typeChecker: <T>(t: unknown) => t is T) {
        this.objectTypes.set(id, factory);
        this.typeCheckers.set(id, typeChecker);
    }

    public serialize(object: any) {
        if(typeof object != "object") {
            return object;
        }
        if(object instanceof Array) {
            const output: any[] = new Array;
            for(const element of object) {
                output.push(this.serialize(element));
            }
            return output;
        }
        
        for(const key in object) {
            for(const registeredName of this.typeCheckers.keys()) {
                const typeChecker = this.typeCheckers.get(registeredName);
                if(typeChecker == null) continue;

                if(typeChecker(key)) {
                    return key.serialize();
                }
            }
        }
    }
}