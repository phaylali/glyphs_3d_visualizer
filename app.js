// Global Three.js variables
let scene, camera, renderer, objectGroup, controls;
let currentSVGText = null;
let loadedSVGs = [];
let currentIndex = 0;
let slideshowInterval = null;
let coinFrontURL = null;
let coinBackURL = null;

// Setup Scene
function init() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 100);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights (optimized for gold material)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffee, 1.5);
    dirLight1.position.set(10, 20, 10);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xeeeeff, 1);
    dirLight2.position.set(-10, -20, -10);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(0, 0, 20);
    scene.add(pointLight);

    // Group to hold our generated 3D object
    objectGroup = new THREE.Group();
    scene.add(objectGroup);

    // Resize handler
    window.addEventListener('resize', onWindowResize);

    // Event Listeners for UI
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('svg-input').click();
    });

    document.getElementById('svg-input').addEventListener('change', handleFileUpload);
    document.getElementById('export-btn').addEventListener('click', exportGLB);
    document.getElementById('prev-btn').addEventListener('click', prevSVG);
    document.getElementById('next-btn').addEventListener('click', nextSVG);
    document.getElementById('slideshow-btn').addEventListener('click', toggleSlideshow);
    document.getElementById('speed-input').addEventListener('change', handleSpeedChange);

    // Initialize Color Picker from Local Storage
    const savedColor = localStorage.getItem('glyphMaterialColor') || '#383000';
    const colorPicker = document.getElementById('color-picker');
    colorPicker.value = savedColor;
    colorPicker.addEventListener('input', handleColorChange);

    // Initialize Roughness / Metalness sliders
    const roughnessSlider = document.getElementById('roughness-slider');
    const metalnessSlider = document.getElementById('metalness-slider');
    roughnessSlider.value = localStorage.getItem('glyphRoughness') || '0.2';
    metalnessSlider.value = localStorage.getItem('glyphMetalness') || '0.8';
    document.getElementById('roughness-value').textContent = roughnessSlider.value;
    document.getElementById('metalness-value').textContent = metalnessSlider.value;
    roughnessSlider.addEventListener('input', handleRoughnessChange);
    metalnessSlider.addEventListener('input', handleMetalnessChange);

    // Depth Input listener
    const depthInput = document.getElementById('depth-input');
    depthInput.addEventListener('change', () => {
        if (currentSVGText) {
            loadSVG(currentSVGText);
        }
    });

    // HD Checkbox listener
    const hdCheckbox = document.getElementById('hd-checkbox');
    hdCheckbox.addEventListener('change', () => {
        if (currentSVGText) {
            loadSVG(currentSVGText);
        }
    });

    // Coin Generator listeners
    document.getElementById('front-img-btn').addEventListener('click', () => {
        document.getElementById('front-img-input').click();
    });
    document.getElementById('back-img-btn').addEventListener('click', () => {
        document.getElementById('back-img-input').click();
    });
    document.getElementById('front-img-input').addEventListener('change', handleCoinFrontImage);
    document.getElementById('back-img-input').addEventListener('change', handleCoinBackImage);
    document.getElementById('generate-coin-btn').addEventListener('click', generateCoin);
    document.getElementById('coin-depth-input').addEventListener('change', () => {
        if (objectGroup.children.length > 0 && !currentSVGText) {
            generateCoin();
        }
    });

    // Start Animation Loop
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // Horizontal spin
    if (objectGroup && objectGroup.children.length > 0) {
        objectGroup.rotation.y += 0.01;
    }

    controls.update();
    renderer.render(scene, camera);
}

function forEachMaterial(mesh, fn) {
    if (!mesh.material) return;
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(fn);
    } else {
        fn(mesh.material);
    }
}

// Handle Color Change (skip textured materials so coin front/back are preserved)
function handleColorChange(event) {
    const newColor = event.target.value;
    localStorage.setItem('glyphMaterialColor', newColor);
    
    if (objectGroup && objectGroup.children.length > 0) {
        objectGroup.children.forEach(mesh => {
            forEachMaterial(mesh, mat => {
                if (!mat.map) mat.color.set(newColor);
            });
        });
    }
}

