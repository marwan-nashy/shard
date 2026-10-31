import math
import os
from PIL import Image, ImageDraw, ImageFilter

def create_shard_icon(size=512):
    # Create RGBA image with high supersampling (1024x1024 downsampled for crisp anti-aliasing)
    ss = 1024
    img = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background rounded squircle
    radius = int(ss * 0.22)
    margin = int(ss * 0.05)
    rect = [margin, margin, ss - margin, ss - margin]
    
    # Gradient background
    bg = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    bg_draw.rounded_rectangle(rect, radius=radius, fill=(20, 20, 28, 255), outline=(46, 44, 58, 255), width=8)

    # Subtle inner gradient overlay
    img.alpha_composite(bg)

    # 2. Ambient Shard Glow (blurred violet polygon)
    glow = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    shard_outer = [
        (int(ss * 0.50), int(ss * 0.14)),
        (int(ss * 0.72), int(ss * 0.36)),
        (int(ss * 0.66), int(ss * 0.68)),
        (int(ss * 0.50), int(ss * 0.86)),
        (int(ss * 0.34), int(ss * 0.68)),
        (int(ss * 0.28), int(ss * 0.36)),
    ]
    glow_draw.polygon(shard_outer, fill=(139, 92, 246, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=36))
    img.alpha_composite(glow)

    # 3. Faceted Polygons
    shard_layer = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shard_layer)

    # Key vertices
    top = (int(ss * 0.50), int(ss * 0.14))
    bot = (int(ss * 0.50), int(ss * 0.86))
    left_wing = (int(ss * 0.28), int(ss * 0.36))
    right_wing = (int(ss * 0.72), int(ss * 0.36))
    left_hip = (int(ss * 0.34), int(ss * 0.68))
    right_hip = (int(ss * 0.66), int(ss * 0.68))

    mid_top = (int(ss * 0.50), int(ss * 0.29))
    mid_left = (int(ss * 0.43), int(ss * 0.44))
    mid_right = (int(ss * 0.57), int(ss * 0.44))
    mid_center = (int(ss * 0.50), int(ss * 0.61))
    mid_bot = (int(ss * 0.50), int(ss * 0.71))

    # Facets with rich jewel colors
    facets = [
        # (points, fill_color, outline_color)
        # Top-left facet
        ([top, left_wing, mid_left, mid_top], (196, 181, 253, 255)),
        # Top-right facet
        ([top, mid_top, mid_right, right_wing], (139, 92, 246, 255)),
        # Crown highlight
        ([top, (int(ss*0.43), int(ss*0.26)), mid_top, (int(ss*0.57), int(ss*0.26))], (237, 233, 254, 255)),
        # Mid-left core
        ([mid_top, mid_left, mid_center], (168, 85, 247, 255)),
        # Mid-right core
        ([mid_top, mid_center, mid_right], (109, 40, 217, 255)),
        # Left outer wing
        ([left_wing, left_hip, mid_left], (124, 58, 237, 240)),
        # Right outer wing
        ([right_wing, mid_right, right_hip], (67, 56, 202, 245)),
        # Lower left core
        ([mid_left, left_hip, mid_bot, mid_center], (99, 102, 241, 255)),
        # Lower right core
        ([mid_right, mid_center, mid_bot, right_hip], (79, 70, 229, 255)),
        # Bottom spine left
        ([mid_bot, left_hip, bot], (79, 70, 229, 255)),
        # Bottom spine right
        ([mid_bot, bot, right_hip], (49, 46, 129, 255)),
        # Center diamond accent
        ([(int(ss*0.50), int(ss*0.44)), (int(ss*0.46), int(ss*0.52)), (int(ss*0.50), int(ss*0.60)), (int(ss*0.54), int(ss*0.52))], (245, 243, 255, 200)),
    ]

    for pts, col in facets:
        s_draw.polygon(pts, fill=col, outline=(255, 255, 255, 75))

    # Center vertical ridge highlight line
    s_draw.line([top, bot], fill=(255, 255, 255, 200), width=4)
    s_draw.line([top, mid_top], fill=(255, 255, 255, 240), width=6)
    s_draw.line([left_wing, mid_top], fill=(255, 255, 255, 140), width=3)
    s_draw.line([right_wing, mid_top], fill=(255, 255, 255, 110), width=3)

    # Top apex star shine
    s_draw.ellipse([top[0]-8, top[1]-8, top[0]+8, top[1]+8], fill=(255, 255, 255, 255))
    s_draw.ellipse([top[0]-16, top[1]-16, top[0]+16, top[1]+16], fill=(255, 255, 255, 90))

    img.alpha_composite(shard_layer)

    # Resize to desired size with high quality Lanczos filter
    final = img.resize((size, size), Image.Resampling.LANCZOS)
    return final

def main():
    os.makedirs("assets", exist_ok=True)
    os.makedirs("src-tauri/icons", exist_ok=True)
    os.makedirs("public", exist_ok=True)

    print("Generating Shard icons...")
    icon512 = create_shard_icon(512)
    icon256 = create_shard_icon(256)
    icon128 = create_shard_icon(128)
    icon32 = create_shard_icon(32)
    icon16 = create_shard_icon(16)

    # Save PNGs
    icon512.save("assets/shard.png", "PNG")
    icon512.save("src-tauri/icons/icon.png", "PNG")
    icon256.save("src-tauri/icons/128x128@2x.png", "PNG")
    icon128.save("src-tauri/icons/128x128.png", "PNG")
    icon32.save("src-tauri/icons/32x32.png", "PNG")
    icon32.save("public/favicon.png", "PNG")

    # Multi-resolution ICO for Windows
    icon512.save(
        "assets/shard.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    icon512.save(
        "src-tauri/icons/icon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    print("All Shard icons successfully generated!")

if __name__ == "__main__":
    main()
