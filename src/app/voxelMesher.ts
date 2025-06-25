import { BufferGeometry, Float32BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute } from "three";
import { CHUNK_SIZE } from "./voxelGrid";
import { Chunk, World } from "./world";
import { $enum } from "ts-enum-util";
import { clamp } from "./math";

export enum FaceDirection {
    WEST, EAST, SOUTH, NORTH, DOWN, UP
}
export enum BlockOcclusionType {
    NONE, OPAQUE
}

const chunkCacheBuffer = new Uint16Array((CHUNK_SIZE + 2) ** 3).buffer;
const OFF_X = (CHUNK_SIZE + 2) ** 2;
const OFF_Y = (CHUNK_SIZE + 2) ** 0;
const OFF_Z = (CHUNK_SIZE + 2) ** 1;

export interface CustomVoxelMesh {
    aoCasting: boolean;
    aoReceiving: boolean;
    opaque: boolean;

    cullable: boolean;

    build(mesher: VoxelMesher, vertices: number[], bindata: number[], indices: number[], x: number, y: number, z: number): void;
}

export function packVec2(x: number, y: number) {
    return clamp(x, 0, 0xffff) << 16 | clamp(y, 0, 0xffff);
}

/*
    packed vars; 32 bit uint

    [[ COLOR ]]
    0b  00000000    10101010    01010101    11001100
        UNUSED (8)  RED (8)     GREEN (8)   BLUE (8)
                    \------- VERTEX COLORS --------/

    [[ FACE ]]
    0b  000000000000000000000   110     00  01  10  11
        FACE TYPE / TEXTURE     NORM    TR  TL  Bl  BR
                                        \---- AO ----/

*/

export class VoxelMesher {
    private world: World;

    public vertices: number[];
    public bindata: number[];
    public indices: number[];
    public vertexCount: number;
    public packedFace: [ number, number, number, number, number, number ] = new Uint32Array(6) as unknown as [ number, number, number, number, number, number ];
    public adjacentOcclusionType: [ number, number, number, number, number, number ] = new Uint32Array(6) as unknown as [ number, number, number, number, number, number ];

    constructor(world: World) {
        this.world = world;
    }