function handleRoughnessChange(event) {
    const val = event.target.value;
    localStorage.setItem('glyphRoughness', val);
    document.getElementById('roughness-value').textContent = val;
    if (objectGroup && objectGroup.children.length > 0) {
        objectGroup.children.forEach(mesh => {
            forEachMaterial(mesh, mat => { mat.roughness = parseFloat(val); });
        });
    }
}

function handleMetalnessChange(event) {
    const val = event.target.value;
    localStorage.setItem('glyphMetalness', val);
    document.getElementById('metalness-value').textContent = val;
    if (objectGroup && objectGroup.children.length > 0) {
        objectGroup.children.forEach(mesh => {
            forEachMaterial(mesh, mat => { mat.metalness = parseFloat(val); });
        });
    }
}

// Handle SVG File Upload (supports multiple files)
function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const readers = Array.from(files).map(file =>
        new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve({ text: e.target.result, name: file.name });
            reader.readAsText(file);
        })
    );

    Promise.all(readers).then(results => {
        stopSlideshow();
        loadedSVGs = results;
        currentIndex = 0;
        currentSVGText = results[0].text;
        document.getElementById('depth-input').value = '';
        updateNavUI();
        loadSVG(currentSVGText);
    });
}

function handleSpeedChange() {
    if (slideshowInterval) {
        stopSlideshow();
        startSlideshow();
    }
}

// — Navigation & Slideshow —

function prevSVG() {
    if (loadedSVGs.length === 0) return;
    stopSlideshow();
    currentIndex = (currentIndex - 1 + loadedSVGs.length) % loadedSVGs.length;
    showCurrent();
}

function nextSVG() {
    if (loadedSVGs.length === 0) return;
    stopSlideshow();
    currentIndex = (currentIndex + 1) % loadedSVGs.length;
    showCurrent();
}

function showCurrent() {
    if (loadedSVGs.length === 0) return;
    currentSVGText = loadedSVGs[currentIndex].text;
    document.getElementById('depth-input').value = '';
    updateNavUI();
    loadSVG(currentSVGText);
}

function toggleSlideshow() {
    if (slideshowInterval) {
        stopSlideshow();
    } else {
        startSlideshow();
    }
}

function startSlideshow() {
    if (loadedSVGs.length < 2) return;
    const speed = parseFloat(document.getElementById('speed-input').value) || 2;
    document.getElementById('slideshow-btn').textContent = '\u23F8 Pause';
    slideshowInterval = setInterval(() => {
        currentIndex = (currentIndex + 1) % loadedSVGs.length;
        showCurrent();
    }, speed * 1000);
}

function stopSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
    }
    document.getElementById('slideshow-btn').textContent = '\u25B6 Slideshow';
}

function updateNavUI() {
    const nav = document.getElementById('nav-controls');
    if (loadedSVGs.length > 1) {
        nav.style.display = 'block';
        document.getElementById('nav-counter').textContent =
            (currentIndex + 1) + ' / ' + loadedSVGs.length;
    } else {
        nav.style.display = 'none';
    }
}

