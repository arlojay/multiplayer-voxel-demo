import { CHUNK_INC_SCL, CHUNK_SIZE } from "./voxelGrid";
import { World } from "./world";

export class WorldGenerator {
    public world: World;

    public constructor(world: World) {
        this.world = world;
    }

    public generateChunk(x: number, y: number, z: number) {
        const world = this.world;

        const chunk = world.blocks.getChunk(x, y, z);
        let globalX = x << CHUNK_INC_SCL;
        let globalY = y << CHUNK_INC_SCL;
        let globalZ = z << CHUNK_INC_SCL;

        for(let x = 0; x < CHUNK_SIZE; x++, globalX++) {
            for(let y = 0; y < CHUNK_SIZE; y++, globalY++) {
                for(let z = 0; z < CHUNK_SIZE; z++, globalZ++) {
                    let color = 0x000000;

                    if(globalY < -5) color = 0x888888;
                    else if(globalY < -1) color = 0xCC9966;
                    else if(globalY < 0) color = 0xBBFF99;

                    if(color != 0x000000) chunk.set(x, y, z, world.getValueFromColor(color));
                }
                globalZ -= CHUNK_SIZE;
            }
            globalY -= CHUNK_SIZE;
        }

        return chunk;
    }
}