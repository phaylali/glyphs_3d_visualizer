"""
Coin from Images — Blender CLI (headless)
==========================================
Usage:
  blender --background --python coin_from_images.py -- \\
    --front /path/to/front.png \\
    --back  /path/to/back.png \\
    --output /path/to/output.glb \\
    [--width 2] [--height 2] [--depth 0.16]

The output GLB embeds textures and uses three materials: front, back, edge.
"""

import bpy
import bmesh
import math
import sys
import os
from mathutils import Color

# ── Defaults ──────────────────────────────────────────────────────────────
CONTOUR_POINTS = 128
ALPHA_THRESHOLD = 0.12
BEVEL_RATIO = 0.015
TEX_MAX = 1024
NORMAL_THRESHOLD = 0.95  # only near-flat faces get texture; bevel faces get solid edge color


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    d = {'width': 2.0, 'height': 2.0, 'depth': 0.16}
    it = iter(argv)
    for arg in it:
        if arg == '--front':
            d['front'] = next(it)
        elif arg == '--back':
            d['back'] = next(it)
        elif arg == '--output':
            d['output'] = next(it)
        elif arg == '--width':
            d['width'] = float(next(it))
        elif arg == '--height':
            d['height'] = float(next(it))
        elif arg == '--depth':
            d['depth'] = float(next(it))
    for k in ('front', 'back', 'output'):
        if k not in d:
            print(f"Missing required argument: --{k}")
            sys.exit(1)
    return d


# ── Image helpers ─────────────────────────────────────────────────────────

def load_pixels(path):
    """Load image via Blender, return numpy RGBA array + (w, h)."""
    import numpy as np
    name = os.path.basename(path)
    img = bpy.data.images.load(path, check_existing=True)
    w, h = img.size
    if max(w, h) > TEX_MAX:
        img.scale(int(w * TEX_MAX / max(w, h)), int(h * TEX_MAX / max(w, h)))
        w, h = img.size
    flat = np.array(img.pixels[:], dtype=np.float32)
    return flat.reshape((h, w, 4)), w, h, img


def resize_to_match(arr_a, arr_b):
    """Resize both numpy RGBA arrays to same dimensions (max of both) via Blender."""
    import numpy as np
    ha, wa = arr_a.shape[:2]
    hb, wb = arr_b.shape[:2]
    if ha == hb and wa == wb:
        return arr_a, arr_b
    tw, th = max(wa, wb), max(ha, hb)
    def _resize(arr):
        img = numpy_to_blender_image('_tmp', arr)
        img.scale(tw, th)
        w2, h2 = img.size
        flat = np.array(img.pixels[:], dtype=np.float32)
        bpy.data.images.remove(img)
        return flat.reshape((h2, w2, 4))
    return _resize(arr_a), _resize(arr_b)


def numpy_to_blender_image(name, arr):
    """Create Blender image datablock from numpy RGBA array."""
    import numpy as np
    h, w = arr.shape[:2]
    flat = arr.ravel().astype(np.float32)
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels = flat.tolist()
    img.pack()
    return img


