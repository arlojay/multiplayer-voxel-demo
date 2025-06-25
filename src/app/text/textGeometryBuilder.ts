import { BufferGeometry, Float32BufferAttribute, Uint8BufferAttribute } from "three";
import { ColorRGBA } from "../client/floatingText";
import { AtlasGlyph, TextGlyphAtlas } from "./textGlyphAtlas";

export class TextGeometryBuilder {
    public readonly atlas: TextGlyphAtlas;

    private positionBuffer: number[];
    private indexBuffer: number[];
    private uvBuffer: number[];
    private textColorBuffer: number[];
    private backgroundColorBuffer: number[];
    
    private index: number;
    private xOffset: number;

    private currentTextColor: ColorRGBA;
    private currentBackgroundColor: ColorRGBA;

    constructor(atlas: TextGlyphAtlas) {
        this.atlas = atlas;
    }

    private glyph(glyph: AtlasGlyph) {
        const sizeX = glyph.size.x / glyph.size.y;
        const sizeY = 1;

        this.positionBuffer.push(
            this.xOffset, 0, 0,
            this.xOffset, sizeY, 0,
            this.xOffset + sizeX, 0, 0,
            this.xOffset + sizeX, sizeY, 0
        );
        this.indexBuffer.push(
            this.index + 2, this.index + 1, this.index + 0,
            this.index + 3, this.index + 1, this.index + 2
        );
        this.uvBuffer.push(
            glyph.from.x, glyph.from.y,
            glyph.from.x, glyph.to.y,
            glyph.to.x, glyph.from.y,
            glyph.to.x, glyph.to.y
        );
        this.textColorBuffer.push(
            this.currentTextColor.r, this.currentTextColor.g, this.currentTextColor.b, this.currentTextColor.a,
            this.currentTextColor.r, this.currentTextColor.g, this.currentTextColor.b, this.currentTextColor.a,
            this.currentTextColor.r, this.currentTextColor.g, this.currentTextColor.b, this.currentTextColor.a,
            this.currentTextColor.r, this.currentTextColor.g, this.currentTextColor.b, this.currentTextColor.a,
        );
        this.backgroundColorBuffer.push(
            this.currentBackgroundColor.r, this.currentBackgroundColor.g, this.currentBackgroundColor.b, this.currentBackgroundColor.a,
            this.currentBackgroundColor.r, this.currentBackgroundColor.g, this.currentBackgroundColor.b, this.currentBackgroundColor.a,
            this.currentBackgroundColor.r, this.currentBackgroundColor.g, this.currentBackgroundColor.b, this.currentBackgroundColor.a,
            this.currentBackgroundColor.r, this.currentBackgroundColor.g, this.currentBackgroundColor.b, this.currentBackgroundColor.a,
        );

        this.index += 4;
        this.xOffset += sizeX;
    }

    public create(text: string, textColor: ColorRGBA, backgroundColor: ColorRGBA) {
        this.positionBuffer = new Array;
        this.indexBuffer = new Array;
        this.uvBuffer = new Array;
        this.textColorBuffer = new Array;
        this.backgroundColorBuffer = new Array;

        this.index = 0;
        this.xOffset = 0;

        this.currentTextColor = textColor;
        this.currentBackgroundColor = backgroundColor;

        for(const char of text) {
            const glyph = this.atlas.glyphs.get(char);
            this.glyph(glyph);
        }

        const geometry = new BufferGeometry;
        geometry.setAttribute("position", new Float32BufferAttribute(this.positionBuffer, 3));
        geometry.setIndex(this.indexBuffer);
        geometry.setAttribute("uv", new Float32BufferAttribute(this.uvBuffer, 2));
        geometry.setAttribute("textColor", new Uint8BufferAttribute(this.textColorBuffer, 4));
        geometry.setAttribute("backgroundColor", new Uint8BufferAttribute(this.backgroundColorBuffer, 4));

        return geometry;
    }
}