# Dev Notes

## 2026-06-06 — Coin Generator (Blender CLI backend) — WIP

**Status: needs rework.** The side walls still appear distorted. The contour extraction, circle fitting, bevel, normal threshold, and camera orientation have been iterated on but the visual result is not acceptable yet.

### Architecture change
The coin generator no longer uses client-side Three.js extrusion. Instead, images are POSTed to the server, which spawns `blender --background --python scripts/coin_from_images.py` headlessly to produce a GLB with embedded textures.

### Key files added
| File | Purpose |
|------|---------|
| `scripts/coin_from_images.py` | Headless Blender CLI — accepts `--front`, `--back`, `--output`, `--width`, `--height`, `--depth`. Builds bmesh front/back fans + side quads, applies bevel, assigns UV/material, exports GLB. |
| `input/coin/front.png` | Default front image (gold circle with dots, 512×512) |
| `input/coin/back.png` | Default back image (silver circle with spokes, 512×512) |
| `.gitignore` | Excludes `.cointmp/` and `test_data/` |

### Key changes to existing files

**server.js** — Rewritten with:
- POST `/generate-coin` endpoint: accepts `FormData` (front, back, width, height, depth), saves to temp dir, spawns Blender CLI, streams GLB response, cleans up `.cointmp/`.
- Static file serving for `/input/*` (default coin images).
- Fixed indentation and variable shadowing bugs.

**app.js** — Added:
- `generateCoin()` — POSTs images to server, loads returned GLB via `THREE.GLTFLoader`, fits camera to object.
- `loadDefaultCoin()` — Fetches default front/back images, sets file inputs, triggers generation after 800ms.
- `clearObjectGroup()` — Properly disposes geometries and materials.
- Camera auto-fit now places camera on +Y axis (where glTF Y-up conversion puts the coin face).
- `camera.up.set(0, 0, 1)` so orbit controls feel natural.

**index.html** — Added:
- `<script src="...GLTFLoader.js">` for GLB loading.
- Coin Generator UI section: Front Image / Back Image buttons, Depth/Width/Height inputs, Generate Coin button, status display.

### Blender script details (`coin_from_images.py`)

**Pipeline:**
1. Load front + back images via `bpy.data.images.load()`
2. Resize both images to matching dimensions (using Blender's `img.scale()`)
3. Extract alpha-channel contour via polar sampling (128 rays)
4. Fit a circle to each contour; use the larger radius
5. Generate a perfect circular contour (128 points on the fitted circle)
6. Build bmesh: front fan + back fan + side quads (same contour for both faces → vertical walls)
7. Apply bevel modifier (width=`BEVEL_RATIO × shape_size`, segments=4, angle limit=30°)
8. Scale mesh to target cm dimensions
9. Assign materials by face normal: `|Z| > 0.95` → front (material 0) / back (material 1), else edge (material 2)
10. UV: front/back use planar XY normalized to bounding box; sides use angular mapping `(atan2(y,x)+π)/2π` for U, normalized Z for V
11. Export GLB with embedded textures

**Constants:**
- `CONTOUR_POINTS = 128`
- `ALPHA_THRESHOLD = 0.12`
- `BEVEL_RATIO = 0.015`
- `TEX_MAX = 1024`
- `NORMAL_THRESHOLD = 0.95` — keeps textures on flat faces only; bevel faces get solid edge color

**Material definition:**
- Coin_Front: front image texture, roughness=0.3, metalness=0.5
- Coin_Back: back image texture, roughness=0.3, metalness=0.5
- Coin_Edge: solid color (dominant color from front image), roughness=0.4, metalness=0.7
- All materials: `use_backface_culling = False` (double-sided for glTF)

### Still broken
- Side walls appear distorted despite circle fitting, reduced bevel, and higher normal threshold. Likely causes: UV mapping on bevel/transitional faces, or the interaction between the bevel modifier and the normal-based material classification.

### Fixes applied

| Issue | Fix |
|-------|-----|
| Front+back images different sizes/same contour → slanted walls | Resize both to match, extract both contours, fit circles, use larger radius |
| Pixel-level contour → noisy sides | Circle fitting eliminates pixel jitter |
| Bevel too large → distorted rim | Halved BEVEL_RATIO from 0.03 to 0.015 |
| Texture stretched across bevel faces | NORMAL_THRESHOLD raised from 0.5 to 0.95 |
| Back face visible instead of front | Removed model rotation; camera on +Y axis (glTF Y-up puts faces on Y) |
| Back-face culling hid front face | Materials are double-sided (`use_backface_culling = False`) |
| Duplicate `objectGroup.add()` calls | Cleaned up |
| Default images were both silver/blue | Regenerated with proper gold (front) and silver (back) colors, uniform 512×512 |

### Running
- Server: `bun run server.js` (port 3000)
- Blender: `/usr/sbin/blender --background --python scripts/coin_from_images.py`
- Temp files: `.cointmp/` (auto-cleaned after response)

### Known warnings
- `More than one shader node tex image used for a texture` — harmless, materials export correctly
