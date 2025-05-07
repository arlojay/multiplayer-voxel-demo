const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);

export function float32ToInt32Bits(v: number): number {
    view.setFloat32(0, v, false);
    return view.getInt32(0, true);
}