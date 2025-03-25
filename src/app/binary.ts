const textEncoder = new TextEncoder;
const textDecoder = new TextDecoder;


export const U8 = 1;
export const I8 = 1;
export const U16 = 2;
export const I16 = 2;
export const U32 = 4;
export const I32 = 4;
export const F32 = 4;
export const U64 = 8;
export const I64 = 8;
export const F64 = 8;

export class BinaryWriter {
    public buffer: ArrayBuffer;
    public view: DataView<ArrayBuffer>;
    public index: number = 0;
    public littleEndian: boolean = false;
    private array: Uint8Array<ArrayBuffer>;

    constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer);
        this.array = new Uint8Array(buffer);
    }
    public static bufferByteCount(size: number | ArrayBuffer) {
        if(size instanceof ArrayBuffer) return size.byteLength + U32;
        return size + U32;
    }
    public static stringByteCount(size: number | string) {
        if(typeof size == "string") return size.length + U32;
        return size + U32;
    }

    public read_u8() {
        return this.view.getUint8((this.index += 1) - 1);
    }
    public write_u8(value: number) {
        this.view.setUint8((this.index += 1) - 1, value);
    }
    public read_u16() {
        return this.view.getUint16((this.index += 2) - 2, this.littleEndian);
    }
    public write_u16(value: number) {
        this.view.setUint16((this.index += 2) - 2, value, this.littleEndian);
    }
    public read_u32() {
        return this.view.getUint32((this.index += 4) - 4, this.littleEndian);
    }
    public write_u32(value: number) {
        this.view.setUint32((this.index += 4) - 4, value, this.littleEndian);
    }
    public read_u64() {
        return this.view.getBigUint64((this.index += 8) - 8, this.littleEndian);
    }
    public write_u64(value: bigint) {
        this.view.setBigUint64((this.index += 8) - 8, value, this.littleEndian);
    }

    public read_i8() {
        return this.view.getInt8((this.index += 1) - 1);
    }
    public write_i8(value: number) {
        this.view.setInt8((this.index += 1) - 1, value);
    }
    public read_i16() {
        return this.view.getInt16((this.index += 2) - 2, this.littleEndian);
    }
    public write_i16(value: number) {
        this.view.setInt16((this.index += 2) - 2, value, this.littleEndian);
    }
    public read_i32() {
        return this.view.getInt32((this.index += 4) - 4, this.littleEndian);
    }
    public write_i32(value: number) {
        this.view.setInt32((this.index += 4) - 4, value, this.littleEndian);
    }
    public read_i64() {
        return this.view.getBigInt64((this.index += 8) - 8, this.littleEndian);
    }
    public write_i64(value: bigint) {
        this.view.setBigInt64((this.index += 8) - 8, value, this.littleEndian);
    }

    public read_f32() {
        return this.view.getFloat32((this.index += 4) - 4, this.littleEndian);
    }
    public write_f32(value: number) {
        this.view.setFloat32((this.index += 4) - 4, value, this.littleEndian);
    }
    public read_f64() {
        return this.view.getFloat64((this.index += 8) - 8, this.littleEndian);
    }
    public write_f64(value: number) {
        this.view.setFloat64((this.index += 8) - 8, value, this.littleEndian);
    }
    
    public read_boolean() {
        return this.view.getUint8((this.index += 1) - 1) != 0x00;
    }
    public write_boolean(value: boolean) {
        return this.view.setUint8((this.index += 1) - 1, value ? 0xff : 0x00);
    }

    public read_buffer() {
        const length = this.view.getUint32((this.index += 4) - 4, this.littleEndian);
        return this.buffer.slice(this.index, this.index += length);
    }
    public write_buffer(buffer: ArrayBuffer | Uint8Array) {
        this.view.setUint32(this.index, buffer.byteLength, this.littleEndian);
        if(buffer instanceof Uint8Array) {
            this.array.set(buffer, this.index + 4);
        } else {
            this.array.set(new Uint8Array(buffer), this.index + 4);
        }
        this.index += buffer.byteLength + 4;
    }
    public read_string() {
        return textDecoder.decode(this.read_buffer());
    }
    public write_string(value: string) {
        this.write_buffer(textEncoder.encode(value));
    }
}