import { BSON, Document as BSONDocument } from "bson";
import { Vector3 } from "three";
import { capabilities } from "./capability";

const textEncoder = new TextEncoder;
const textDecoder = new TextDecoder;

export const CHAR = textEncoder.encode("A").byteLength;

export const U8 = 1;
export const I8 = 1;
export const U16 = 2;
export const I16 = 2;
export const F16 = 2;
export const U32 = 4;
export const I32 = 4;
export const F32 = 4;
export const U64 = 8;
export const I64 = 8;
export const F64 = 8;
export const VEC3 = F32 * 3;
export const BOOL = 1;

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

export const MIN_F16 = -65504.0;
export const MAX_F16 = 65504.0;
export const SMALLEST_F16 = 2 ** -24;

export const MIN_F32 = -3.4028234663852886e+38;
export const MAX_F32 = 3.4028234663852886e+38;
export const SMALLEST_F32 = 1.401298464324817e-45;

export const MIN_F64 = -1.7976931348623157e+308;
export const MAX_F64 = 1.7976931348623157e+308;
export const SMALLEST_F64 = 5e-324;


// Polyfill for https://github.com/arlojay/multiplayer-voxel-demo/issues/9
const f16arr = new Float16Array(1);
const u16arr = new Uint16Array(f16arr.buffer);
function F16toU16(float: number) {
    f16arr[0] = float;
    return u16arr[0];
}
function U16toF16(int: number) {
    u16arr[0] = int;
    return f16arr[0];
}


export class BinaryBuffer {
    public buffer: ArrayBuffer;
    public view: DataView<ArrayBuffer>;
    public index: number = 0;
    public littleEndian: boolean = false;
    private array: Uint8Array<ArrayBuffer>;
    public debug = false;

