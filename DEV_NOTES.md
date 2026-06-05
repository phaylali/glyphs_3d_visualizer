# Technical Notes

## Architecture
The application uses a pure-frontend approach to handle the 3D processing. This keeps the application extremely lightweight and avoids the need to install heavy dependencies like Python's `trimesh` or Node's headless 3D wrappers.

- **Server:** A minimal `Bun.serve()` script acts as a static file server. It requires virtually zero disk space and starts instantly.
- **Frontend 3D Engine:** Three.js is loaded via CDN to minimize local footprint.
- **SVG Parsing:** `THREE.SVGLoader` reads the raw SVG paths and converts them to Three.js `Shape` objects.
- **3D Extrusion:** `THREE.ExtrudeGeometry` takes these shapes and adds depth and beveling.
- **Exporting:** `THREE.GLTFExporter` traverses the scene graph and serializes the 3D meshes into a binary GLB blob, which is then dynamically downloaded by the browser.

## Multi-SVG & Slideshow
- **Multi-Import** `multiple` attribute on the file input; all selected files are read via `Promise.all` + `FileReader`, stored as `loadedSVGs[]` array of `{text, name}` objects.
- **Navigation** Prev/next wraparound via modular arithmetic; stops any active slideshow on manual nav.
- **Slideshow** `setInterval` driven at user-defined speed (default 2s). Changing the speed input while playing restarts the interval. Pause clears the interval and resets the button text.
- **Display** The current glyph name is shown in two places: a prominent gold element above the controls (`#current-name`), and a smaller status line at the bottom (`#status`).

## Material Controls
- **Color** Stored in `localStorage` as `glyphMaterialColor`. Applied via `material.color.set()` on existing meshes — no geometry rebuild needed.
- **Roughness / Metalness** Range sliders (0–1, step 0.01). Persisted as `glyphRoughness` / `glyphMetalness` in `localStorage`. Values are read during material creation in `loadSVG` and live-updated via direct property assignment on existing meshes.
- Sliders are styled cross-browser with `-webkit-slider-thumb` / `-moz-range-thumb`.

## Server-Side: Font Glyph Extraction
- **Endpoint** `POST /extract` accepts a `.otf`/`.ttf` file via multipart form.
- **Parsing** uses `opentype.js` — iterates every glyph index, converts to SVG path via `glyph.getPath()`, and writes individual SVGs.
- **Output** Saved to `input/[FontName]Glyphs/` so extracted SVGs are immediately available for 3D conversion.
- **Naming** Files named by Unicode hex (e.g. `0041.svg`), falling back to glyph name or index.

## Limitations & Considerations
- **SVG Complexity:** Font SVGs can have very complex path intersections. `ExtrudeGeometry` usually handles standard `d` attributes well, but SVGs with heavy overlapping paths or missing `fill-rule` properties might extrude with missing faces.
- **Coordinates:** SVG coordinates are inverted compared to WebGL (Y goes down in SVG, up in WebGL). The `app.js` handles this by scaling `y` by `-1`.
- **Scaling:** Font SVGs are often massive (e.g., coordinates in the thousands). We compute a bounding box and scale the object down to a maximum dimension of 50 units to ensure it fits the camera viewport.

## Progress

### Completed Features
- Basic HTML/CSS/JS scaffolding.
- Fast local static server using Bun.
- SVG parsing and 3D extrusion via Three.js.
- Applied hardcoded gold material with reflective lighting.
- Horizontal spinning animation loop.
- GLB file export functionality.
- Support for importing 1 SVG at a time.
- UI color picker to change material color dynamically with local storage persistence.
- UI depth input and automatic depth calculation based on SVG dimensions.
- Advanced invisible path filtering (ignores display="none", hidden, and white backgrounds).
- HD Quality toggle to vastly increase geometry curve density for smoother paths.
- Font glyph extraction — upload .otf/.ttf, exports every glyph as SVG into `input/[FontName]Glyphs/`.
- Multi-SVG import — select multiple .svg files at once.
- Slideshow mode — cycles through loaded SVGs with play/pause and configurable speed.
- Navigation controls — prev / next buttons with counter, per-glyph export naming.
- Roughness / Metalness sliders with live preview and localStorage persistence.