// Convert SVG string to 3D Geometry
function loadSVG(svgText) {
    // Save current rotation to prevent visual jumping
    const oldRotY = objectGroup.rotation.y;
    
    // Reset group transforms before computing bounds
    objectGroup.rotation.set(0, 0, 0);
    objectGroup.scale.set(1, 1, 1);
    objectGroup.position.set(0, 0, 0);
    objectGroup.updateMatrixWorld();

    // Clear previous object
    clearObjectGroup();

    const loader = new THREE.SVGLoader();
    const svgData = loader.parse(svgText);

    // Get current color
    const currentColor = document.getElementById('color-picker').value;

    // Create Material
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(currentColor),
        metalness: parseFloat(document.getElementById('metalness-slider').value),
        roughness: parseFloat(document.getElementById('roughness-slider').value),
        side: THREE.DoubleSide
    });

    // Filter paths and calculate 2D bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const validPaths = [];

    svgData.paths.forEach((path) => {
        // Skip explicitly invisible paths
        const style = path.userData.style;
        if (style) {
            if (style.fill === 'none' || style.fill === 'transparent' || style.fillOpacity === 0) {
                return;
            }
        }
        
        if (path.userData && path.userData.node) {
            const display = path.userData.node.getAttribute('display');
            const visibility = path.userData.node.getAttribute('visibility');
            if (display === 'none' || visibility === 'hidden') return;
            
            // Heuristic to skip white bounding boxes from font editors
            const fill = path.userData.node.getAttribute('fill');
            const styleFill = path.userData.node.style ? path.userData.node.style.fill : null;
            if (fill === '#ffffff' || fill === 'white' || fill === '#fff' || styleFill === 'white' || styleFill === '#ffffff') return;
        }

        validPaths.push(path);

        const shapes = path.toShapes(true);
        shapes.forEach(shape => {
            const geo = new THREE.ShapeGeometry(shape);
            geo.computeBoundingBox();
            if (geo.boundingBox) {
                minX = Math.min(minX, geo.boundingBox.min.x);
                minY = Math.min(minY, geo.boundingBox.min.y);
                maxX = Math.max(maxX, geo.boundingBox.max.x);
                maxY = Math.max(maxY, geo.boundingBox.max.y);
            }
            geo.dispose();
        });
    });

    if (validPaths.length === 0) {
        document.getElementById('status').innerText = 'Error: No valid paths found in SVG.';
        return;
    }

    // Determine Depth
    let depthVal = parseFloat(document.getElementById('depth-input').value);
    if (isNaN(depthVal) || depthVal <= 0) {
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Auto-calculate depth as requested: (width + height) / 2 * 0.1
        depthVal = ((width + height) / 2) * 0.1;
        
        if (depthVal === 0 || !isFinite(depthVal)) depthVal = 10;
        
        document.getElementById('depth-input').value = depthVal.toFixed(1);
    }

    const isHD = document.getElementById('hd-checkbox').checked;

    const extrusionSettings = {
        depth: depthVal,
        bevelEnabled: false,
        curveSegments: isHD ? 64 : 12 // 64 for much smoother curves
    };

    // Create Meshes from valid Paths
    const meshes = [];
    validPaths.forEach((path) => {
        const shapes = path.toShapes(true);
        shapes.forEach((shape) => {
            const geometry = new THREE.ExtrudeGeometry(shape, extrusionSettings);
            const mesh = new THREE.Mesh(geometry, material);
            meshes.push(mesh);
            objectGroup.add(mesh);
        });
    });

    if (objectGroup.children.length === 0) {
        document.getElementById('status').innerText = 'Error: No valid paths found in SVG.';
        return;
    }

    // Compute bounding box to center the object
    const box = new THREE.Box3().setFromObject(objectGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Center the geometry vertices so the object spins in place around its origin
    objectGroup.children.forEach(mesh => {
        mesh.geometry.translate(-center.x, -center.y, -center.z);
    });

    // Reset group position to origin (it should already be 0,0,0 but just in case)
    objectGroup.position.set(0, 0, 0);

    // Scale down if it's too big or small to fit the screen nicely
    const maxDim = Math.max(size.x, size.y);
    if (maxDim > 0) {
        const scale = 50 / maxDim;
        objectGroup.scale.set(scale, scale, scale);
        // Also invert Y because SVG coordinates are upside down compared to Three.js
        objectGroup.scale.y *= -1;
    }

    // Restore rotation
    objectGroup.rotation.y = oldRotY;

    const name = loadedSVGs[currentIndex] ? loadedSVGs[currentIndex].name : 'SVG';
    document.getElementById('current-name').textContent = name;
    document.getElementById('status').innerText = '\u2713 ' + name;
    document.getElementById('export-btn').disabled = false;
}

// Export to GLB
function exportGLB() {
    if (objectGroup.children.length === 0) return;

    const currentName = document.getElementById('current-name').textContent;
    let name;
    if (currentName === 'Coin') {
        name = 'coin.glb';
    } else if (loadedSVGs[currentIndex]) {
        name = loadedSVGs[currentIndex].name.replace(/\.svg$/i, '') + '.glb';
    } else {
        name = 'glyph.glb';
    }

    const exporter = new THREE.GLTFExporter();
    exporter.parse(objectGroup, function (gltf) {
        const blob = new Blob([gltf], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, { binary: true });
}

// — Coin Generator —

function clearObjectGroup() {
    while(objectGroup.children.length > 0) {
        const child = objectGroup.children[0];
        objectGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
    }
}

function loadImageElement(file) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = URL.createObjectURL(file);
    });
}

