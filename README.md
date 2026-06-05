# Glyphs 3D Visualizer

A lightweight tool to convert SVG font glyphs into spinning 3D objects in the GLB format.

## Features
- Import a single SVG file.
- Automatically extrudes the 2D path into a 3D geometry.
- Applies a reflective gold material.
- Spins the model horizontally in the browser.
- Export the resulting 3D model as a `.glb` file.
- Extract individual glyph SVGs from `.otf`/`.ttf` font files — saved to `input/` for immediate 3D conversion.

## Requirements
- [Bun](https://bun.sh/) installed on your system.

## How to Run
1. Open your terminal in this directory.
2. Install dependencies:
   ```bash
   bun install
   ```
3. Run the server:
   ```bash
   bun run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.
5. Click "Import SVG" and select a glyph SVG file.
6. Watch the spinning 3D gold object!
7. Click "Export GLB" to download the model.

## Font Glyph Extraction
1. Click "Extract Font Glyphs" in the UI.
2. Select an `.otf` or `.ttf` font file.
3. All glyphs are exported as individual SVGs into `input/[FontName]Glyphs/`.
4. Use "Import SVG" to pick any extracted glyph and convert it to 3D.
