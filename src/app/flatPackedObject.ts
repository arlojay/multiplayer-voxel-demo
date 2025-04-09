function _flatPack(packed: Record<string, any>, prefix: string, object: any) {
    for(const key in object) {
        const value = object[key];

        if(typeof value == "object") {
            _flatPack(packed, prefix + key + ".", value);
        } else {
            packed[prefix + key] = value;
        }
    }
}
export function flatPack(object: any): any {
    const packed = {};
    _flatPack(packed, "", object);
    return packed;
}

function isObjectArray(object: any) {
    return Object.keys(object).map(v => +v).sort((a, b) => a - b).some((v, i) => v != i);
}

function _fixArrays(object: any) {
    for(const key in object) {
        if(typeof object[key] != "object") continue;
        if(object[key] instanceof Array) continue;

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