function getDominantColor(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 16;
    canvas.height = 16;
    ctx.drawImage(img, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
    }
    return new THREE.Color(r / count / 255, g / count / 255, b / count / 255);
}

function handleCoinFrontImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (coinFrontURL) URL.revokeObjectURL(coinFrontURL);
    coinFrontURL = URL.createObjectURL(file);
    updateCoinFileStatus();
}

function handleCoinBackImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (coinBackURL) URL.revokeObjectURL(coinBackURL);
    coinBackURL = URL.createObjectURL(file);
    updateCoinFileStatus();
}

function updateCoinFileStatus() {
    const frontName = coinFrontURL ? document.getElementById('front-img-input').files[0]?.name : null;
    const backName = coinBackURL ? document.getElementById('back-img-input').files[0]?.name : null;
    const parts = [];
    if (frontName) parts.push('Front: ' + frontName);
    if (backName) parts.push('Back: ' + backName);
    document.getElementById('coin-file-status').textContent =
        parts.length ? parts.join(' | ') : 'No images selected.';
}

// Extract the outline shape from an image's alpha channel using polar sampling.
// Returns { shape: THREE.Shape, bounds } or null if the image is fully transparent.
function extractShapeFromImage(img, numPoints = 128, threshold = 30) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Center of mass of all non-transparent pixels
    let cx = 0, cy = 0, count = 0;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (data[(y * img.width + x) * 4 + 3] >= threshold) {
                cx += x;
                cy += y;
                count++;
            }
        }
    }
    if (count === 0) return null;
    cx /= count;
    cy /= count;

    const maxR = Math.ceil(Math.sqrt(cx*cx + cy*cy) + Math.sqrt((img.width-cx)*(img.width-cx)+(img.height-cy)*(img.height-cy)));
    const raw = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let r = 0;
        for (let t = 1; t <= maxR; t++) {
            const px = Math.round(cx + dx * t);
            const py = Math.round(cy + dy * t);
            if (px < 0 || px >= img.width || py < 0 || py >= img.height ||
                data[(py * img.width + px) * 4 + 3] < threshold) {
                r = t - 1;
                break;
            }
        }
        raw.push({ x: Math.round(cx + dx * r) - cx, y: Math.round(cy + dy * r) - cy });
    }

    // Compute bounds from the extracted points
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of raw) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    const shape = new THREE.Shape();
    shape.moveTo(raw[0].x, raw[0].y);
    for (let i = 1; i < raw.length; i++) {
        shape.lineTo(raw[i].x, raw[i].y);
    }
    shape.closePath();

    return {
        shape,
        bounds: { minX, minY, maxX, maxY, rangeX: maxX - minX || 1, rangeY: maxY - minY || 1 },
    };
}

