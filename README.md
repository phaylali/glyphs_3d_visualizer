# Glyphs 3D Visualizer

A lightweight tool to convert SVG font glyphs into spinning 3D objects in the GLB format.

## Features
- Import a single SVG file.
- Automatically extrudes the 2D path into a 3D geometry.
- Applies a reflective gold material.
- Spins the model horizontally in the browser.
- Export the resulting 3D model as a `.glb` file.

## Requirements
- [Bun](https://bun.sh/) installed on your system.

## How to Run
1. Open your terminal in this directory.
2. Run the server:
   ```bash
   bun run server.js
   ```
3. Open your browser and navigate to `http://localhost:3000`.
4. Click "Import SVG" and select a glyph SVG file.
5. Watch the spinning 3D gold object!
6. Click "Export GLB" to download the model.
