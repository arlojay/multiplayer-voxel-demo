import { BlockStateSaveKey } from "./block/blockState";
import { ColorBlock } from "./block/colorBlock";
import { CHUNK_SIZE } from "./voxelGrid";
import { Chunk, World } from "./world";

let logged = false;

export class WorldGenerator {
    public world: World;

    public constructor(world: World) {
        this.world = world;
    }

    public generateChunk(chunk: Chunk) {
        const world = this.world;

        let globalX = chunk.blockX;
        let globalY = chunk.blockY;
        let globalZ = chunk.blockZ;

        const air = world.blockRegistry.getStateType("air#default");
        const stone = world.blockRegistry.getStateType("color#" + ColorBlock.getClosestColor(0x888888) as BlockStateSaveKey);
        const dirt = world.blockRegistry.getStateType("color#" + ColorBlock.getClosestColor(0xCC9966) as BlockStateSaveKey);
        const grass = world.blockRegistry.getStateType("color#" + ColorBlock.getClosestColor(0xBBFF99) as BlockStateSaveKey);

        if(!logged) {
            console.log(air, stone, dirt, grass);
            logged = true;
        }

        for(let x = 0; x < CHUNK_SIZE; x++, globalX++) {
            for(let y = 0; y < CHUNK_SIZE; y++, globalY++) {
                for(let z = 0; z < CHUNK_SIZE; z++, globalZ++) {
                    let color = air;

                    if(globalY < -5) color = stone;
                    else if(globalY < -1) color = dirt;
                    else if(globalY < 0) color = grass;

                    if(color != air) chunk.setBlockState(x, y, z, color.saveKey);
                }
                globalZ -= CHUNK_SIZE;
            }
            globalY -= CHUNK_SIZE;
        }

        return chunk;
    }
}