def dominant_color(arr):
    """Average RGB from downsampled pixels."""
    import numpy as np
    step = max(1, min(arr.shape[0], arr.shape[1]) // 32)
    return Color(arr[::step, ::step, :3].mean(axis=(0, 1)))


def extract_contour(pixels, num=CONTOUR_POINTS):
    """Polar-sampled contour from alpha channel. Returns (points, bounds)."""
    import numpy as np
    h, w = pixels.shape[:2]
    alpha = pixels[:, :, 3]
    ys, xs = np.where(alpha >= ALPHA_THRESHOLD)
    if len(xs) == 0:
        raise ValueError("No opaque content in front image")
    cx, cy = float(xs.mean()), float(ys.mean())

    max_r = int(math.ceil(math.hypot(max(cx, w - cx), max(cy, h - cy)))) + 1
    pts = []
    for i in range(num):
        ang = (i / num) * math.pi * 2
        dx, dy = math.cos(ang), math.sin(ang)
        r = 0
        for t in range(1, max_r):
            px, py = round(cx + dx * t), round(cy + dy * t)
            if px < 0 or px >= w or py < 0 or py >= h or alpha[py, px] < ALPHA_THRESHOLD:
                r = t - 1
                break
        pts.append((round(cx + dx * r) - cx, round(cy + dy * r) - cy))

    arr = np.array(pts)
    bx = float(arr[:, 0].min()), float(arr[:, 0].max())
    by = float(arr[:, 1].min()), float(arr[:, 1].max())
    return pts, (bx[0], by[0], bx[1], by[1])


def fit_circle(contour):
    """Fit a circle to contour points. Returns (cx, cy, radius)."""
    import numpy as np
    arr = np.array(contour)
    cx, cy = float(arr[:, 0].mean()), float(arr[:, 1].mean())
    radii = np.sqrt((arr[:, 0] - cx)**2 + (arr[:, 1] - cy)**2)
    r = float(radii.mean())
    return cx, cy, r


def make_circle_contour(cx, cy, radius, num=CONTOUR_POINTS):
    """Generate a smooth circular contour."""
    pts = []
    for i in range(num):
        ang = (i / num) * math.pi * 2
        pts.append((cx + radius * math.cos(ang), cy + radius * math.sin(ang)))
    return pts


# ── Mesh builder ──────────────────────────────────────────────────────────

def build_coin(contour, depth_px, bevel_px, tex_front, tex_back, edge_col,
               target_w, target_h, target_d):
    n = len(contour)
    d2 = depth_px / 2
    cx = sum(x for x, _ in contour) / n
    cy = sum(y for _, y in contour) / n

    bm = bmesh.new()
    front_verts = [bm.verts.new((float(x), float(y), -d2)) for x, y in contour]
    back_verts = [bm.verts.new((float(x), float(y), d2)) for x, y in contour]
    c_front = bm.verts.new((cx, cy, -d2))
    c_back = bm.verts.new((cx, cy, d2))

    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((c_front, front_verts[i], front_verts[j]))
        bm.faces.new((c_back, back_verts[j], back_verts[i]))
        bm.faces.new((front_verts[i], front_verts[j], back_verts[j], back_verts[i]))

    bm.normal_update()
    me = bpy.data.meshes.new('CoinMesh')
    bm.to_mesh(me)
    bm.free()

    obj = bpy.data.objects.new('Coin', me)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj

    # Bevel modifier
    if bevel_px > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel_px
        mod.segments = 4
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(30)
        bpy.ops.object.modifier_apply(modifier=mod.name)

    # Scale to target cm
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    shape_w = max(xs) - min(xs)
    shape_h = max(ys) - min(ys)
    scl = min(target_w / shape_w, target_h / shape_h)
    obj.scale = (scl, scl, scl)
    bpy.ops.object.transform_apply(scale=True)
    me = obj.data

    # UV + material indices (direct mesh manipulation)
    import numpy as np

    verts = me.vertices
    polys = me.polygons

    xs = np.array([v.co.x for v in verts])
    ys = np.array([v.co.y for v in verts])
    zs = np.array([v.co.z for v in verts])
    bx_min, bx_max = xs.min(), xs.max()
    by_min, by_max = ys.min(), ys.max()
    bz_min, bz_max = zs.min(), zs.max()
    bz_mid = (bz_min + bz_max) / 2
    rx, ry = bx_max - bx_min or 1, by_max - by_min or 1
    env_max = max(abs(bx_min), abs(bx_max), abs(by_min), abs(by_max)) or 1
    eps = (bz_max - bz_min) * 0.1

    # Create UV layer
    uv_layer = me.uv_layers.new(name='UVMap')

    front = back = side = 0
    for poly in polys:
        nz = abs(poly.normal.z)
        if nz > NORMAL_THRESHOLD:
            if poly.normal.z > 0:
                poly.material_index = 0  # Coin_Front
                front += 1
            else:
                poly.material_index = 1  # Coin_Back
                back += 1
        else:
            poly.material_index = 2  # Coin_Edge
            side += 1

        for loop_idx in poly.loop_indices:
            v_idx = me.loops[loop_idx].vertex_index
            vx, vy = xs[v_idx], ys[v_idx]
            if poly.material_index in (0, 1):
                uv_layer.data[loop_idx].uv = ((vx - bx_min) / rx, (vy - by_min) / ry)
            else:
                ang = math.atan2(vy, vx)
                u = (ang + math.pi) / (2 * math.pi)
                z_norm = (zs[v_idx] - bz_min) / (bz_max - bz_min) if bz_max != bz_min else 0
                uv_layer.data[loop_idx].uv = (u, z_norm)

    print(f"  Face counts: front={front} back={back} side={side}")

    # Materials — assign AFTER setting indices
    def make_mat(name, img=None, base_color=None, rough=0.3, metal=0.5):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.use_backface_culling = False
        ng = mat.node_tree
        ng.nodes.clear()
        bsdf = ng.nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.location = (0, 0)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
        out = ng.nodes.new('ShaderNodeOutputMaterial')
        out.location = (300, 0)
        ng.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
        if base_color:
            bsdf.inputs['Base Color'].default_value = (*base_color, 1)
        if img:
            tex = ng.nodes.new('ShaderNodeTexImage')
            tex.location = (-400, 0)
            tex.image = img
            ng.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
            ng.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        return mat

    mf = make_mat('Coin_Front', img=tex_front)
    mb = make_mat('Coin_Back', img=tex_back)
    edge_mat = make_mat('Coin_Edge', base_color=(edge_col.r, edge_col.g, edge_col.b),
                        rough=0.4, metal=0.7)
    me.materials.append(mf)
    me.materials.append(mb)
    me.materials.append(edge_mat)

    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    return obj


# ── Run ────────────────────────────────────────────────────────────────────

def clear_scene():
    """Remove default objects (cube, camera, lights) so only the coin is exported."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def run():
    import numpy as np
    args = parse_args()
    clear_scene()

    print(f"Loading front: {args['front']}")
    fpx, fw, fh, _ = load_pixels(args['front'])

    print(f"Loading back: {args['back']}")
    bpx, bw, bh, _ = load_pixels(args['back'])

    print("Resizing images to match …")
    fpx, bpx = resize_to_match(fpx, bpx)

    print("Extracting contours …")
    contour_front, bounds_f = extract_contour(fpx)
    contour_back, bounds_b = extract_contour(bpx)
    print(f"  front bounds: {bounds_f}")
    print(f"  back bounds:  {bounds_b}")

    print("Fitting circles …")
    cxf, cyf, rf = fit_circle(contour_front)
    cxb, cyb, rb = fit_circle(contour_back)
    r = max(rf, rb)
    print(f"  front: center=({cxf:.1f},{cyf:.1f}) r={rf:.1f}")
    print(f"  back:  center=({cxb:.1f},{cyb:.1f}) r={rb:.1f}")
    print(f"  using r={r:.1f}")

    contour = make_circle_contour(0, 0, r)
    sw = sh = r * 2
    scl = min(args['width'] / sw, args['height'] / sh)

    # Auto-depth when not specified (≈8% of average pixel dimension)
    if args['depth'] <= 0:
        depth_px = (sw + sh) / 2 * 0.08
        depth_cm = depth_px * scl
    else:
        depth_cm = args['depth']
        depth_px = depth_cm / scl

    bevel_px = max(sw, sh) * BEVEL_RATIO
    print(f"  scale={scl:.4f}  depth_px={depth_px:.2f} ({depth_cm:.3f} cm)  bevel_px={bevel_px:.2f}")

    print("Preparing textures …")
    ft = numpy_to_blender_image('tex_front', fpx)
    bt = numpy_to_blender_image('tex_back', bpx)

    print("Edge colour …")
    col = dominant_color(fpx)

    print("Building mesh …")
    build_coin(contour, depth_px, bevel_px, ft, bt, col,
               args['width'], args['height'], depth_cm)

    out = args['output']
    print(f"Exporting GLB → {out}")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
    )
    print("Done.")


if __name__ == '__main__':
    run()
