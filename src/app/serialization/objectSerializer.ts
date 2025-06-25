export interface RichJsonObject {
    deserialize(data: any): void;
    serialize(): any;
}

export class RichSerializedJson {
    private objectTypes: Map<string, () => RichJsonObject> = new Map;
    private typeCheckers: Map<string, <T extends RichJsonObject>(t: unknown) => t is T> = new Map;

    public register<T extends RichJsonObject>(id: string, factory: () => T, typeChecker: <T>(t: unknown) => t is T) {
        this.objectTypes.set(id, factory);
        this.typeCheckers.set(id, typeChecker);
    }

    public serialize(object: any): any {
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
        
        for(const registeredName of this.typeCheckers.keys()) {
            const typeChecker = this.typeCheckers.get(registeredName);
            if(typeChecker == null) continue;

            if(typeChecker(object)) {
                const data = this.serialize(object.serialize());
                data["$objecttype"] = registeredName;
                return data;
            }
        }

        const output: any = {};
        for(const key in object) {
            output[key] = this.serialize(object[key]);
        }
        return object;
    }

    public deserialize(object: any): any {
        if(typeof object != "object") {
            return object;
        }

        if("$objecttype" in object) {
            const typeName = object["$objecttype"];
            const factory = this.objectTypes.get(typeName);

            if(factory != null) {
                const instance = factory();
                instance.deserialize(object);

                return instance;
            }
        }

        if(object instanceof Array) {
            const output: any[] = new Array;

            for(const element of object) {
                output.push(this.deserialize(element));
            }

            return output;
        }

        const output: any = {};
        for(const key in object) {
            output[key] = this.deserialize(object[key]);
        }
        return object;
    }
}