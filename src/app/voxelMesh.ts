import { BufferGeometry, Float32BufferAttribute, Int16BufferAttribute, Int32BufferAttribute, TypedArray, Uint32BufferAttribute } from "three";
import { CHUNK_SIZE, VoxelGrid, VoxelGridChunk } from "./voxelGrid";

const AIR_BIT = 1 << 15;
const chunkCacheBuffer = new Uint16Array((CHUNK_SIZE + 2) ** 3).buffer;
const OFF_X = (CHUNK_SIZE + 2) ** 2;
const OFF_Y = (CHUNK_SIZE + 2) ** 0;
const OFF_Z = (CHUNK_SIZE + 2) ** 1;

const vertexBuffer = new ArrayBuffer((CHUNK_SIZE ** 3) * (4 * 3) * 6);
const indexBuffer = new ArrayBuffer((CHUNK_SIZE ** 3) * (6 * 1) * 6);
const colorBuffer = new ArrayBuffer((CHUNK_SIZE ** 3) * (4 * 3) * 6);
const localPosBuffer = new ArrayBuffer((CHUNK_SIZE ** 3) * (4 * 3) * 6);

export class VoxelMesher {
    private world: VoxelGrid;

    constructor(world: VoxelGrid) {
        this.world = world;
    }

    public mesh(chunk: VoxelGridChunk): BufferGeometry {
        const chunkX = chunk.x;
        const chunkY = chunk.y;
        const chunkZ = chunk.z;

        let x = 0, y = 0, z = 0;
        let i = 0;
        let worldX = 0, worldY = 0, worldZ = 0;
        let colorR = 0, colorG = 0, colorB = 0;
        let block = 0;
        let vertexCount = 0, faceCount = 0;

        const baseX = chunkX * CHUNK_SIZE;
        const baseY = chunkY * CHUNK_SIZE;
        const baseZ = chunkZ * CHUNK_SIZE;

        const vertices = new Float32Array(vertexBuffer);
        const colors = new Float32Array(colorBuffer);
        const localPos = new Float32Array(localPosBuffer);
        const indices = new Uint32Array(indexBuffer);

        const cpy = (array: TypedArray, start: number, count: number, ...values: number[]) => {
            for(let i = 0, j = start; i < count; i++, j++) {
                array[j] = values[i];
            }
        }

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
                    if(!(block & AIR_BIT)) continue;

                    colorR = ((block & 0b0111110000000000) >> 10) / 32;
                    colorG = ((block & 0b0000001111100000) >> 5) / 32;
                    colorB = ((block & 0b0000000000011111) >> 0) / 32;

                    // West
                    if(!(chunkCache[i - OFF_X] & AIR_BIT)) {
                        cpy(vertices, faceCount * 12, 12, 
                            x, y + 1, z,
                            x, y + 1, z + 1,
                            x, y, z + 1,
                            x, y, z
                        );
                        cpy(colors, faceCount * 12, 12,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        cpy(localPos, faceCount * 12, 12,
                            0, 1, 0,
                            0, 1, 1,
                            0, 0, 1,
                            0, 0, 0
                        );
                        cpy(indices, faceCount * 6, 6,
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                        faceCount++;
                    }

                    // East
                    if(!(chunkCache[i + OFF_X] & AIR_BIT)) {
                        cpy(vertices, faceCount * 12, 12,
                            x + 1, y + 1, z + 1,
                            x + 1, y + 1, z,
                            x + 1, y, z,
                            x + 1, y, z + 1
                        );
                        cpy(colors, faceCount * 12, 12,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        cpy(localPos, faceCount * 12, 12,
                            1, 1, 1,
                            1, 1, 0,
                            1, 0, 0,
                            1, 0, 1
                        );
                        cpy(indices, faceCount * 6, 6,
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                        faceCount++;
                    }

                    // North
                    if(!(chunkCache[i + OFF_Z] & AIR_BIT)) {
                        cpy(vertices, faceCount * 12, 12,
                            x, y + 1, z + 1,
                            x + 1, y + 1, z + 1,
                            x + 1, y, z + 1,
                            x, y, z + 1
                        );
                        cpy(colors, faceCount * 12, 12,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        cpy(localPos, faceCount * 12, 12,
                            0, 1, 1,
                            1, 1, 1,
                            1, 0, 1,
                            0, 0, 1
                        );
                        cpy(indices, faceCount * 6, 6,
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                        faceCount++;
                    }

                    // South
                    if(!(chunkCache[i - OFF_Z] & AIR_BIT)) {
                        cpy(vertices, faceCount * 12, 12,
                            x + 1, y + 1, z,
                            x, y + 1, z,
                            x, y, z,
                            x + 1, y, z
                        );
                        cpy(colors, faceCount * 12, 12,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        cpy(localPos, faceCount * 12, 12,
                            1, 1, 0,
                            0, 1, 0,
                            0, 0, 0,
                            1, 0, 0
                        );
                        cpy(indices, faceCount * 6, 6,
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                        faceCount++;
                    }

                    // Up
                    if(!(chunkCache[i + OFF_Y] & AIR_BIT)) {
                        cpy(vertices, faceCount * 12, 12,
                            x, y + 1, z,
                            x + 1, y + 1, z,
                            x + 1, y + 1, z + 1,
                            x, y + 1, z + 1
                        );
                        cpy(colors, faceCount * 12, 12,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        cpy(localPos, faceCount * 12, 12,
                            0, 1, 0,
                            1, 1, 0,
                            1, 1, 1,
                            0, 1, 1
                        );
                        cpy(indices, faceCount * 6, 6,
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                        faceCount++;
                    }

                    // Down
                    if(!(chunkCache[i - OFF_Y] & AIR_BIT)) {
                        cpy(vertices, faceCount * 12, 12,
                            x, y, z + 1,
                            x + 1, y, z + 1,
                            x + 1, y, z,
                            x, y, z
                        );
                        cpy(colors, faceCount * 12, 12,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                            colorR, colorG, colorB,
                        );
                        cpy(localPos, faceCount * 12, 12,
                            0, 0, 1,
                            1, 0, 1,
                            1, 0, 0,
                            0, 0, 0
                        );
                        cpy(indices, faceCount * 6, 6,
                            vertexCount + 2, vertexCount + 1, vertexCount,
                            vertexCount, vertexCount + 3, vertexCount + 2
                        );
                        vertexCount += 4;
                        faceCount++;
                    }
                }
                i += OFF_Z - OFF_Y * 16;
            }
            i += OFF_X - OFF_Z * 16;
        }


        const verticesSliced = new Float32Array(vertices.buffer.slice(0, vertexCount * 12));
        const colorsSliced = new Float32Array(colors.buffer.slice(0, vertexCount * 12));
        const localPosSliced = new Float32Array(localPos.buffer.slice(0, vertexCount * 12));
        const indicesSliced = new Uint32Array(indices.buffer.slice(0, vertexCount * 6));

        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute(verticesSliced, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colorsSliced, 3));
        geometry.setAttribute("localPos", new Float32BufferAttribute(localPosSliced, 3));
        geometry.index = new Uint32BufferAttribute(indicesSliced, 1);

        return geometry;
    }
}