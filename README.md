# Glyphs 3D Visualizer

A browser-based tool to convert SVG font glyphs into spinning 3D objects and export them as `.glb` files. Includes font glyph extraction from `.otf`/`.ttf` files and a coin generator that produces 3D coins from front/back images via Blender CLI.

## Features

### 3D Conversion
- Import one or more SVG files (multi-select supported).
- Auto-extrudes 2D paths into 3D geometry with configurable depth.
- HD Quality toggle for smoother curves.
- Adjustable material: color picker + roughness/metalness sliders.
- OrbitControls: pan, zoom, rotate around the model.
- Horizontal spin animation.
- Export any glyph as `.glb`.

### Multi-SVG & Slideshow
- Load multiple SVGs at once and navigate with prev/next buttons.
- Slideshow mode cycles through glyphs at a configurable speed (0.5s+).
- Current glyph name displayed prominently in the UI.

### Font Glyph Extraction
- Upload `.otf` or `.ttf` font files.
- Every glyph is exported as an individual SVG into `input/[FontName]Glyphs/`.
- Files named by Unicode hex (e.g. `0041.svg`) — ready for immediate 3D import.

### Coin Generator
- Upload front and back images (PNG with alpha channel).
- Server-side Blender CLI extracts the alpha contour, builds a 3D mesh, and returns a GLB.
- Configurable coin width, height, and depth.
- Auto-loads default coin (gold front / silver back) on startup.
- Three materials: front texture, back texture, solid-color edge.

## Requirements
- [Bun](https://bun.sh/) installed on your system.
- Blender 5.1+ (for coin generation). Install via:
  ```bash
  sudo apt install blender
  ```

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
4. Open your browser to `http://localhost:3000`.

## Usage
- **Import SVGs** — Click the button, select one or more `.svg` files.
- **Navigate** — Use ‹ Prev / Next › buttons (appear when 2+ SVGs loaded).
- **Slideshow** — Click ▶ Slideshow, adjust speed with the Speed (s) field.
- **Material** — Change Color, Roughness, or Metalness at any time.
- **Export** — Click Export GLB to download the currently viewed glyph.
- **Extract Font** — Click Extract Font Glyphs, choose a `.otf`/`.ttf` file.
- **Generate Coin** — Click Front Image / Back Image to select images, then Generate Coin. Default coin loads automatically.


---

## Support Us

<p align="center">
  <a href="https://ko-fi.com/omniversify">
    <img src="https://raw.githubusercontent.com/phaylali/Omniversify/main/public/images/kofi_logo.svg" width="200" alt="Ko-Fi" />
  </a>
</p>

<p align="center">
  <strong>Keep us going</strong>
</p>

---

&copy; 2026 [Omniversify](https://omniversify.com). All rights reserved.

_Made by Moroccans, for the Omniverse_

[![ReadMeSupportPalestine](https://raw.githubusercontent.com/Safouene1/support-palestine-banner/master/banner-project.svg)](https://donate.unrwa.org/-landing-page/en_EN)
