# Technical Notes

## Architecture
The application uses a pure-frontend approach to handle the 3D processing. This keeps the application extremely lightweight and avoids the need to install heavy dependencies like Python's `trimesh` or Node's headless 3D wrappers.

- **Server:** A minimal `Bun.serve()` script acts as a static file server. It requires virtually zero disk space and starts instantly.
- **Frontend 3D Engine:** Three.js is loaded via CDN to minimize local footprint.
- **SVG Parsing:** `THREE.SVGLoader` reads the raw SVG paths and converts them to Three.js `Shape` objects.
- **3D Extrusion:** `THREE.ExtrudeGeometry` takes these shapes and adds depth and beveling.
- **Exporting:** `THREE.GLTFExporter` traverses the scene graph and serializes the 3D meshes into a binary GLB blob, which is then dynamically downloaded by the browser.

## Limitations & Considerations
- **SVG Complexity:** Font SVGs can have very complex path intersections. `ExtrudeGeometry` usually handles standard `d` attributes well, but SVGs with heavy overlapping paths or missing `fill-rule` properties might extrude with missing faces.
- **Coordinates:** SVG coordinates are inverted compared to WebGL (Y goes down in SVG, up in WebGL). The `app.js` handles this by scaling `y` by `-1`.
- **Scaling:** Font SVGs are often massive (e.g., coordinates in the thousands). We compute a bounding box and scale the object down to a maximum dimension of 50 units to ensure it fits the camera viewport.
