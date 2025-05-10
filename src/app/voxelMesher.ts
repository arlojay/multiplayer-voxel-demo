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
];

export enum FaceDirection {
    WEST, EAST, SOUTH, NORTH, DOWN, UP
}

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
        let packedao = 0;

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
                        packedao =
                        (np_ + n_n + ((np_ + n_n) == 1 ? 0 : npn)) << 4 |
                        (np_ + n_p + ((np_ + n_p) == 1 ? 0 : npp)) << 6 |
                        (nn_ + n_p + ((nn_ + n_p) == 1 ? 0 : nnp)) << 0 |
                        (nn_ + n_n + ((nn_ + n_n) == 1 ? 0 : nnn)) << 2 |
                        FaceDirection.WEST << 8;

                        vertices.push(
                            x,      y + 1,  z,          color, packedao,
                            x,      y + 1,  z + 1,      color, packedao,
                            x,      y,      z + 1,      color, packedao,
                            x,      y,      z,          color, packedao,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // East
                    if(~chunkCache[i + OFF_X] & SOLID_BITMASK) {
                        packedao =
                        (p_p + pp_ + ((p_p + pp_) != 2 ? ppp : 0)) << 4 |
                        (p_n + pp_ + ((p_n + pp_) != 2 ? ppn : 0)) << 6 |
                        (p_n + pn_ + ((p_n + pn_) != 2 ? pnn : 0)) << 0 |
                        (p_p + pn_ + ((p_p + pn_) != 2 ? pnp : 0)) << 2 |
                        FaceDirection.EAST << 8;

                        vertices.push(
                            x + 1,  y + 1,  z + 1,      color, packedao,
                            x + 1,  y + 1,  z,          color, packedao,
                            x + 1,  y,      z,          color, packedao,
                            x + 1,  y,      z + 1,      color, packedao,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // South
                    if(~chunkCache[i + OFF_Z] & SOLID_BITMASK) {
                        packedao =
                        (n_p + _pp + ((n_p + _pp) == 1 ? 0 : npp)) << 4 |
                        (p_p + _pp + ((p_p + _pp) == 1 ? 0 : ppp)) << 6 |
                        (p_p + _np + ((p_p + _np) == 1 ? 0 : pnp)) << 0 |
                        (n_p + _np + ((n_p + _np) == 1 ? 0 : nnp)) << 2 |
                        FaceDirection.SOUTH << 8;

                        vertices.push(
                            x,      y + 1,  z + 1,      color, packedao,
                            x + 1,  y + 1,  z + 1,      color, packedao,
                            x + 1,  y,      z + 1,      color, packedao,
                            x,      y,      z + 1,      color, packedao,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // North
                    if(~chunkCache[i - OFF_Z] & SOLID_BITMASK) {
                        packedao = 
                        (p_n + _pn + ((p_n + _pn) == 1 ? 0 : ppn)) << 4 |
                        (n_n + _pn + ((n_n + _pn) == 1 ? 0 : npn)) << 6 |
                        (n_n + _nn + ((n_n + _nn) == 1 ? 0 : nnn)) << 0 |
                        (p_n + _nn + ((p_n + _nn) == 1 ? 0 : pnn)) << 2 |
                        FaceDirection.NORTH << 8;

                        vertices.push(
                            x + 1,  y + 1,  z,          color, packedao,
                            x,      y + 1,  z,          color, packedao,
                            x,      y,      z,          color, packedao,
                            x + 1,  y,      z,          color, packedao,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // Up
                    if(~chunkCache[i + OFF_Y] & SOLID_BITMASK) {
                        packedao =
                        (_pn + np_ + (_pn + np_ == 1 ? 0 : npn)) << 4 |
                        (_pn + pp_ + (_pn + pp_ == 1 ? 0 : ppn)) << 6 |
                        (_pp + pp_ + (_pp + pp_ == 1 ? 0 : ppp)) << 0 |
                        (_pp + np_ + (_pp + np_ == 1 ? 0 : npp)) << 2 |
                        FaceDirection.UP << 8;

                        vertices.push(
                            x,      y + 1,  z,          color, packedao,
                            x + 1,  y + 1,  z,          color, packedao,
                            x + 1,  y + 1,  z + 1,      color, packedao,
                            x,      y + 1,  z + 1,      color, packedao,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                    }

                    // Down
                    if(~chunkCache[i - OFF_Y] & SOLID_BITMASK) {
                        packedao =
                        (_np + nn_ + ((_np + nn_) == 1 ? 0 : nnp)) << 4 |
                        (_np + pn_ + ((_np + pn_) == 1 ? 0 : pnp)) << 6 |
                        (_nn + pn_ + ((_nn + pn_) == 1 ? 0 : pnn)) << 0 |
                        (_nn + nn_ + ((_nn + nn_) == 1 ? 0 : nnn)) << 2 |
                        FaceDirection.DOWN << 8;
                        
                        vertices.push(
                            x,      y,      z + 1,      color, packedao,
                            x + 1,  y,      z + 1,      color, packedao,
                            x + 1,  y,      z,          color, packedao,
                            x,      y,      z,          color, packedao,
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
        const interleaved = new InterleavedBuffer(new Float32Array(vertices), 5);
        geometry.setAttribute("position", new InterleavedBufferAttribute(interleaved, 3, 0));
        geometry.setAttribute("blockColor", new InterleavedBufferAttribute(interleaved, 1, 3));
        geometry.setAttribute("ao", new InterleavedBufferAttribute(interleaved, 1, 4));
        geometry.setIndex(indices);

        return geometry;
    }
}