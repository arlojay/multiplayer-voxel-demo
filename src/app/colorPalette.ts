import { Color } from "three";

export class ColorPalette {
    private blockColors: Map<number, Color> = new Map;
    constructor() {
        
    }

    public addBlock(block: number, color: Color) {
        this.blockColors.set(block, color);
    }
    public getColors(): Color[] {
        let largestId: number = 0;
        for(const id of this.blockColors.keys()) {
            if(id > largestId) largestId = id;
        }
        
        const colors = new Array(largestId);

        colors.fill(new Color(0xff00ff));
        
        for(const id of this.blockColors.keys()) {
            colors[id] = this.blockColors.get(id);
        }

        return colors;
    }
}