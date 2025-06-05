export const capabilities = new class {
    REQUEST_POINTER_LOCK = (() => {
        if(!("document" in self)) return false;
        if(!("exitPointerLock" in document)) return false;
    
        const element = document.createElement("canvas");
        if(!("requestPointerLock" in element)) return false;
    
        return true;
    })()
    DATAVIEW_F16 = (() => {
        if(!("Float16Array" in self)) return false;
        
        const array = new Float16Array(1);
        const view = new DataView(array.buffer);

        return ("getFloat16" in view) && ("setFloat16" in view);
    })()
}