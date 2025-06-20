export interface PackingOptions {
    packArrays?: boolean;
}

function _flatPack(packed: Record<string, any>, prefix: string, object: any, options: PackingOptions) {
    for(const key in object) {
        const value = object[key];

        if(typeof value == "object" && !(!options.packArrays && value instanceof Array)) {
            _flatPack(packed, prefix + key + ".", value, options);
        } else {
            packed[prefix + key] = value;
        }
    }
}
export function flatPack(object: any, options: PackingOptions = {}): any {
    options.packArrays ??= true;
    
    const packed = {};
    _flatPack(packed, "", object, options);
    return packed;
}

function isObjectArray(object: any): object is Record<number, any> {
    return Object.keys(object).map(v => +v).sort((a, b) => a - b).some((v, i) => v != i);
}

function _fixArrays(object: any) {
    for(const key in object) {
        if(typeof object[key] != "object") continue;
        if(object[key] instanceof Array) continue;
        if(object[key] instanceof ArrayBuffer) continue;

        if(isObjectArray(object[key])) {
            _fixArrays(object[key]);
        } else {
            object[key] = Array.from(Object.values(object[key]));
        }
    }
}
export function inflate(packed: any) {
    const object: any = {};

    for(const key in packed) {
        const path = key.split(".");
        const property = path.pop();
        
        let targetField = object;
        for(const element of path) {
            targetField = targetField[element] ??= {};
        }
        targetField[property] = packed[key];
    }

    _fixArrays(object);

    return object;
}