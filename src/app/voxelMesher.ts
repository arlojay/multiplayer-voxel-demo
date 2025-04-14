import { BufferGeometry, Float32BufferAttribute, Int16BufferAttribute } from "three";
import { CHUNK_SIZE, SOLID_BITMASK, VoxelGrid } from "./voxelGrid";
import { Chunk } from "./world";

const chunkCacheBuffer = new Uint16Array((CHUNK_SIZE + 2) ** 3).buffer;
const OFF_X = (CHUNK_SIZE + 2) ** 2;
const OFF_Y = (CHUNK_SIZE + 2) ** 0;
const OFF_Z = (CHUNK_SIZE + 2) ** 1;

export class VoxelMesher {
    private world: VoxelGrid;

    constructor(world: VoxelGrid) {
        this.world = world;
    }

    public mesh(chunk: Chunk): BufferGeometry {
        let x = 0, y = 0, z = 0;
        let i = 0;
        let worldX = 0, worldY = 0, worldZ = 0;
        let colorR = 0, colorG = 0, colorB = 0;
        let block = 0;
        let vertexCount = 0;

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
                    chunkCache[i] = this.world.get(worldX, worldY, worldZ);
                }
            }
        }

        // CLOCKWISE WINDING
        for(x = 0, worldX = baseX, i = OFF_X + OFF_Y + OFF_Z; x < 16; x++, worldX++) {
            for(z = 0, worldZ = baseZ; z < 16; z++, worldZ++) {
                for(y = 0, worldY = baseY; y < 16; y++, worldY++, i++) {
                    block = chunkCache[i];
                    if(~block & SOLID_BITMASK) continue;

                    colorR = ((block & 0b0111110000000000) >> 10) / 32;
                    colorG = ((block & 0b0000001111100000) >> 5) / 32;
                    colorB = ((block & 0b0000000000011111) >> 0) / 32;

                    // West
                    if(~chunkCache[i - OFF_X] & SOLID_BITMASK) {
                        vertices.push(
                            x, y + 1, z,
                            x, y + 1, z + 1,
                            x, y, z + 1,
                            x, y, z
                        );
                        colors.push(
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        localPos.push(
                            0, 1, 0,
                            0, 1, 1,
                            0, 0, 1,
                            0, 0, 0
                        );
                        vertexCount += 4;
                    }

                    // East
                    if(~chunkCache[i + OFF_X] & SOLID_BITMASK) {
                        vertices.push(
                            x + 1, y + 1, z + 1,
                            x + 1, y + 1, z,
                            x + 1, y, z,
                            x + 1, y, z + 1
                        );
                        colors.push(
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        localPos.push(
                            1, 1, 1,
                            1, 1, 0,
                            1, 0, 0,
                            1, 0, 1
                        );
                        vertexCount += 4;
                    }

                    // North
                    if(~chunkCache[i + OFF_Z] & SOLID_BITMASK) {
                        vertices.push(
                            x, y + 1, z + 1,
                            x + 1, y + 1, z + 1,
                            x + 1, y, z + 1,
                            x, y, z + 1
                        );
                        colors.push(
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        localPos.push(
                            0, 1, 1,
                            1, 1, 1,
                            1, 0, 1,
                            0, 0, 1
                        );
                        vertexCount += 4;
                    }

                    // South
                    if(~chunkCache[i - OFF_Z] & SOLID_BITMASK) {
                        vertices.push(
                            x + 1, y + 1, z,
                            x, y + 1, z,
                            x, y, z,
                            x + 1, y, z
                        );
                        colors.push(
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        localPos.push(
                            1, 1, 0,
                            0, 1, 0,
                            0, 0, 0,
                            1, 0, 0
                        );
                        vertexCount += 4;
                    }

                    // Up
                    if(~chunkCache[i + OFF_Y] & SOLID_BITMASK) {
                        vertices.push(
                            x, y + 1, z,
                            x + 1, y + 1, z,
                            x + 1, y + 1, z + 1,
                            x, y + 1, z + 1
                        );
                        colors.push(
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        localPos.push(
                            0, 1, 0,
                            1, 1, 0,
                            1, 1, 1,
                            0, 1, 1
                        );
                        vertexCount += 4;;
                    }

                    // Down
                    if(~chunkCache[i - OFF_Y] & SOLID_BITMASK) {
                        vertices.push(
                            x, y, z + 1,
                            x + 1, y, z + 1,
                            x + 1, y, z,
                            x, y, z
                        );
                        colors.push(
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        indices.push(
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        localPos.push(
                            0, 0, 1,
                            1, 0, 1,
                            1, 0, 0,
                            0, 0, 0
                        );
                        vertexCount += 4;
                    }
                }
                i += OFF_Z - OFF_Y * 16;
            }
            i += OFF_X - OFF_Z * 16;
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("localPos", new Int16BufferAttribute(localPos, 3));
        geometry.setIndex(indices);

        return geometry;
    }
}