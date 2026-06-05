// Global Three.js variables
let scene, camera, renderer, objectGroup, controls;
let currentSVGText = null;
let loadedSVGs = [];
let currentIndex = 0;
let slideshowInterval = null;

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

// Handle Color Change
function handleColorChange(event) {
    const newColor = event.target.value;
    localStorage.setItem('glyphMaterialColor', newColor);
    
    if (objectGroup && objectGroup.children.length > 0) {
        objectGroup.children.forEach(mesh => {
            if (mesh.material) {
                mesh.material.color.set(newColor);
            }
        });
    }
}

function handleRoughnessChange(event) {
    const val = event.target.value;
    localStorage.setItem('glyphRoughness', val);
    document.getElementById('roughness-value').textContent = val;
    if (objectGroup && objectGroup.children.length > 0) {
        objectGroup.children.forEach(mesh => {
            if (mesh.material) mesh.material.roughness = parseFloat(val);
        });
    }
}

function handleMetalnessChange(event) {
    const val = event.target.value;
    localStorage.setItem('glyphMetalness', val);
    document.getElementById('metalness-value').textContent = val;
    if (objectGroup && objectGroup.children.length > 0) {
        objectGroup.children.forEach(mesh => {
            if (mesh.material) mesh.material.metalness = parseFloat(val);
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
    while(objectGroup.children.length > 0){ 
        const child = objectGroup.children[0];
        objectGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }

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

    const name = loadedSVGs[currentIndex]
        ? loadedSVGs[currentIndex].name.replace(/\.svg$/i, '') + '.glb'
        : 'glyph.glb';

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

// Start
init();
