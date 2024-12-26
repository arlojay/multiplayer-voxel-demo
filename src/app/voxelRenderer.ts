import { BufferGeometry, Float32BufferAttribute, Int16BufferAttribute } from "three";
import { CHUNK_SIZE, VoxelGrid, VoxelGridChunk } from "./voxelGrid";
import { ColorPalette } from "./colorPalette";

const AIR_BIT = 1 << 15;

export class VoxelRenderer {
    private world: VoxelGrid;

    constructor(world: VoxelGrid) {
        this.world = world;
    }

    public render(chunk: VoxelGridChunk): BufferGeometry {
        const chunkX = chunk.x;
        const chunkY = chunk.y;
        const chunkZ = chunk.z;

        let x = 0, y = 0, z = 0;
        let worldX = 0, worldY = 0, worldZ = 0;
        let colorR = 0, colorG = 0, colorB = 0;
        let block = 0;
        let vertexCount = 0;

        const baseX = chunkX * CHUNK_SIZE;
        const baseY = chunkY * CHUNK_SIZE;
        const baseZ = chunkZ * CHUNK_SIZE;

        const vertices = new Array;
        const indices = new Array;
        const colors = new Array;
        const localPos = new Array;

        // CLOCKWISE WINDING
        for(x = 0, worldX = baseX; x < 16; x++, worldX++) {
            for(z = 0, worldZ = baseZ; z < 16; z++, worldZ++) {
                for(y = 0, worldY = baseY; y < 16; y++, worldY++) {
                    block = this.world.get(worldX, worldY, worldZ);
                    if(!(block & AIR_BIT)) continue;

                    colorR = ((block & 0b0111110000000000) >> 10) / 32;
                    colorG = ((block & 0b0000001111100000) >> 5) / 32;
                    colorB = ((block & 0b0000000000011111) >> 0) / 32;

                    // West
                    if(!(this.world.get(worldX - 1, worldY, worldZ) & AIR_BIT)) {
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
                    if(!(this.world.get(worldX + 1, worldY, worldZ) & AIR_BIT)) {
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
                    if(!(this.world.get(worldX, worldY, worldZ + 1) & AIR_BIT)) {
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
                    if(!(this.world.get(worldX, worldY, worldZ - 1) & AIR_BIT)) {
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
                    if(!(this.world.get(worldX, worldY + 1, worldZ) & AIR_BIT)) {
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
                    if(!(this.world.get(worldX, worldY - 1, worldZ) & AIR_BIT)) {
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
            }
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        geometry.setAttribute("localPos", new Int16BufferAttribute(localPos, 3));
        geometry.setIndex(indices);

        return geometry;
    }
}