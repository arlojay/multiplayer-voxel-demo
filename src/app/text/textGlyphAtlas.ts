import { Texture, Vector2 } from "three";

export interface RenderedGlyph {
    glyph: string;
    canvas: OffscreenCanvas;
    measurement: TextMetrics;
}

export interface AtlasGlyph {
    glyph: RenderedGlyph;
    from: Vector2;
    to: Vector2;
    size: Vector2;
}

export class TextGlyphAtlas {
    public readonly glyphChars: string = "";
    public readonly font: string = "12px Arial, sans-serif";
    public readonly glyphs: Map<string, AtlasGlyph> = new Map;
    public texture: Texture = null;

    constructor(glyphChars: string, font?: string) {
        this.glyphChars = glyphChars;
        if(font != null) this.font = font;
    }

    private drawGlyph(glyph: string): RenderedGlyph {
        const canvas = new OffscreenCanvas(1, 1);
        const ctx = canvas.getContext("2d");
        ctx.font = this.font;

        ctx.textBaseline = "top";
        ctx.font = this.font;
        const measurement = ctx.measureText(glyph);

        canvas.width = Math.max(1, Math.ceil(measurement.width));
        canvas.height = Math.max(1, Math.ceil(measurement.fontBoundingBoxDescent + measurement.fontBoundingBoxAscent));
        ctx.textBaseline = "alphabetic";
        ctx.font = this.font;

        ctx.fillStyle = "#ffffff";
        ctx.fillText(glyph, 0, measurement.fontBoundingBoxDescent - measurement.fontBoundingBoxAscent);

        return { glyph, canvas, measurement };
    }

    public build() {
        const renderedGlyphs: RenderedGlyph[] = new Array;

        let maxWidth = 0;
        let maxHeight = 0;

        for(const glyph of this.glyphChars) {
            const renderedGlyph = this.drawGlyph(glyph);
            if(renderedGlyph.canvas.width > maxWidth) maxWidth = renderedGlyph.canvas.width;
            if(renderedGlyph.canvas.height > maxHeight) maxHeight = renderedGlyph.canvas.height;

            renderedGlyphs.push(renderedGlyph);
        }

        const maxAtlasWidth = 2048;
        let canvasWidth = 0, canvasHeight = 0;
        
        let minColumns = 1;
        let minSize = Infinity;

        let columns = 1;
        do {
            const _canvasWidth = columns * maxWidth;
            const _canvasHeight = Math.ceil(renderedGlyphs.length / columns) * maxHeight;

            if(Math.abs(_canvasWidth - _canvasHeight) < minSize) {
                canvasWidth = _canvasWidth;
                canvasHeight = _canvasHeight;
                minSize = Math.abs(_canvasWidth - _canvasHeight);
                minColumns = columns;
            }
        } while(columns++ < Math.floor(maxAtlasWidth / maxWidth));

        columns = minColumns;

        const combined = new OffscreenCanvas(canvasWidth, canvasHeight);
        const ctx = combined.getContext("2d");

        for(let i = 0; i < renderedGlyphs.length; i++) {
            const renderedGlyph = renderedGlyphs[i];
            const col = i % columns;
            const row = Math.floor(i / columns);

            ctx.drawImage(
                renderedGlyph.canvas,
                col * maxWidth,
                row * maxHeight,
            );

            this.glyphs.set(renderedGlyph.glyph, {
                glyph: renderedGlyph,
                size: new Vector2(
                    renderedGlyph.measurement.width,
                    maxHeight,
                ),
                from: new Vector2(
                    (col * maxWidth) / combined.width,
                    1 - (row + 1) * maxHeight / combined.height,
                ),
                to: new Vector2(
                    (col * maxWidth + renderedGlyph.measurement.width) / combined.width,
                    1 - row * maxHeight / combined.height,
                )
            })
        }
        this.texture = new Texture(combined);
        this.texture.needsUpdate = true;
    }
}