    constructor(buffer: ArrayBuffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer);
        this.array = new Uint8Array(buffer);
    }
    public static bufferByteCount(size: number | ArrayBuffer) {
        if(size == null) throw new TypeError("Cannot get buffer byte count of null buffer (" + size + ")");
        if(size instanceof ArrayBuffer) return size.byteLength + U32;
        return size + U32;
    }
    public static stringByteCount(size: number | string) {
        if(size == null) throw new TypeError("Cannot get string byte count of null buffer (" + size + ")");
        if(typeof size == "string") return size.length + U32;
        return size + U32;
    }
    public static jsonByteCount(data: BSONDocument) {
        if(data == null) throw new TypeError("Cannot get json byte count of null object (" + JSON.stringify(data) + ")");
        return this.bufferByteCount(BSON.serialize(data).buffer as ArrayBuffer); // 🤫...
    }

    public read_u8() {
        if(this.debug) console.log("read u8", this.view.getUint8(this.index));
        return this.view.getUint8((this.index += U8) - U8);
    }
    public write_u8(value: number) {
        if(this.debug) console.log("write u8", value);
        this.view.setUint8((this.index += U8) - U8, value);
    }
    public read_u16() {
        if(this.debug) console.log("read u16", this.view.getUint16(this.index, this.littleEndian));
        return this.view.getUint16((this.index += U16) - U16, this.littleEndian);
    }
    public write_u16(value: number) {
        if(this.debug) console.log("write u16", value);
        this.view.setUint16((this.index += U16) - U16, value, this.littleEndian);
    }
    public read_u32() {
        if(this.debug) console.log("read u32", this.view.getUint32(this.index, this.littleEndian));
        return this.view.getUint32((this.index += U32) - U32, this.littleEndian);
    }
    public write_u32(value: number) {
        if(this.debug) console.log("write u32", value);
        this.view.setUint32((this.index += U32) - U32, value, this.littleEndian);
    }
    public read_u64() {
        if(this.debug) console.log("read u64", this.view.getBigUint64(this.index, this.littleEndian));
        return this.view.getBigUint64((this.index += U64) - U64, this.littleEndian);
    }
    public write_u64(value: bigint) {
        if(this.debug) console.log("write u64", value);
        this.view.setBigUint64((this.index += U64) - U64, value, this.littleEndian);
    }

    public read_i8() {
        if(this.debug) console.log("read i8", this.view.getInt8(this.index));
        return this.view.getInt8((this.index += I8) - I8);
    }
    public write_i8(value: number) {
        if(this.debug) console.log("write i8", value);
        this.view.setInt8((this.index += I8) - I8, value);
    }
    public read_i16() {
        if(this.debug) console.log("read i16", this.view.getInt16(this.index, this.littleEndian));
        return this.view.getInt16((this.index += I16) - I16, this.littleEndian);
    }
    public write_i16(value: number) {
        if(this.debug) console.log("write i16", value);
        this.view.setInt16((this.index += I16) - I16, value, this.littleEndian);
    }
    public read_i32() {
        if(this.debug) console.log("read i32", this.view.getInt32(this.index, this.littleEndian));
        return this.view.getInt32((this.index += I32) - I32, this.littleEndian);
    }
    public write_i32(value: number) {
        if(this.debug) console.log("write i32", value);
        this.view.setInt32((this.index += I32) - I32, value, this.littleEndian);
    }
    public read_i64() {
        if(this.debug) console.log("read i64", this.view.getBigInt64(this.index, this.littleEndian));
        return this.view.getBigInt64((this.index += I64) - I64, this.littleEndian);
    }
    public write_i64(value: bigint) {
        if(this.debug) console.log("write i64", value);
        this.view.setBigInt64((this.index += I64) - I64, value, this.littleEndian);
    }

    public read_f16() {
        if(this.debug) console.log("read f16", this._getFloat16(this.index, this.littleEndian));
        return this._getFloat16((this.index += F16) - F16, this.littleEndian);
    }
    public write_f16(value: number) {
        if(this.debug) console.log("write f16", value);
        this._setFloat16((this.index += F16) - F16, value, this.littleEndian);
    }
    public read_f32() {
        if(this.debug) console.log("read f32", this.view.getFloat32(this.index, this.littleEndian));
        return this.view.getFloat32((this.index += F32) - F32, this.littleEndian);
    }
    public write_f32(value: number) {
        if(this.debug) console.log("write f32", value);
        this.view.setFloat32((this.index += F32) - F32, value, this.littleEndian);
    }
    public read_f64() {
        if(this.debug) console.log("read f64", this.view.getFloat64(this.index, this.littleEndian));
        return this.view.getFloat64((this.index += F64) - F64, this.littleEndian);
    }
    public write_f64(value: number) {
        if(this.debug) console.log("write f64", value);
        this.view.setFloat64((this.index += F64) - F64, value, this.littleEndian);
    }
    
    public read_boolean() {
        if(this.debug) console.log("read boolean", this.view.getUint8(this.index) != 0x00);
        return this.view.getUint8((this.index += U8) - U8) != 0x00;
    }
    public write_boolean(value: boolean) {
        if(this.debug) console.log("write boolean", value);
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
        const text = textDecoder.decode(this.read_buffer());
        if(this.debug) console.log("read string", text);
        return text;
    }
    public write_string(value: string) {
        if(this.debug) console.log("write string", value);
        if(value == null) throw new TypeError("Cannot write null string (" + value + ")");
        this.write_buffer(textEncoder.encode(value));
    }
    public read_seq(length: number) {
        return this.buffer.slice(this.index, this.index += length);
    }
    public write_seq(buffer: ArrayBuffer | Uint8Array) {
        if(buffer == null) throw new TypeError("Cannot write null sequence (" + new Uint8Array(buffer) + ")");
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
        if(chars == null) throw new TypeError("Cannot write null char sequence (" + chars + ")");
        this.write_seq(textEncoder.encode(chars));
    }
    public write_json(data: BSONDocument) {
        if(this.debug) console.log("write json", data);
        if(data == null) throw new TypeError("Cannot write null json (" + JSON.stringify(data) + ")");
        return this.write_buffer(BSON.serialize(data));
    }
    public read_json(): any {
        const object = BSON.deserialize(new Uint8Array(this.read_buffer()));
        if(this.debug) console.log("read json", object);
        return object;
    }

    public write_vec3(vector: Vector3){
        if(vector == null) throw new TypeError("Cannot write null vec3 (" + JSON.stringify(vector) + ")");
        this.write_f32(vector.x);
        this.write_f32(vector.y);
        this.write_f32(vector.z);
    }
    public read_vec3(out = new Vector3) {
        return out.set(
            this.read_f32(),
            this.read_f32(),
            this.read_f32()
        );
    }

    

    // Polyfill for https://github.com/arlojay/multiplayer-voxel-demo/issues/9
    private _getFloat16(index: number, littleEndian: boolean) {
        if(capabilities.DATAVIEW_F16) return this.view.getFloat16(index, littleEndian);
        return U16toF16(this.view.getUint16(index, littleEndian));
    }
    private _setFloat16(index: number, value: number, littleEndian: boolean) {
        if(capabilities.DATAVIEW_F16) return this.view.setFloat16(index, value, littleEndian);
        this.view.setUint16(index, F16toU16(value), littleEndian);
    }
}