    public mesh(chunk: Chunk): BufferGeometry {
        const memoizer = chunk.world.memoizer;

        let x = 0, y = 0, z = 0;
        let i = 0;
        let worldX = 0, worldY = 0, worldZ = 0;
        let block = 0;
        this.vertexCount = 0;

        let nnn = 0, nnp = 0, npn = 0, npp = 0, pnn = 0, pnp = 0, ppn = 0, ppp = 0;
        let _nn = 0, _np = 0, _pn = 0, _pp = 0;
        let n_n = 0, n_p = 0, p_n = 0, p_p = 0;
        let nn_ = 0, np_ = 0, pn_ = 0, pp_ = 0;

        let renderingFaces = 0;
        
        let customMesh = null;
        let doAoCalcs = true;
        let alwaysRender = false;

        const baseX = chunk.blockX;
        const baseY = chunk.blockY;
        const baseZ = chunk.blockZ;

        this.vertices = new Array;
        this.bindata = new Array;
        this.indices = new Array;

        const chunkCache = new Uint16Array(chunkCacheBuffer);

        let extremeX = false, extremeZ = false;
        for(x = -1, i = 0, worldX = baseX - 1, i = 0; x < 17; x++, worldX++) {
            extremeX = x === -1 || x === 16;
            for(z = -1, worldZ = baseZ - 1; z < 17; z++, worldZ++) {
                extremeZ = z === -1 || z === 16;
                for(y = -1, worldY = baseY - 1; y < 17; y++, worldY++, i++) {
                    if(y === -1 || y === 16 || extremeZ || extremeX)
                        chunkCache[i] = this.world.getBlockStateAsMemoizedId(worldX, worldY, worldZ);
                    else
                        chunkCache[i] = chunk.getBlockStateAsMemoizedId(x, y, z);
                }
            }
        }

        // CLOCKWISE WINDING
        for(x = 0, worldX = baseX, i = OFF_X + OFF_Y + OFF_Z; x < 16; x++, worldX++) {
            for(z = 0, worldZ = baseZ; z < 16; z++, worldZ++) {
                for(y = 0, worldY = baseY; y < 16; y++, worldY++, i++) {
                    block = chunkCache[i];

                    if(!memoizer.renderedBlocks[block]) continue;
                    renderingFaces = 0;

                    customMesh = memoizer.customMeshes[block];
                    if(customMesh === null) continue;

                    // doAoCalcs = memoizer.aoReceivingBlocks[block] === 1;
                    alwaysRender = !memoizer.cullableBlocks[block];

                    if(doAoCalcs) {
                        nnn = memoizer.aoContributionAmounts[chunkCache[i - OFF_X - OFF_Y - OFF_Z]];
                        nnp = memoizer.aoContributionAmounts[chunkCache[i - OFF_X - OFF_Y + OFF_Z]];
                        npn = memoizer.aoContributionAmounts[chunkCache[i - OFF_X + OFF_Y - OFF_Z]];
                        npp = memoizer.aoContributionAmounts[chunkCache[i - OFF_X + OFF_Y + OFF_Z]];
                        pnn = memoizer.aoContributionAmounts[chunkCache[i + OFF_X - OFF_Y - OFF_Z]];
                        pnp = memoizer.aoContributionAmounts[chunkCache[i + OFF_X - OFF_Y + OFF_Z]];
                        ppn = memoizer.aoContributionAmounts[chunkCache[i + OFF_X + OFF_Y - OFF_Z]];
                        ppp = memoizer.aoContributionAmounts[chunkCache[i + OFF_X + OFF_Y + OFF_Z]];

                        _nn = memoizer.aoContributionAmounts[chunkCache[i - OFF_Y - OFF_Z]];
                        _np = memoizer.aoContributionAmounts[chunkCache[i - OFF_Y + OFF_Z]];
                        _pn = memoizer.aoContributionAmounts[chunkCache[i + OFF_Y - OFF_Z]];
                        _pp = memoizer.aoContributionAmounts[chunkCache[i + OFF_Y + OFF_Z]];

                        n_n = memoizer.aoContributionAmounts[chunkCache[i - OFF_X - OFF_Z]];
                        n_p = memoizer.aoContributionAmounts[chunkCache[i - OFF_X + OFF_Z]];
                        p_n = memoizer.aoContributionAmounts[chunkCache[i + OFF_X - OFF_Z]];
                        p_p = memoizer.aoContributionAmounts[chunkCache[i + OFF_X + OFF_Z]];

                        nn_ = memoizer.aoContributionAmounts[chunkCache[i - OFF_X - OFF_Y]];
                        np_ = memoizer.aoContributionAmounts[chunkCache[i - OFF_X + OFF_Y]];
                        pn_ = memoizer.aoContributionAmounts[chunkCache[i + OFF_X - OFF_Y]];
                        pp_ = memoizer.aoContributionAmounts[chunkCache[i + OFF_X + OFF_Y]];
                    }

                    // West
                    if(alwaysRender || (this.adjacentOcclusionType[FaceDirection.WEST] = memoizer.blockOcclusionTypes[chunkCache[i - OFF_X]]) === BlockOcclusionType.NONE) {
                        renderingFaces++;
                        
                        this.packedFace[FaceDirection.WEST] = FaceDirection.WEST << 8;
                        if(doAoCalcs) this.packedFace[FaceDirection.WEST] |= 
                        (np_ + n_n + ((np_ + n_n) === 1 ? 0 : npn)) << 2 |
                        (np_ + n_p + ((np_ + n_p) === 1 ? 0 : npp)) << 0 |
                        (nn_ + n_p + ((nn_ + n_p) === 1 ? 0 : nnp)) << 6 |
                        (nn_ + n_n + ((nn_ + n_n) === 1 ? 0 : nnn)) << 4;
                    }

                    // East
                    if(alwaysRender || (this.adjacentOcclusionType[FaceDirection.EAST] = memoizer.blockOcclusionTypes[chunkCache[i + OFF_X]]) === BlockOcclusionType.NONE) {
                        renderingFaces++;
                        
                        this.packedFace[FaceDirection.EAST] = FaceDirection.EAST << 8;
                        if(doAoCalcs) this.packedFace[FaceDirection.EAST] |=
                        (p_p + pp_ + ((p_p + pp_) === 1 ? 0 : ppp)) << 2 |
                        (p_n + pp_ + ((p_n + pp_) === 1 ? 0 : ppn)) << 0 |
                        (p_n + pn_ + ((p_n + pn_) === 1 ? 0 : pnn)) << 6 |
                        (p_p + pn_ + ((p_p + pn_) === 1 ? 0 : pnp)) << 4;
                    }

                    // South
                    if(alwaysRender || (this.adjacentOcclusionType[FaceDirection.SOUTH] = memoizer.blockOcclusionTypes[chunkCache[i + OFF_Z]]) === BlockOcclusionType.NONE) {
                        renderingFaces++;
                        
                        this.packedFace[FaceDirection.SOUTH] = FaceDirection.SOUTH << 8;
                        if(doAoCalcs) this.packedFace[FaceDirection.SOUTH] |=
                        (n_p + _pp + ((n_p + _pp) === 1 ? 0 : npp)) << 2 |
                        (p_p + _pp + ((p_p + _pp) === 1 ? 0 : ppp)) << 0 |
                        (p_p + _np + ((p_p + _np) === 1 ? 0 : pnp)) << 6 |
                        (n_p + _np + ((n_p + _np) === 1 ? 0 : nnp)) << 4;
                    }

                    // North
                    if(alwaysRender || (this.adjacentOcclusionType[FaceDirection.NORTH] = memoizer.blockOcclusionTypes[chunkCache[i - OFF_Z]]) === BlockOcclusionType.NONE) {
                        renderingFaces++;
                        
                        this.packedFace[FaceDirection.NORTH] = FaceDirection.NORTH << 8;
                        if(doAoCalcs) this.packedFace[FaceDirection.NORTH] |=
                        (p_n + _pn + ((p_n + _pn) === 1 ? 0 : ppn)) << 2 |
                        (n_n + _pn + ((n_n + _pn) === 1 ? 0 : npn)) << 0 |
                        (n_n + _nn + ((n_n + _nn) === 1 ? 0 : nnn)) << 6 |
                        (p_n + _nn + ((p_n + _nn) === 1 ? 0 : pnn)) << 4;
                    }

                    // Up
                    if(alwaysRender || (this.adjacentOcclusionType[FaceDirection.UP] = memoizer.blockOcclusionTypes[chunkCache[i + OFF_Y]]) === BlockOcclusionType.NONE) {
                        renderingFaces++;

                        this.packedFace[FaceDirection.UP] = FaceDirection.UP << 8;
                        if(doAoCalcs) this.packedFace[FaceDirection.UP] |=
                        (_pn + np_ + (_pn + np_ === 1 ? 0 : npn)) << 2 |
                        (_pn + pp_ + (_pn + pp_ === 1 ? 0 : ppn)) << 0 |
                        (_pp + pp_ + (_pp + pp_ === 1 ? 0 : ppp)) << 6 |
                        (_pp + np_ + (_pp + np_ === 1 ? 0 : npp)) << 4;
                    }

                    // Down
                    if(alwaysRender || (this.adjacentOcclusionType[FaceDirection.DOWN] = memoizer.blockOcclusionTypes[chunkCache[i - OFF_Y]]) === BlockOcclusionType.NONE) {
                        renderingFaces++;
                        
                        this.packedFace[FaceDirection.DOWN] = FaceDirection.DOWN << 8;
                        if(doAoCalcs) this.packedFace[FaceDirection.DOWN] |=
                        (_np + nn_ + ((_np + nn_) === 1 ? 0 : nnp)) << 2 |
                        (_np + pn_ + ((_np + pn_) === 1 ? 0 : pnp)) << 0 |
                        (_nn + pn_ + ((_nn + pn_) === 1 ? 0 : pnn)) << 6 |
                        (_nn + nn_ + ((_nn + nn_) === 1 ? 0 : nnn)) << 4;
                    }

                    if(renderingFaces > 0) {
                        customMesh.build(this, this.vertices, this.bindata, this.indices, x, y, z);
                    }
                }
                i += OFF_Z - OFF_Y * 16;
            }
            i += OFF_X - OFF_Z * 16;
        }

        const geometry = new BufferGeometry();
        const interleaved = new InterleavedBuffer(new Uint32Array(this.bindata), 4);
        geometry.setAttribute("position", new Float32BufferAttribute(this.vertices, 3));
        geometry.setAttribute("color", new InterleavedBufferAttribute(interleaved, 1, 0));
        geometry.setAttribute("face", new InterleavedBufferAttribute(interleaved, 1, 1));
        geometry.setAttribute("fpos", new InterleavedBufferAttribute(interleaved, 1, 2));
        geometry.setAttribute("uv", new InterleavedBufferAttribute(interleaved, 1, 3));
        geometry.setIndex(this.indices);

        return geometry;
    }
}