async function generateCoin() {
    const frontFile = document.getElementById('front-img-input').files[0];
    const backFile = document.getElementById('back-img-input').files[0];
    if (!frontFile || !backFile) {
        document.getElementById('coin-status').textContent = 'Select both front and back images.';
        return;
    }

    stopSlideshow();

    const oldRotY = objectGroup.rotation.y;
    objectGroup.rotation.set(0, 0, 0);
    objectGroup.scale.set(1, 1, 1);
    objectGroup.position.set(0, 0, 0);
    objectGroup.updateMatrixWorld();

    clearObjectGroup();

    const [frontImg, backImg] = await Promise.all([
        loadImageElement(frontFile),
        loadImageElement(backFile)
    ]);

    const frontTexture = new THREE.Texture(frontImg);
    frontTexture.needsUpdate = true;
    const backTexture = new THREE.Texture(backImg);
    backTexture.needsUpdate = true;

    const dominantColor = getDominantColor(frontImg);

    // Extract shape from front image alpha channel
    const isHD = document.getElementById('hd-checkbox').checked;
    const shapeData = extractShapeFromImage(frontImg);
    if (!shapeData) {
        document.getElementById('coin-status').textContent = 'Could not detect shape in front image (no opaque content).';
        return;
    }
    const shapes = [shapeData.shape];
    const bounds = shapeData.bounds;

    let depthVal = parseFloat(document.getElementById('coin-depth-input').value);
    if (isNaN(depthVal) || depthVal <= 0) {
        depthVal = 8;
        document.getElementById('coin-depth-input').value = depthVal.toFixed(1);
    }

    const extrudeSettings = {
        depth: depthVal,
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 0.5,
        bevelSegments: isHD ? 8 : 3,
        curveSegments: isHD ? 64 : 16
    };

    // Custom UVGenerator: WorldUVGenerator returns raw vertex x,y as UVs.
    // Normalize lid UVs to [0,1] using shape bounds.
    // flipY=true (default on THREE.Texture) means v=0 → bottom of image,
    // v=1 → top of image. So use y mapped directly: v = (y - minY) / rangeY.
    const coinUVGen = {
        generateTopUV: function(geometry, vertices, iA, iB, iC) {
            const a=vertices[iA*3], b=vertices[iA*3+1];
            const c=vertices[iB*3], d=vertices[iB*3+1];
            const e=vertices[iC*3], f=vertices[iC*3+1];
            const toU = v => (v - bounds.minX) / bounds.rangeX;
            const toV = v => (v - bounds.minY) / bounds.rangeY;
            return [
                new THREE.Vector2(toU(a), toV(b)),
                new THREE.Vector2(toU(c), toV(d)),
                new THREE.Vector2(toU(e), toV(f)),
            ];
        },
        generateSideWallUV: function(geometry, vertices, iA, iB, iC, iD) {
            const ax=vertices[iA*3],ay=vertices[iA*3+1],az=vertices[iA*3+2];
            const bx=vertices[iB*3],by=vertices[iB*3+1],bz=vertices[iB*3+2];
            const cx=vertices[iC*3],cy=vertices[iC*3+1],cz=vertices[iC*3+2];
            const dx=vertices[iD*3],dy=vertices[iD*3+1],dz=vertices[iD*3+2];
            if (Math.abs(ay-by)<0.01) {
                return [new THREE.Vector2(ax,1-az),new THREE.Vector2(bx,1-bz),new THREE.Vector2(cx,1-cz),new THREE.Vector2(dx,1-dz)];
            } else {
                return [new THREE.Vector2(ay,1-az),new THREE.Vector2(by,1-bz),new THREE.Vector2(cy,1-cz),new THREE.Vector2(dy,1-dz)];
            }
        }
    };
    const extrudeSettingsWithUV = Object.assign({ UVGenerator: coinUVGen }, extrudeSettings);
    const roughness = parseFloat(document.getElementById('roughness-slider').value);
    const metalness = parseFloat(document.getElementById('metalness-slider').value);

    const frontMaterial = new THREE.MeshStandardMaterial({
        map: frontTexture,
        roughness: roughness,
        metalness: metalness
    });

    const backMaterial = new THREE.MeshStandardMaterial({
        map: backTexture,
        roughness: roughness,
        metalness: metalness
    });

    const sideMaterial = new THREE.MeshStandardMaterial({
        color: dominantColor,
        roughness: roughness,
        metalness: metalness
    });

    // Extrude each shape separately
    const coinMeshes = [];
    shapes.forEach(s => {
        const g = new THREE.ExtrudeGeometry(s, extrudeSettingsWithUV);
        const lg = g.groups.find(gr => gr.materialIndex === 0);
        const sg = g.groups.find(gr => gr.materialIndex === 1);
        if (lg && sg) {
            g.groups = [
                { start: lg.start, count: lg.count / 2, materialIndex: 0 },
                { start: lg.start + lg.count / 2, count: lg.count / 2, materialIndex: 1 },
                { start: sg.start, count: sg.count, materialIndex: 2 },
            ];
        }
        const m = new THREE.Mesh(g, [frontMaterial, backMaterial, sideMaterial]);
        coinMeshes.push(m);
        objectGroup.add(m);
    });

    const box = new THREE.Box3().setFromObject(objectGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    coinMeshes.forEach(m => m.geometry.translate(-center.x, -center.y, -center.z));
    objectGroup.position.set(0, 0, 0);

    const maxDim = Math.max(size.x, size.y);
    if (maxDim > 0) {
        const scale = 50 / maxDim;
        objectGroup.scale.set(scale, scale, scale);
    }

    objectGroup.rotation.y = oldRotY;

    document.getElementById('current-name').textContent = 'Coin';
    document.getElementById('status').innerText = '\u2713 Coin';
    document.getElementById('export-btn').disabled = false;
    document.getElementById('coin-status').textContent = 'Coin generated.';
}

// Start
init();
