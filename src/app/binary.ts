import { BSON, Document as BSONDocument } from "bson";

const textEncoder = new TextEncoder;
const textDecoder = new TextDecoder;

export const CHAR = textEncoder.encode("A").byteLength;

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

export const MIN_U8 = 0;
export const MAX_U8 = 255;
export const SMALLEST_U8 = 1;

export const MIN_I8 = -128;
export const MAX_I8 = 127;
export const SMALLEST_I8 = 1;

export const MIN_U16 = 0;
export const MAX_U16 = 65535;
export const SMALLEST_U16 = 1;

export const MIN_I16 = -32768;
export const MAX_I16 = 32767;
export const SMALLEST_I16 = 1;

export const MIN_U32 = 0;
export const MAX_U32 = 4294967295;
export const SMALLEST_U32 = 1;

export const MIN_I32 = -2147483648;
export const MAX_I32 = 2147483647;
export const SMALLEST_I32 = 1;

export const MIN_U64 = 0n;
export const MAX_U64 = 18446744073709551616n;
export const SMALLEST_U64 = 1n;

export const MIN_I64 = -9223372036854775808n;
export const MAX_I64 = 9223372036854775807n;
export const SMALLEST_I64 = 1n;

export const MIN_F32 = -3.4028234663852886e+38;
export const MAX_F32 = 3.4028234663852886e+38;
export const SMALLEST_F32 = 1.401298464324817e-45;

export const MIN_F64 = -1.7976931348623157e+308;
export const MAX_F64 = 1.7976931348623157e+308;
export const SMALLEST_F64 = 5e-324;


export class BinaryBuffer {
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
    public static jsonByteCount(data: BSONDocument) {
        return this.bufferByteCount(BSON.serialize(data).buffer as ArrayBuffer); // 🤫...
    }

    public read_u8() {
        return this.view.getUint8((this.index += U8) - U8);
    }
    public write_u8(value: number) {
        this.view.setUint8((this.index += U8) - U8, value);
    }
    public read_u16() {
        return this.view.getUint16((this.index += U16) - U16, this.littleEndian);
    }
    public write_u16(value: number) {
        this.view.setUint16((this.index += U16) - U16, value, this.littleEndian);
    }
    public read_u32() {
        return this.view.getUint32((this.index += U32) - U32, this.littleEndian);
    }
    public write_u32(value: number) {
        this.view.setUint32((this.index += U32) - U32, value, this.littleEndian);
    }
    public read_u64() {
        return this.view.getBigUint64((this.index += U64) - U64, this.littleEndian);
    }
    public write_u64(value: bigint) {
        this.view.setBigUint64((this.index += U64) - U64, value, this.littleEndian);
    }

    public read_i8() {
        return this.view.getInt8((this.index += I8) - I8);
    }
    public write_i8(value: number) {
        this.view.setInt8((this.index += I8) - I8, value);
    }
    public read_i16() {
        return this.view.getInt16((this.index += I16) - I16, this.littleEndian);
    }
    public write_i16(value: number) {
        this.view.setInt16((this.index += I16) - I16, value, this.littleEndian);
    }
    public read_i32() {
        return this.view.getInt32((this.index += I32) - I32, this.littleEndian);
    }
    public write_i32(value: number) {
        this.view.setInt32((this.index += I32) - I32, value, this.littleEndian);
    }
    public read_i64() {
        return this.view.getBigInt64((this.index += I64) - I64, this.littleEndian);
    }
    public write_i64(value: bigint) {
        this.view.setBigInt64((this.index += I64) - I64, value, this.littleEndian);
    }

    public read_f32() {
        return this.view.getFloat32((this.index += F32) - F32, this.littleEndian);
    }
    public write_f32(value: number) {
        this.view.setFloat32((this.index += F32) - F32, value, this.littleEndian);
    }
    public read_f64() {
        return this.view.getFloat64((this.index += F64) - F64, this.littleEndian);
    }
    public write_f64(value: number) {
        this.view.setFloat64((this.index += F64) - F64, value, this.littleEndian);
    }
    
    public read_boolean() {
        return this.view.getUint8((this.index += U8) - U8) != 0x00;
    }
    public write_boolean(value: boolean) {
        return this.view.setUint8((this.index += U8) - U8, value ? 0xff : 0x00);
    }

    public read_buffer() {
        const length = this.view.getUint32((this.index += U32) - U32, this.littleEndian);
        return this.buffer.slice(this.index, this.index += length);
    }
    public write_buffer(buffer: ArrayBuffer | Uint8Array) {
        this.view.setUint32(this.index, buffer.byteLength, this.littleEndian);
        if(buffer instanceof Uint8Array) {
            this.array.set(buffer, this.index + U32);
        } else {
            this.array.set(new Uint8Array(buffer), this.index + U32);
        }
        this.index += buffer.byteLength + U32;
    }
    public read_string() {
        return textDecoder.decode(this.read_buffer());
    }
    public write_string(value: string) {
        this.write_buffer(textEncoder.encode(value));
    }
    public read_seq(length: number) {
        return this.buffer.slice(this.index, this.index += length);
    }
    public write_seq(buffer: ArrayBuffer | Uint8Array) {
        if(buffer instanceof Uint8Array) {
            this.array.set(buffer, this.index);
        } else {
            this.array.set(new Uint8Array(buffer), this.index);
        }
        this.index += buffer.byteLength;
    }
    public read_charseq(length: number) {
        return textDecoder.decode(this.read_seq(length * CHAR));
    }
    public write_charseq(chars: string) {
        this.write_seq(textEncoder.encode(chars));
    }
    public write_json(data: BSONDocument) {
        return this.write_buffer(BSON.serialize(data));
    }
    public read_json(): any {
        return BSON.deserialize(new Uint8Array(this.read_buffer()));
    }
}