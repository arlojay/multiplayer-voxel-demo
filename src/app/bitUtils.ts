const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);

export function float32ToInt32Bits(v: number): number {
    view.setFloat32(0, v, false);
    return view.getInt32(0, true);
}

const precomputed = new Array(256).fill(0).map((_, i) => i.toString(16).padStart(2, "0"));
export function bufferToHex(buffer: ArrayBuffer) {
    const view = new Uint8Array(buffer);
    let string = "";
    for(let i = 0; i < view.length; i++) {
        string += precomputed[view[i]];
    }
    return string;
}