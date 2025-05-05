import { BufferGeometry, Float32BufferAttribute, Int16BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute } from "three";
import { AIR_VALUE, CHUNK_SIZE, SOLID_BITMASK, VoxelGrid } from "./voxelGrid";
import { Chunk } from "./world";

const chunkCacheBuffer = new Uint16Array((CHUNK_SIZE + 2) ** 3).buffer;
const OFF_X = (CHUNK_SIZE + 2) ** 2;
const OFF_Y = (CHUNK_SIZE + 2) ** 0;
const OFF_Z = (CHUNK_SIZE + 2) ** 1;

interface CustomMesh {
    
}

const customMeshes = [

];
const castsAO = [
    false
]

export class VoxelMesher {
    private world: VoxelGrid;

    constructor(world: VoxelGrid) {
        this.world = world;
    }

    public mesh(chunk: Chunk): BufferGeometry {
        let x = 0, y = 0, z = 0;
        let i = 0;
        let worldX = 0, worldY = 0, worldZ = 0;
        let color = 0;
        let block = 0;
        let vertexCount = 0;

        let nnn = 0, nnp = 0, npn = 0, npp = 0, pnn = 0, pnp = 0, ppn = 0, ppp = 0;
        let _nn = 0, _np = 0, _pn = 0, _pp = 0;
        let n_n = 0, n_p = 0, p_n = 0, p_p = 0;
        let nn_ = 0, np_ = 0, pn_ = 0, pp_ = 0;

        const baseX = chunk.blockX;
        const baseY = chunk.blockY;
        const baseZ = chunk.blockZ;

        const vertices = new Array;
        const indices = new Array;
        const colors = new Array;
        const localPos = new Array;

        const chunkCache = new Uint16Array(chunkCacheBuffer);

        for(x = -1, i = 0, worldX = baseX - 1, i = 0; x < 17; x++, worldX++) {
            for(z = -1, worldZ = baseZ - 1; z < 17; z++, worldZ++) {
                for(y = -1, worldY = baseY - 1; y < 17; y++, worldY++, i++) {
                    chunkCache[i] = this.world.get(worldX, worldY, worldZ, false); // oh my god this was why
                }
            }
        }

        // CLOCKWISE WINDING
        for(x = 0, worldX = baseX, i = OFF_X + OFF_Y + OFF_Z; x < 16; x++, worldX++) {
            for(z = 0, worldZ = baseZ; z < 16; z++, worldZ++) {
                for(y = 0, worldY = baseY; y < 16; y++, worldY++, i++) {
                    block = chunkCache[i];
                    if(~block & SOLID_BITMASK) continue;

                    color = (~block & SOLID_BITMASK) ? 0b111111111111111 : (block & ~SOLID_BITMASK);

                    nnn = +((chunkCache[i - OFF_X - OFF_Y - OFF_Z] & SOLID_BITMASK) > 0);
                    nnp = +((chunkCache[i - OFF_X - OFF_Y + OFF_Z] & SOLID_BITMASK) > 0);
                    npn = +((chunkCache[i - OFF_X + OFF_Y - OFF_Z] & SOLID_BITMASK) > 0);
                    npp = +((chunkCache[i - OFF_X + OFF_Y + OFF_Z] & SOLID_BITMASK) > 0);
                    pnn = +((chunkCache[i + OFF_X - OFF_Y - OFF_Z] & SOLID_BITMASK) > 0);
                    pnp = +((chunkCache[i + OFF_X - OFF_Y + OFF_Z] & SOLID_BITMASK) > 0);
                    ppn = +((chunkCache[i + OFF_X + OFF_Y - OFF_Z] & SOLID_BITMASK) > 0);
                    ppp = +((chunkCache[i + OFF_X + OFF_Y + OFF_Z] & SOLID_BITMASK) > 0);

                    _nn = +((chunkCache[i - OFF_Y - OFF_Z] & SOLID_BITMASK) > 0);
                    _np = +((chunkCache[i - OFF_Y + OFF_Z] & SOLID_BITMASK) > 0);
                    _pn = +((chunkCache[i + OFF_Y - OFF_Z] & SOLID_BITMASK) > 0);
                    _pp = +((chunkCache[i + OFF_Y + OFF_Z] & SOLID_BITMASK) > 0);

                    n_n = +((chunkCache[i - OFF_X - OFF_Z] & SOLID_BITMASK) > 0);
                    n_p = +((chunkCache[i - OFF_X + OFF_Z] & SOLID_BITMASK) > 0);
                    p_n = +((chunkCache[i + OFF_X - OFF_Z] & SOLID_BITMASK) > 0);
                    p_p = +((chunkCache[i + OFF_X + OFF_Z] & SOLID_BITMASK) > 0);

                    nn_ = +((chunkCache[i - OFF_X - OFF_Y] & SOLID_BITMASK) > 0);
                    np_ = +((chunkCache[i - OFF_X + OFF_Y] & SOLID_BITMASK) > 0);
                    pn_ = +((chunkCache[i + OFF_X - OFF_Y] & SOLID_BITMASK) > 0);
                    pp_ = +((chunkCache[i + OFF_X + OFF_Y] & SOLID_BITMASK) > 0);

                    // West
                    if(~chunkCache[i - OFF_X] & SOLID_BITMASK) {
                        vertices.push(
                            x,      y + 1,  z,          0, 1, 0,    color, (np_ + n_n + npn),
                            x,      y + 1,  z + 1,      0, 1, 1,    color, (np_ + n_p + npp),
                            x,      y,      z + 1,      0, 0, 1,    color, (nn_ + n_p + nnp),
                            x,      y,      z,          0, 0, 0,    color, (nn_ + n_n + nnn),
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // East
                    if(~chunkCache[i + OFF_X] & SOLID_BITMASK) {
                        vertices.push(
                            x + 1,  y + 1,  z + 1,      1, 1, 1,    color, (p_p + pp_ + ppp),
                            x + 1,  y + 1,  z,          1, 1, 0,    color, (p_n + pp_ + ppn),
                            x + 1,  y,      z,          1, 0, 0,    color, (p_n + pn_ + pnn),
                            x + 1,  y,      z + 1,      1, 0, 1,    color, (p_p + pn_ + pnp),
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // South
                    if(~chunkCache[i + OFF_Z] & SOLID_BITMASK) {
                        vertices.push(
                            x,      y + 1,  z + 1,      0, 1, 1,    color, (n_p + _pp + npp),
                            x + 1,  y + 1,  z + 1,      1, 1, 1,    color, (p_p + _pp + ppp),
                            x + 1,  y,      z + 1,      1, 0, 1,    color, (p_p + _np + pnp),
                            x,      y,      z + 1,      0, 0, 1,    color, (n_p + _np + nnp),
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // North
                    if(~chunkCache[i - OFF_Z] & SOLID_BITMASK) {
                        vertices.push(
                            x + 1,  y + 1,  z,          1, 1, 0,    color, (p_n + _pn + ppn),
                            x,      y + 1,  z,          0, 1, 0,    color, (n_n + _pn + npn),
                            x,      y,      z,          0, 0, 0,    color, (n_n + _nn + nnn),
                            x + 1,  y,      z,          1, 0, 0,    color, (p_n + _nn + pnn),
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // Up
                    if(~chunkCache[i + OFF_Y] & SOLID_BITMASK) {
                        vertices.push(
                            x,      y + 1,  z,          0, 1, 0, color, (_pn + np_ + npn),
                            x + 1,  y + 1,  z,          1, 1, 0, color, (_pn + pp_ + ppn),
                            x + 1,  y + 1,  z + 1,      1, 1, 1, color, (_pp + pp_ + ppp),
                            x,      y + 1,  z + 1,      0, 1, 1, color, (_pp + np_ + npp),
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;;
                    }

                    // Down
                    if(~chunkCache[i - OFF_Y] & SOLID_BITMASK) {
                        vertices.push(
                            x,      y,      z + 1,      0, 0, 1, color, (_np + nn_ + nnp),
                            x + 1,  y,      z + 1,      1, 0, 1, color, (_np + pn_ + pnp),
                            x + 1,  y,      z,          1, 0, 0, color, (_nn + pn_ + pnn),
                            x,      y,      z,          0, 0, 0, color, (_nn + nn_ + nnn),
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }
                }
                i += OFF_Z - OFF_Y * 16;
            }
            i += OFF_X - OFF_Z * 16;
        }

        const geometry = new BufferGeometry();
        const interleaved = new InterleavedBuffer(new Float32Array(vertices), 8);
        geometry.setAttribute("position", new InterleavedBufferAttribute(interleaved, 3, 0));
        geometry.setAttribute("localPos", new InterleavedBufferAttribute(interleaved, 3, 3));
        geometry.setAttribute("blockColor", new InterleavedBufferAttribute(interleaved, 1, 6));
        geometry.setAttribute("ao", new InterleavedBufferAttribute(interleaved, 1, 7));
        geometry.setIndex(indices);

        return geometry;
    }
}