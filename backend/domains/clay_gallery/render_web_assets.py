"""Run with Blender in background mode to derive a web model and thumbnail."""

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def point_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render(source, output, target_triangles):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise ValueError("The file has no renderable mesh.")
    initial = sum(len(obj.data.polygons) for obj in meshes)
    ratio = min(1, target_triangles / initial)
    if ratio < 1:
        for obj in meshes:
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new("Web mesh reduction", "DECIMATE")
            modifier.ratio = ratio
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.export_scene.gltf(filepath=str(output / "web.glb"), export_format="GLB")
    print(f"Mesh faces: {initial} -> {sum(len(obj.data.polygons) for obj in meshes)}", flush=True)

    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    lower = Vector([min(point[i] for point in corners) for i in range(3)])
    upper = Vector([max(point[i] for point in corners) for i in range(3)])
    center = (lower + upper) / 2
    span = max(upper - lower)
    if span <= 0:
        raise ValueError("The mesh has no visible extent.")
    scene = bpy.context.scene
    bpy.ops.object.camera_add(location=center + span * Vector((0.28, -2.8, 0.23)))
    camera = bpy.context.object
    point_at(camera, center)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = span * 1.15
    camera.data.clip_end = max(100, span * 10)
    scene.camera = camera
    for offset, power, size in [
        ((-1.4, -2, 2.5), 950, 2.8),
        ((2, -1.5, 1.2), 510, 3),
        ((0.1, 1.5, 2.2), 820, 2),
    ]:
        bpy.ops.object.light_add(type="AREA", location=center + span * Vector(offset))
        light = bpy.context.object
        point_at(light, center)
        light.data.energy = 0.4 * power * span * span
        light.data.shape = "DISK"
        light.data.size = size * span
    scene.world = bpy.data.worlds.new("Thumbnail background")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs[0].default_value = (0.045, 0.049, 0.058, 1)
    scene.world.node_tree.nodes.get("Background").inputs[1].default_value = 0.65
    scene.view_settings.view_transform = "Standard"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 86
    scene.render.filepath = str(output / "thumbnail.jpg")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--faces", type=int, default=85000)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    render(args.source.resolve(), args.output.resolve(), args.faces)
