# -*- coding: utf-8 -*-
"""
抽卡十连结果图片后端

功能：
1. 接收前端 JS 提交的十连抽卡结果数据。
2. 绘制精美的抽卡结果 PNG 图片（自动布局、稀有度配色）。
3. 返回可被海豹骰 CQ:image 使用的 HTTP 图片地址。

推荐目录结构：
gacha_image_backend/
├─ gacha_image_backend.py
├─ output/
└─ fonts/
   └─ SourceHanSansCN-Regular.otf
   └─ SourceHanSansCN-Bold.otf
"""

import os
import re
import json
import uuid
import time
import datetime
from typing import Dict, List, Tuple, Optional

from flask import Flask, request, jsonify, send_from_directory
from PIL import Image, ImageDraw, ImageFont, ImageFilter

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
FONT_DIR = os.path.join(BASE_DIR, "fonts")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(FONT_DIR, exist_ok=True)

PORT = int(os.getenv("GACHA_IMAGE_PORT", "8014"))
PUBLIC_BASE_URL = os.getenv("GACHA_IMAGE_PUBLIC_BASE_URL", f"http://127.0.0.1:{PORT}").rstrip("/")

OUTPUT_MAX_AGE_HOURS = int(os.getenv("GACHA_OUTPUT_MAX_AGE_HOURS", "72"))

# =========================
# 稀有度配色方案
# =========================

RARITY_STYLE = {
    "ssr": {
        "label": "特等赏",
        "icon": "★",
        "badge_bg": (255, 237, 170, 240),
        "badge_border": (245, 200, 80, 255),
        "text_color": (180, 120, 0),
        "desc_color": (140, 95, 0),
        "accent": (255, 195, 60),
        "glow": (255, 215, 0, 35),
    },
    "sr": {
        "label": "一等赏",
        "icon": "☆",
        "badge_bg": (225, 200, 252, 220),
        "badge_border": (180, 130, 245, 255),
        "text_color": (120, 60, 200),
        "desc_color": (95, 45, 170),
        "accent": (168, 100, 240),
        "glow": (168, 85, 247, 25),
    },
    "r": {
        "label": "二等赏",
        "icon": "◆",
        "badge_bg": (200, 220, 255, 200),
        "badge_border": (100, 160, 245, 255),
        "text_color": (30, 80, 200),
        "desc_color": (40, 70, 170),
        "accent": (80, 140, 240),
        "glow": (59, 130, 246, 20),
    },
    "n": {
        "label": "末等赏",
        "icon": "●",
        "badge_bg": (230, 233, 238, 180),
        "badge_border": (160, 168, 180, 255),
        "text_color": (90, 100, 115),
        "desc_color": (110, 118, 132),
        "accent": (160, 170, 185),
        "glow": None,
    },
    "consolation": {
        "label": "非酋赏",
        "icon": "✗",
        "badge_bg": (220, 222, 228, 180),
        "badge_border": (175, 180, 192, 255),
        "text_color": (110, 115, 130),
        "desc_color": (130, 135, 148),
        "accent": (160, 165, 178),
        "glow": None,
    },
    "money": {
        "label": "金钱奖励",
        "icon": "$",
        "badge_bg": (200, 245, 210, 200),
        "badge_border": (60, 190, 100, 255),
        "text_color": (20, 130, 60),
        "desc_color": (30, 110, 55),
        "accent": (50, 185, 90),
        "glow": None,
    },
    "small_money": {
        "label": "小额金钱",
        "icon": "¢",
        "badge_bg": (230, 233, 238, 140),
        "badge_border": (175, 180, 192, 200),
        "text_color": (120, 125, 140),
        "desc_color": (140, 145, 158),
        "accent": (175, 180, 192),
        "glow": None,
    },
}

# =========================
# 基础工具
# =========================

def cleanup_output_dir(max_age_hours: int = OUTPUT_MAX_AGE_HOURS):
    now = time.time()
    max_age = max_age_hours * 3600
    for name in os.listdir(OUTPUT_DIR):
        path = os.path.join(OUTPUT_DIR, name)
        try:
            if os.path.isfile(path) and now - os.path.getmtime(path) > max_age:
                os.remove(path)
        except Exception:
            pass


def safe_text(s) -> str:
    return str(s or "").replace("\r", "").strip()


