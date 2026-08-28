#!/usr/bin/env python3
"""Generates placeholder app icons for AI Games.
Simple gradient + game-controller glyph. Swap these files out later with real artwork
(keep the same filenames and sizes so index.html / manifest.webmanifest don't need edits)."""
import math
from PIL import Image, ImageDraw

OUT_DIR = "icons"
import os
os.makedirs(OUT_DIR, exist_ok=True)

COLOR_A = (108, 79, 224)   # #6c4fe0
COLOR_B = (255, 93, 162)   # #ff5da2

def gradient_square(size, supersample=4):
    s = size * supersample
    base = Image.new("RGB", (s, s))
    px = base.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s)
            r = int(COLOR_A[0] + (COLOR_B[0] - COLOR_A[0]) * t)
            g = int(COLOR_A[1] + (COLOR_B[1] - COLOR_A[1]) * t)
            b = int(COLOR_A[2] + (COLOR_B[2] - COLOR_A[2]) * t)
            px[x, y] = (r, g, b)
    return base, s

def rounded_mask(size, radius_ratio=0.22):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask

def draw_controller(draw, cx, cy, w, scale=1.0):
    """Draws a simple white game-controller glyph centered at (cx, cy), width w."""
    h = w * 0.56
    body_w = w
    body_h = h
    left = cx - body_w / 2
    top = cy - body_h / 2
    radius = body_h * 0.5

    # main body (stadium shape)
    draw.rounded_rectangle(
        [left, top, left + body_w, top + body_h],
        radius=radius, fill=(255, 255, 255, 255)
    )

    # d-pad (cross) on the left
    dpad_cx = left + body_w * 0.28
    dpad_cy = top + body_h * 0.5
    arm_len = body_h * 0.34
    arm_th = body_h * 0.13
    draw.rounded_rectangle(
        [dpad_cx - arm_th/2, dpad_cy - arm_len/2, dpad_cx + arm_th/2, dpad_cy + arm_len/2],
        radius=arm_th*0.3, fill=(COLOR_A[0], COLOR_A[1], COLOR_A[2], 255)
    )
    draw.rounded_rectangle(
        [dpad_cx - arm_len/2, dpad_cy - arm_th/2, dpad_cx + arm_len/2, dpad_cy + arm_th/2],
        radius=arm_th*0.3, fill=(COLOR_A[0], COLOR_A[1], COLOR_A[2], 255)
    )

    # two round buttons on the right
    btn_r = body_h * 0.155
    b1x = left + body_w * 0.68
    b2x = left + body_w * 0.82
    b1y = top + body_h * 0.62
    b2y = top + body_h * 0.34
    draw.ellipse([b1x-btn_r, b1y-btn_r, b1x+btn_r, b1y+btn_r], fill=(COLOR_B[0], COLOR_B[1], COLOR_B[2], 255))
    draw.ellipse([b2x-btn_r, b2y-btn_r, b2x+btn_r, b2y+btn_r], fill=(COLOR_B[0], COLOR_B[1], COLOR_B[2], 255))

def make_icon(size, rounded=True, safe_margin_ratio=0.0, filename=None):
    grad, s = gradient_square(size)
    grad = grad.convert("RGBA")
    if rounded:
        mask = rounded_mask(s, 0.22)
        grad.putalpha(mask)
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    glyph_w = s * (1 - safe_margin_ratio * 2) * 0.62
    draw_controller(draw, s/2, s/2, glyph_w)
    combined = Image.alpha_composite(grad, layer)
    combined = combined.resize((size, size), Image.LANCZOS)
    if filename:
        combined.save(filename)
    return combined

def make_apple_touch_icon(size, filename):
    # iOS ignores alpha and paints transparent as black, so this must be fully opaque
    # and iOS already applies its own rounding, so we export a plain square.
    grad, s = gradient_square(size)
    grad = grad.convert("RGBA")
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw_controller(draw, s/2, s/2, s*0.62)
    combined = Image.alpha_composite(grad, layer).convert("RGB")
    combined = combined.resize((size, size), Image.LANCZOS)
    combined.save(filename)

make_icon(192, rounded=True, filename=f"{OUT_DIR}/icon-192.png")
make_icon(512, rounded=True, filename=f"{OUT_DIR}/icon-512.png")
# Maskable icon: no rounding baked in (the OS applies its own mask shape),
# and content kept inside the ~66% "safe zone" circle so it survives any mask.
make_icon(512, rounded=False, safe_margin_ratio=0.17, filename=f"{OUT_DIR}/icon-maskable-512.png")
make_apple_touch_icon(180, f"{OUT_DIR}/apple-touch-icon.png")
make_icon(32, rounded=True, filename=f"{OUT_DIR}/favicon-32.png")

print("Icons written to", OUT_DIR)
