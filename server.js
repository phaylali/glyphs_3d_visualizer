import * as opentype from 'opentype.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const basePath = process.cwd();
const PORT = 3000;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // POST /extract — Parse font file and export each glyph as SVG
    if (url.pathname === "/extract" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const fontFile = formData.get('font');

        if (!fontFile || !(fontFile instanceof File)) {
          return Response.json({ success: false, error: 'No font file uploaded' }, { status: 400 });
        }

        const buffer = await fontFile.arrayBuffer();
        let font;
        try {
          font = opentype.parse(buffer);
        } catch (e) {
          return Response.json({ success: false, error: 'Failed to parse font: ' + e.message }, { status: 400 });
        }

        const fontName = fontFile.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '');
        const folderName = `${fontName}Glyphs`;
        const outputDir = join(basePath, 'input', folderName);
        await mkdir(outputDir, { recursive: true });

        let count = 0;
        for (let i = 0; i < font.glyphs.length; i++) {
          const glyph = font.glyphs.get(i);

          let fileName;
          if (glyph.unicode !== undefined) {
            fileName = glyph.unicode.toString(16).toUpperCase().padStart(4, '0');
          } else if (glyph.name) {
            fileName = glyph.name;
          } else {
            fileName = `glyph_${i}`;
          }

          const ascender = font.ascender ?? 0;
          const descender = font.descender ?? 0;
          const unitsPerEm = font.unitsPerEm ?? 1000;

          const path = glyph.getPath(0, ascender, unitsPerEm);
          const svgPathData = path.toSVG(2);

          const width = glyph.advanceWidth ?? unitsPerEm;
          const height = ascender - descender;

          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  ${svgPathData}
</svg>`;

          await writeFile(join(outputDir, `${fileName}.svg`), svg);
          count++;
        }

        return Response.json({
          success: true,
          count,
          path: `input/${folderName}/`
        });
      } catch (error) {
        console.error(error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    let filePath = basePath + url.pathname;
    if (url.pathname === "/") {
      filePath = basePath + "/index.html";
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);

// Automatically open the preview window in the browser
try {
    Bun.spawn(["xdg-open", `http://localhost:${PORT}`]);
    console.log("Opening preview window in the browser...");
} catch (e) {
    console.error("Could not automatically open browser.");
}