def pick_font(size: int, bold: bool = False):
    candidates = []
    if bold:
        candidates.extend([
            os.path.join(FONT_DIR, "SourceHanSansCN-Bold.otf"),
            os.path.join(FONT_DIR, "SourceHanSansSC-Bold.otf"),
            os.path.join(FONT_DIR, "NotoSansCJKsc-Bold.otf"),
            os.path.join(FONT_DIR, "NotoSansCJK-Bold.ttc"),
            os.path.join(FONT_DIR, "LXGWWenKai-Regular.ttf"),
            r"C:\Windows\Fonts\msyhbd.ttc",
            r"C:\Windows\Fonts\simhei.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        ])
    else:
        candidates.extend([
            os.path.join(FONT_DIR, "SourceHanSansCN-Regular.otf"),
            os.path.join(FONT_DIR, "SourceHanSansSC-Regular.otf"),
            os.path.join(FONT_DIR, "NotoSansCJKsc-Regular.otf"),
            os.path.join(FONT_DIR, "LXGWWenKai-Regular.ttf"),
            os.path.join(FONT_DIR, "NotoSansCJK-Regular.ttc"),
            r"C:\Windows\Fonts\msyh.ttc",
            r"C:\Windows\Fonts\simsun.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        ])
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def text_width(draw, text: str, font) -> int:
    if not text:
        return 0
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def wrap_text(draw, text: str, font, max_width: int) -> List[str]:
    text = safe_text(text)
    if not text:
        return []
    raw_lines = text.split("\n")
    result = []
    for raw in raw_lines:
        raw = raw.strip()
        if raw == "":
            result.append("")
            continue
        current = ""
        for ch in raw:
            trial = current + ch
            if text_width(draw, trial, font) <= max_width:
                current = trial
            else:
                if current:
                    result.append(current)
                    current = ch
                else:
                    result.append(ch)
        if current:
            result.append(current)
    return result


# =========================
# 图片绘制
# =========================

def draw_background(width: int, height: int) -> Image.Image:
    """绘制白底清新渐变背景"""
    top = (240, 248, 255)
    mid = (248, 250, 255)
    bottom = (255, 255, 255)

    img = Image.new("RGB", (width, height), bottom)
    draw = ImageDraw.Draw(img)

    for y in range(height):
        ratio = y / max(1, height - 1)
        if ratio < 0.4:
            r2 = ratio / 0.4
            c1, c2 = top, mid
        else:
            r2 = (ratio - 0.4) / 0.6
            c1, c2 = mid, bottom
        r = int(c1[0] * (1 - r2) + c2[0] * r2)
        g = int(c1[1] * (1 - r2) + c2[1] * r2)
        b = int(c1[2] * (1 - r2) + c2[2] * r2)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    return img


def draw_rounded_rect(draw, xy, radius: int, fill, outline=None, width: int = 2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def render_gacha_card(data: Dict, out_path: str):
    """
    绘制十连抽卡结果图片

    data 格式：
    {
        "player_name": "玩家名",
        "pool_name": "卡池名",
        "results": [
            { "index": 1, "rarity": "ssr", "text": "描述文字", "extra": "额外信息如金钱奖励" },
            ...
        ],
        "summary": { "ssr": 1, "sr": 2, "r": 3, "n": 4 },
        "title": "抽十连"  // 可选标题
    }
    """
    width = 1080
    side = 48
    card_gap = 14
    top_margin = 50
    bottom_margin = 48

    player_name = safe_text(data.get("player_name", ""))
    pool_name = safe_text(data.get("pool_name", ""))
    title = safe_text(data.get("title", "十连抽卡结果"))
    results = data.get("results", [])
    summary = data.get("summary", {})
    extra_msg = safe_text(data.get("extra_msg", ""))

    # 字体
    title_font = pick_font(46, bold=True)
    sub_font = pick_font(22, bold=False)
    badge_font = pick_font(24, bold=True)
    body_font = pick_font(26, bold=False)
    small_font = pick_font(20, bold=False)
    index_font = pick_font(20, bold=True)

    # 预计算每个卡片高度
    temp_img = Image.new("RGB", (width, 200), "white")
    temp_draw = ImageDraw.Draw(temp_img)

    card_content_width = width - side * 2 - 80  # 减去内部padding

    card_layouts = []
    for item in results:
        rarity = item.get("rarity", "n")
        text = safe_text(item.get("text", ""))
        extra = safe_text(item.get("extra", ""))

        # 描述文本换行
        desc_lines = wrap_text(temp_draw, text, body_font, card_content_width)
        if not desc_lines:
            desc_lines = [""]
        line_h = 38
        desc_h = len(desc_lines) * line_h

        # 额外信息（如金钱奖励）
        extra_lines = []
        if extra:
            extra_lines = wrap_text(temp_draw, extra, small_font, card_content_width)

        card_h = 20 + 36 + 10 + desc_h + (len(extra_lines) * 30 if extra_lines else 0) + 20
        card_layouts.append({
            "rarity": rarity,
            "desc_lines": desc_lines,
            "extra_lines": extra_lines,
            "card_h": card_h,
            "text": text,
            "extra": extra,
        })

    # 计算总高度
    total_height = top_margin + 90  # 标题区
    for cl in card_layouts:
        total_height += cl["card_h"] + card_gap
    # 汇总区
    total_height += 80 + bottom_margin
    if extra_msg:
        extra_lines = wrap_text(temp_draw, extra_msg, small_font, width - side * 2)
        total_height += len(extra_lines) * 30 + 20

    # 绘制背景
    img = draw_background(width, total_height).convert("RGBA")
    draw = ImageDraw.Draw(img)

    # 背景装饰光晕
    for item_idx, cl in enumerate(card_layouts):
        style = RARITY_STYLE.get(cl["rarity"], RARITY_STYLE["n"])
        if style["glow"]:
            glow_y = top_margin + 90 + sum(card_layouts[:item_idx + 1][i]["card_h"] + card_gap for i in range(item_idx + 1)) - cl["card_h"] // 2
            glow_layer = Image.new("RGBA", (width, total_height), (0, 0, 0, 0))
            gd = ImageDraw.Draw(glow_layer)
            gd.ellipse([width // 2 - 300, glow_y - 60, width // 2 + 300, glow_y + 60], fill=style["glow"])
            glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(20))
            img.alpha_composite(glow_layer)
            draw = ImageDraw.Draw(img)

    # 标题
    draw.text((side, top_margin), title, font=title_font, fill=(50, 60, 90))
    if player_name and pool_name:
        sub_text = f"{player_name}  |  {pool_name}"
    elif player_name:
        sub_text = player_name
    elif pool_name:
        sub_text = pool_name
    else:
        sub_text = ""
    if sub_text:
        draw.text((side, top_margin + 58), sub_text, font=sub_font, fill=(120, 130, 160))

    # 时间戳
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    ts_w = text_width(draw, now_str, small_font)
    draw.text((width - side - ts_w, top_margin + 58), now_str, font=small_font, fill=(150, 158, 178))

    # 分割线
    draw.line([(side, top_margin + 88), (width - side, top_margin + 88)], fill=(200, 208, 225, 200), width=1)

    # 绘制每张卡片
    y = top_margin + 95
    for idx, cl in enumerate(card_layouts):
        rarity = cl["rarity"]
        style = RARITY_STYLE.get(rarity, RARITY_STYLE["n"])
        item_idx = idx + 1

        x1, y1 = side, y
        x2, y2 = width - side, y + cl["card_h"]

        # 卡片阴影
        shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle([x1 + 2, y1 + 3, x2 + 2, y2 + 3], radius=16, fill=(180, 190, 210, 50))
        shadow = shadow.filter(ImageFilter.GaussianBlur(4))
        img.alpha_composite(shadow)
        draw = ImageDraw.Draw(img)

        # 卡片背景
        card_fill = (255, 255, 255, 245)
        card_border = (*style["accent"][:3], 220) if rarity in ("ssr", "sr") else (200, 205, 215, 220)
        draw_rounded_rect(draw, [x1, y1, x2, y2], radius=16, fill=card_fill, outline=card_border, width=2)

        # SSR/SR 特殊边框发光
        if rarity in ("ssr", "sr"):
            border_glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
            bgd = ImageDraw.Draw(border_glow)
            border_glow_color = (*style["accent"][:3], 50)
            bgd.rounded_rectangle([x1 - 2, y1 - 2, x2 + 2, y2 + 2], radius=18, fill=None, outline=border_glow_color, width=4)
            border_glow = border_glow.filter(ImageFilter.GaussianBlur(3))
            img.alpha_composite(border_glow)
            draw = ImageDraw.Draw(img)

        # 左侧彩色条
        bar_w = 8
        draw_rounded_rect(draw, [x1 + 8, y1 + 14, x1 + 8 + bar_w, y2 - 14], radius=4, fill=style["badge_bg"])

        # 编号 + 稀有度徽章
        badge_text = f"{item_idx:02d}"
        badge_tw = text_width(draw, badge_text, index_font)
        draw.text((x1 + 24, y1 + 12), badge_text, font=index_font, fill=(170, 175, 190))

        # 稀有度标签
        rarity_label = style.get("label", rarity)
        rarity_icon = style.get("icon", "")
        label_text = f"{rarity_icon} {rarity_label}"
        label_tw = text_width(draw, label_text, badge_font)
        label_x = x2 - label_tw - 24
        # 标签背景
        label_pad = 8
        draw_rounded_rect(
            draw,
            [label_x - label_pad, y1 + 10, label_x + label_tw + label_pad, y1 + 42],
            radius=8,
            fill=style["badge_bg"],
            outline=style["badge_border"],
            width=1,
        )
        draw.text((label_x, y1 + 12), label_text, font=badge_font, fill=style["text_color"])

        # 描述文本
        text_x = x1 + 24
        text_y = y1 + 50
        line_h = 38
        for line in cl["desc_lines"]:
            draw.text((text_x, text_y), line, font=body_font, fill=style.get("desc_color", (90, 100, 115)))
            text_y += line_h

        # 额外信息
        if cl["extra_lines"]:
            text_y += 4
            for line in cl["extra_lines"]:
                draw.text((text_x + 16, text_y), line, font=small_font, fill=(130, 140, 160))
                text_y += 30

        y += cl["card_h"] + card_gap

    # 分割线
    draw.line([(side, y + 4), (width - side, y + 4)], fill=(200, 208, 225, 200), width=1)

    # 汇总统计
    y += 16
    stat_parts = []
    if summary.get("ssr", 0) > 0:
        stat_parts.append(f"★ 特等赏 ×{summary['ssr']}")
    if summary.get("sr", 0) > 0:
        stat_parts.append(f"☆ 一等赏 ×{summary['sr']}")
    if summary.get("r", 0) > 0:
        stat_parts.append(f"◆ 二等赏 ×{summary['r']}")
    if summary.get("n", 0) > 0:
        stat_parts.append(f"● 末等赏 ×{summary['n']}")
    if summary.get("consolation", 0) > 0:
        stat_parts.append(f"✗ 非酋赏 ×{summary['consolation']}")

    if stat_parts:
        stat_text = "  |  ".join(stat_parts)
        stat_tw = text_width(draw, stat_text, sub_font)
        stat_x = (width - stat_tw) // 2
        draw.text((stat_x, y), stat_text, font=sub_font, fill=(80, 90, 120))

    # 额外消息
    if extra_msg:
        extra_lines = wrap_text(draw, extra_msg, small_font, width - side * 2)
        ey = y + 38
        for line in extra_lines:
            draw.text((side, ey), line, font=small_font, fill=(120, 128, 150))
            ey += 30

    # 底部水印
    footer = "「幸运」的馈赠，稍纵即逝。"
    ftw = text_width(draw, footer, small_font)
    draw.text(((width - ftw) // 2, total_height - 32), footer, font=small_font, fill=(160, 168, 185))

    # 保存
    img = img.convert("RGB")
    img.save(out_path, format="PNG", optimize=True)


# =========================
# 路由
# =========================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "service": "gacha_image_backend",
        "port": PORT,
        "public_base_url": PUBLIC_BASE_URL,
        "font_dir": FONT_DIR,
        "output_dir": OUTPUT_DIR,
    })


@app.route("/images/<path:filename>", methods=["GET"])
def serve_image(filename):
    return send_from_directory(OUTPUT_DIR, filename)


@app.route("/api/gacha_image", methods=["POST"])
def api_gacha_image():
    cleanup_output_dir()

    try:
        data = request.get_json(force=True, silent=False) or {}

        results = data.get("results")
        if not results or not isinstance(results, list) or len(results) == 0:
            return jsonify({"ok": False, "error": "results 不能为空"}), 400

        if len(results) > 50:
            return jsonify({"ok": False, "error": "results 最多支持 50 条"}), 400

        # 验证每条结果
        for i, r in enumerate(results):
            if not isinstance(r, dict):
                return jsonify({"ok": False, "error": f"results[{i}] 格式错误"}), 400

        filename = f"gacha_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.png"
        out_path = os.path.join(OUTPUT_DIR, filename)

        render_gacha_card(data, out_path)

        return jsonify({
            "ok": True,
            "image_url": f"{PUBLIC_BASE_URL}/images/{filename}?v={int(time.time())}",
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    print("=" * 60)
    print("[INFO] Gacha Image Backend")
    print(f"[INFO] Local URL: http://127.0.0.1:{PORT}")
    print(f"[INFO] Public image base: {PUBLIC_BASE_URL}")
    print(f"[INFO] Output dir: {OUTPUT_DIR}")
    print(f"[INFO] Font dir: {FONT_DIR}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=PORT, debug=False)
