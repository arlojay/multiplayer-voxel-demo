const transferables = [
    "ArrayBuffer",
    "MessagePort",
    "ReadableStream",
    "WritableStream",
    "TransformStream",
    "AudioData",
    "ImageBitmap",
    "VideoFrame",
    "OffscreenCanvas",
    "RTCDataChannel",
    "MediaSourceHandle",
    "MIDIAccess",
    "MediaStreamTrack"
];

export function getTransferableObjects(object: any): any[] {
    if(object == null || typeof object != "object") return [];

    for(const transferableClass of transferables) {
        const clazz = (self as any)[transferableClass];
        if(clazz == null) continue;

        if(object instanceof clazz) return [object];
    }

    return Object.values(object).map(value => getTransferableObjects(value)).flat();
}