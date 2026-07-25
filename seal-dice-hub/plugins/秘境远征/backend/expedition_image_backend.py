# -*- coding: utf-8 -*-
"""
秘境远征 — 战斗状态图片后端 v2

修复：
1. 字体查找增强：覆盖 Windows/Linux/macOS 常见字体路径，避免回退到默认位图字体
2. 所有文本字段统一走 replace_game_icons() + clean_emoji()，无遗漏
3. 标签改用中文（攻/防/盾）替代英文 ATK/DEF，兼容纯 CJK 字体
4. 新增 /api/test 端点，返回字体信息和测试图片，便于诊断

依赖：Flask, Pillow
启动：python expedition_image_backend.py
默认端口：8015
"""

import os
import re
import json
import uuid
import time
import datetime
from typing import Dict, List, Optional

from flask import Flask, request, jsonify, send_from_directory
from PIL import Image, ImageDraw, ImageFont, ImageFilter

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
FONT_DIR = os.path.join(BASE_DIR, "fonts")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(FONT_DIR, exist_ok=True)

PORT = int(os.getenv("EXPEDITION_IMAGE_PORT", "8015"))
PUBLIC_BASE_URL = os.getenv("EXPEDITION_IMAGE_PUBLIC_BASE_URL", f"http://127.0.0.1:{PORT}").rstrip("/")
OUTPUT_MAX_AGE_HOURS = int(os.getenv("EXPEDITION_OUTPUT_MAX_AGE_HOURS", "24"))

# =========================
# 字体查找（增强版）
# =========================

# 系统字体候选路径（按优先级排列）
FONT_CANDIDATES_REGULAR = [
    # 自带字体目录
    "NotoSansCJKsc-Regular.otf",
    "NotoSansCJK-Regular.ttc",
    "SourceHanSansSC-Regular.otf",
    "SourceHanSansCN-Regular.otf",
    "wqy-zenhei.ttc",
    "wqy-microhei.ttc",
    # Windows
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/msyh.ttf",
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/simsun.ttc",
    "C:/Windows/Fonts/simsun.ttf",
    "C:/Windows/Fonts/Deng.ttf",
    "C:/Windows/Fonts/FZSTK.TTF",
    # Linux
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    # macOS
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
]

FONT_CANDIDATES_BOLD = [
    # 自带字体目录
    "NotoSansCJKsc-Bold.otf",
    "NotoSansCJK-Bold.ttc",
    "SourceHanSansSC-Bold.otf",
    "SourceHanSansCN-Bold.otf",
    # Windows
    "C:/Windows/Fonts/msyhbd.ttc",
    "C:/Windows/Fonts/msyhbd.ttf",
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/Dengb.ttf",
    # Linux
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Bold.otf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    # macOS
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
]

_font_cache = {}

def find_font_file(bold=False):
    """在系统路径和 FONT_DIR 中查找可用字体文件"""
    candidates = FONT_CANDIDATES_BOLD if bold else FONT_CANDIDATES_REGULAR
    # 先查 FONT_DIR
    for name in candidates:
        if not os.path.isabs(name):
            p = os.path.join(FONT_DIR, name)
            if os.path.exists(p):
                return p
    # 再查绝对路径
    for p in candidates:
        if os.path.isabs(p) and os.path.exists(p):
            return p
    return None

def pick_font(size, bold=False):
    """获取指定大小的字体，带缓存"""
    key = (size, bold)
    if key in _font_cache:
        return _font_cache[key]

    font_path = find_font_file(bold)
    if font_path:
        try:
            font = ImageFont.truetype(font_path, size=size)
            _font_cache[key] = font
            return font
        except Exception:
            pass

    # 如果 bold 找不到，尝试用 regular 代替
    if bold:
        font_path = find_font_file(False)
        if font_path:
            try:
                font = ImageFont.truetype(font_path, size=size)
                _font_cache[key] = font
                return font
            except Exception:
                pass

    # 最后兜底：尝试任意可用的 .ttf/.ttc/.otf
    for search_dir in [FONT_DIR, "C:/Windows/Fonts", "/usr/share/fonts"]:
        if not os.path.isdir(search_dir):
            continue
        for ext in [".ttc", ".ttf", ".otf"]:
            for fname in os.listdir(search_dir):
                if fname.lower().endswith(ext):
                    try:
                        fpath = os.path.join(search_dir, fname)
                        font = ImageFont.truetype(fpath, size=size)
                        _font_cache[key] = font
                        return font
                    except Exception:
                        continue

    print(f"[WARN] No font found, falling back to default bitmap font (size={size}, bold={bold})")
    font = ImageFont.load_default()
    _font_cache[key] = font
    return font

def get_font_info():
    """返回当前字体信息，用于调试"""
    regular = find_font_file(False)
    bold = find_font_file(True)
    return {
        "regular": regular or "(default bitmap)",
        "bold": bold or regular or "(default bitmap)",
        "font_dir": FONT_DIR,
        "font_dir_exists": os.path.isdir(FONT_DIR),
        "font_dir_contents": os.listdir(FONT_DIR) if os.path.isdir(FONT_DIR) else [],
    }

# =========================
# 职业配色 & 标签（纯文字，不用emoji）
# =========================

CLASS_STYLE = {
    "warrior":   {"name": "战士",   "tag": "[战]", "color": (220, 80, 80),   "bg": (255, 235, 235)},
    "mage":      {"name": "法师",   "tag": "[法]", "color": (100, 80, 200),  "bg": (235, 230, 255)},
    "healer":    {"name": "祭司",   "tag": "[祭]", "color": (80, 180, 120),  "bg": (230, 250, 235)},
    "assassin":  {"name": "刺客",   "tag": "[刺]", "color": (180, 80, 160),  "bg": (250, 230, 245)},
    "tank":      {"name": "守卫",   "tag": "[守]", "color": (80, 130, 200),  "bg": (225, 240, 255)},
    "berserker": {"name": "狂战士", "tag": "[狂]", "color": (200, 60, 60),   "bg": (255, 225, 225)},
    "fool":      {"name": "愚者",   "tag": "[愚]", "color": (200, 160, 60),  "bg": (255, 250, 225)},
    "unknown":   {"name": "未选职", "tag": "[?]",  "color": (120, 120, 120), "bg": (240, 240, 240)},
}

# =========================
# Emoji 清洗
# =========================

def clean_emoji(text):
    """移除文本中的所有emoji字符和特殊Unicode符号，保留纯文字和ASCII"""
    if not text:
        return ""
    emoji_pattern = re.compile(
        "["
        "\U0001F000-\U0001FAFF"
        "\U0001F300-\U0001F9FF"
        "\u2600-\u27BF"
        "\u2190-\u21FF"
        "\u2300-\u23FF"
        "\u25A0-\u25FF"
        "\u2B00-\u2BFF"
        "\uFE0F"
        "\u200D"
        "\u20E3"
        "\u27C0-\u27EF"
        "\u2B50-\u2B5F"
        "]+",
        flags=re.UNICODE
    )
    result = emoji_pattern.sub("", str(text))
    result = re.sub(r" {2,}", " ", result).strip()
    return result

def replace_game_icons(text):
    """将游戏emoji替换为纯文字标签，然后清除残留emoji"""
    if not text:
        return ""
    text = str(text)
    replacements = [
        ("\u2694\ufe0f", "[攻]"),
        ("\u2694", "[攻]"),
        ("\U0001f5e1\ufe0f", "[刺]"),
        ("\U0001f5e1", "[刺]"),
        ("\U0001f6e1\ufe0f", "[防]"),
        ("\U0001f6e1", "[防]"),
        ("\u2728\ufe0f", "[圣]"),
        ("\u2728", "[圣]"),
        ("\U0001f921", "[愚]"),
        ("\U0001f479", "[魔]"),
        ("\U0001f9ca", "[冰]"),
        ("\U0001f47f", "[恶]"),
        ("\U0001f3d4\ufe0f", "[山]"),
        ("\U0001f3d4", "[山]"),
        ("\U0001f480", "[死]"),
        ("\u2764\ufe0f", "[心]"),
        ("\u2764", "[心]"),
        ("\U0001f52e", "[法]"),
        ("\U0001f624", "[怒]"),
        ("\U0001f464", "[影]"),
        ("\u23f3", "[等]"),
        ("\U0001f4d6", "[书]"),
        ("\U0001f525", "[火]"),
        ("\u2744\ufe0f", "[雪]"),
        ("\u2744", "[雪]"),
        ("\u26a0\ufe0f", "[警]"),
        ("\u26a0", "[警]"),
        ("\U0001f6ab", "[禁]"),
        ("\u274c", "[否]"),
        ("\u274e", "[否]"),
        ("\u2753", "[?]"),
        ("\u2757", "[!]"),
        ("\u2795", "[+]"),
        ("\u2796", "[-]"),
        ("\U0001f4b0", "[金]"),
        ("\U0001f48e", "[晶]"),
        ("\U0001f3c6", "[冠]"),
        ("\U0001f4aa", "[力]"),
        ("\U0001f451", "[王]"),
        ("\U0001f31f", "[星]"),
        ("\U0001f47b", "[灵]"),
        ("\U0001f474", "[老]"),
        ("\U0001f389", "[庆]"),
        ("\U0001f4a7", "[水]"),
        ("\U0001f349", "[果]"),
        ("\U0001f9c0", "[酪]"),
        ("\U0001fab8", "[蛛]"),
        ("\U0001f432", "[龙]"),
        ("\U0001f409", "[龙]"),
        ("\U0001f419", "[章]"),
        ("\U0001f436", "[犬]"),
        ("\U0001f417", "[猪]"),
        ("\U0001f400", "[鼠]"),
        ("\U0001f427", "[企]"),
        ("\U0001f9d4", "[蛮]"),
        ("\U0001f9ce", "[跪]"),
        ("\U0001f4f3", "[震]"),
        ("\U0001fa9d", "[锁]"),
        ("\U0001f50d", "[查]"),
        ("\U0001f4ca", "[表]"),
        ("\U0001f4cb", "[单]"),
        ("\U0001f3af", "[标]"),
        ("\U0001f3c1", "[旗]"),
        ("\U0001f504", "[转]"),
        ("\U0001f9ed", "[罗]"),
        ("\U0001f381", "[礼]"),
        ("\U0001f9ea", "[瓶]"),
        ("\U0001f4a8", "[速]"),
        ("\U0001f4a5", "[爆]"),
        ("\u2705", "[OK]"),
        ("\u2713", "[v]"),
        ("\u2717", "[x]"),
        ("\u26ab", "[黑]"),
        ("\u26cf", "[镐]"),
        ("\u2697", "[瓶]"),
        ("\u2699", "[齿]"),
        ("\u26b0", "[棺]"),
        ("\u26a1", "[雷]"),
        ("\U0001f3f0", "[塔]"),
        ("\U0001f3a8", "[绘]"),
        ("\U0001f3b5", "[音]"),
        ("\U0001f3af", "[靶]"),
        ("\U0001f9ed", "[针]"),
        ("\U0001faa0", "[线]"),
        ("\U0001f9f0", "[箱]"),
        ("\U0001f9f2", "[磁]"),
        ("\U0001f576", "[镜]"),
        ("\U0001f392", "[包]"),
        ("\U0001f393", "[帽]"),
        ("\U0001f391", "[面]"),
        ("\U0001f456", "[裤]"),
        ("\U0001f455", "[衣]"),
        ("\U0001f454", "[领]"),
        ("\U0001f457", "[裙]"),
        ("\U0001f458", "[泳]"),
        ("\U0001f459", "[比]"),
        ("\U0001f45a", "[衫]"),
        ("\U0001f45b", "[纽]"),
        ("\U0001f45c", "[包]"),
        ("\U0001f45d", "[手]"),
        ("\U0001f45e", "[鞋]"),
        ("\U0001f45f", "[运]"),
        ("\U0001f460", "[高]"),
        ("\U0001f461", "[凉]"),
        ("\U0001f462", "[靴]"),
        ("\U0001f3aa", "[杂]"),
        ("\U0001f3ad", "[面]"),
        ("\U0001f3ae", "[游]"),
        ("\U0001f3b1", "[台]"),
        ("\U0001f3b2", "[骰]"),
        ("\U0001f3b3", "[保]"),
        ("\U0001f3b4", "[花]"),
        ("\U0001f3b6", "[乐]"),
        ("\U0001f3b7", "[萨]"),
        ("\U0001f3b8", "[吉]"),
        ("\U0001f3b9", "[键]"),
        ("\U0001f3ba", "[小]"),
        ("\U0001f3bb", "[大]"),
        ("\U0001f3bc", "[谱]"),
        ("\U0001f3bd", "[衣]"),
        ("\U0001f3be", "[球]"),
        ("\U0001f3bf", "[雪]"),
        ("\U0001f3c0", "[篮]"),
        ("\U0001f380", "[缎]"),
        ("\U0001f382", "[蛋]"),
        ("\U0001f383", "[瓜]"),
        ("\U0001f384", "[树]"),
        ("\U0001f385", "[圣]"),
        ("\U0001f386", "[花]"),
        ("\U0001f387", "[灯]"),
        ("\U0001f388", "[球]"),
        ("\U0001f30a", "[浪]"),
        ("\U0001f30b", "[火]"),
        ("\U0001f30c", "[夜]"),
        ("\U0001f30d", "[球]"),
        ("\U0001f30e", "[月]"),
        ("\U0001f30f", "[地]"),
        ("\U0001f310", "[经]"),
        ("\U0001f311", "[新]"),
        ("\U0001f312", "[弦]"),
        ("\U0001f313", "[半]"),
        ("\U0001f314", "[凸]"),
        ("\U0001f315", "[满]"),
        ("\U0001f316", "[亏]"),
        ("\U0001f317", "[残]"),
        ("\U0001f318", "[末]"),
        ("\U0001f319", "[月]"),
        ("\U0001f31a", "[面]"),
        ("\U0001f31b", "[梦]"),
        ("\U0001f31c", "[闭]"),
        ("\U0001f31d", "[亮]"),
        ("\U0001f31e", "[日]"),
        ("\U0001f4a0", "[钻]"),
        ("\U0001f4a1", "[灯]"),
        ("\U0001f4a2", "[怒]"),
        ("\U0001f4a3", "[弹]"),
        ("\U0001f4a4", "[睡]"),
        ("\U0001f4a6", "[汗]"),
        ("\U0001f4a9", "[粪]"),
        ("\U0001f4aa", "[肌]"),
        ("\U0001f4ab", "[晕]"),
        ("\U0001f4ac", "[话]"),
        ("\U0001f4ad", "[泡]"),
        ("\U0001f4ae", "[花]"),
        ("\U0001f4af", "[百]"),
        ("\U0001f4b1", "[兑]"),
        ("\U0001f4b2", "[美]"),
        ("\U0001f4b3", "[卡]"),
        ("\U0001f4b4", "[日元]"),
        ("\U0001f4b5", "[刀]"),
        ("\U0001f4b6", "[欧]"),
        ("\U0001f4b7", "[镑]"),
        ("\U0001f4b8", "[钱]"),
        ("\U0001f4b9", "[涨]"),
        ("\U0001f4ba", "[座]"),
        ("\U0001f4bb", "[电]"),
        ("\U0001f4bc", "[盘]"),
        ("\U0001f4bd", "[光]"),
        ("\U0001f4be", "[软]"),
        ("\U0001f4bf", "[光]"),
        ("\U0001f4c0", "[光]"),
        ("\U0001f4c1", "[夹]"),
        ("\U0001f4c2", "[档]"),
        ("\U0001f4c3", "[页]"),
        ("\U0001f4c4", "[页]"),
        ("\U0001f4c5", "[历]"),
        ("\U0001f4c6", "[日]"),
        ("\U0001f4c7", "[记]"),
        ("\U0001f4c8", "[图]"),
        ("\U0001f4c9", "[线]"),
        ("\U0001f4cf", "[尺]"),
        ("\U0001f4d0", "[三]"),
        ("\U0001f4d1", "[签]"),
        ("\U0001f4d2", "[书]"),
        ("\U0001f4d3", "[本]"),
        ("\U0001f4d4", "[书]"),
        ("\U0001f4d5", "[书]"),
        ("\U0001f4d6", "[书]"),
        ("\U0001f4d7", "[书]"),
        ("\U0001f4d8", "[书]"),
        ("\U0001f4d9", "[书]"),
        ("\U0001f4da", "[书]"),
        ("\U0001f4db", "[名]"),
        ("\U0001f4dc", "[卷]"),
        ("\U0001f4dd", "[记]"),
        ("\U0001f4de", "[话]"),
        ("\U0001f4df", "[呼]"),
        ("\U0001f4e0", "[传]"),
        ("\U0001f4e1", "[天]"),
        ("\U0001f4e2", "[广]"),
        ("\U0001f4e3", "[喊]"),
        ("\U0001f4e4", "[收]"),
        ("\U0001f4e5", "[箱]"),
        ("\U0001f4e6", "[包]"),
        ("\U0001f4e7", "[邮]"),
        ("\U0001f4e8", "[信]"),
        ("\U0001f4e9", "[信]"),
        ("\U0001f4ea", "[送]"),
        ("\U0001f4eb", "[邮]"),
        ("\U0001f4ec", "[收]"),
        ("\U0001f4ed", "[拒]"),
        ("\U0001f4ee", "[箱]"),
        ("\U0001f4ef", "[传]"),
        ("\U0001f4f0", "[报]"),
        ("\U0001f4f1", "[传真]"),
        ("\U0001f4f2", "[电]"),
        ("\U0001f4f3", "[振]"),
        ("\U0001f4f4", "[关机]"),
        ("\U0001f4f5", "[开]"),
        ("\U0001f4f6", "[天]"),
        ("\U0001f4f7", "[信]"),
        ("\U0001f4f8", "[相]"),
        ("\U0001f4f9", "[摄]"),
        ("\U0001f4fa", "[视]"),
        ("\U0001f4fb", "[音]"),
        ("\U0001f4fc", "[音]"),
    ]
    for emoji, tag in replacements:
        text = text.replace(emoji, tag)
    return clean_emoji(text)


def sanitize(text):
    """统一文本清洗：替换emoji图标 + 清除残留emoji + 去多余空格"""
    if not text:
        return ""
    return replace_game_icons(str(text))


# =========================
# 工具函数
# =========================

def cleanup_output_dir(max_age_hours=OUTPUT_MAX_AGE_HOURS):
    now = time.time()
    max_age = max_age_hours * 3600
    for name in os.listdir(OUTPUT_DIR):
        path = os.path.join(OUTPUT_DIR, name)
        try:
            if os.path.isfile(path) and now - os.path.getmtime(path) > max_age:
                os.remove(path)
        except:
            pass

def text_width(draw, text, font):
    if not text:
        return 0
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]

def hp_bar(draw, x, y, w, h, cur, max_hp, color=(80, 200, 80)):
    ratio = max(0, min(1, cur / max(max_hp, 1)))
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=(230, 230, 235))
    fill_w = int(w * ratio)
    if fill_w > 0:
        draw.rounded_rectangle([x, y, x + fill_w, y + h], radius=h // 2, fill=color)
    return ratio

def draw_rounded_rect(draw, xy, radius, fill, outline=None, width=2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

# =========================
# 图片绘制
# =========================

def render_battle_status(data, out_path):
    W = 900
    side = 30
    gap = 12

    title_font = pick_font(38, bold=True)
    sub_font = pick_font(22, bold=False)
    name_font = pick_font(26, bold=True)
    stat_font = pick_font(22, bold=False)
    small_font = pick_font(18, bold=False)
    boss_font = pick_font(30, bold=True)
    boss_stat_font = pick_font(22, bold=False)

    header_h = 80
    boss_h = 100 if data.get("boss") else 0
    player_card_h = 95
    players = data.get("players", [])
    footer_h = 40

    total_h = header_h + boss_h + gap * 2
    total_h += len(players) * (player_card_h + gap)
    total_h += footer_h + 20

    bg_top = (30, 35, 50)
    bg_bottom = (20, 22, 35)
    img = Image.new("RGB", (W, total_h), bg_bottom)
    draw = ImageDraw.Draw(img)
    for y in range(total_h):
        ratio = y / max(1, total_h - 1)
        r = int(bg_top[0] * (1 - ratio) + bg_bottom[0] * ratio)
        g = int(bg_top[1] * (1 - ratio) + bg_bottom[1] * ratio)
        b = int(bg_top[2] * (1 - ratio) + bg_bottom[2] * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    img = img.convert("RGBA")
    draw = ImageDraw.Draw(img)

    # 标题
    draw.text((side, 20), "秘境远征 - 战斗状态", font=title_font, fill=(255, 255, 255))

    # 副标题：所有字段都清洗
    sub_parts = []
    room_id = sanitize(data.get("room_id", ""))
    if room_id:
        sub_parts.append(room_id)
    sub_parts.append("第" + str(data.get("boss_stage", 0)) + "/" + str(data.get("max_bosses", 3)) + "关")
    sub_parts.append("回合" + str(data.get("fight_round", 0)))
    tp = sanitize(data.get("turn_player", ""))
    if tp:
        sub_parts.append("> " + tp)
    sub_text = "  |  ".join(sub_parts)
    draw.text((side, 56), sub_text, font=sub_font, fill=(160, 170, 200))

    now_str = datetime.datetime.now().strftime("%H:%M")
    tw = text_width(draw, now_str, small_font)
    draw.text((W - side - tw, 56), now_str, font=small_font, fill=(120, 130, 155))

    draw.line([(side, 76), (W - side, 76)], fill=(60, 70, 100), width=1)

    y = 84

    # BOSS区
    boss = data.get("boss")
    if boss:
        boss_name = sanitize(boss.get("name", "?"))
        boss_hp = boss.get("hp", 0)
        boss_max = boss.get("max_hp", 1)
        boss_atk = boss.get("attack", 0)
        boss_def = boss.get("defense", 0)

        draw_rounded_rect(draw, [side, y, W - side, y + 88], radius=12,
                          fill=(50, 25, 25, 200), outline=(180, 60, 60, 180), width=2)

        boss_label = "[BOSS] " + boss_name
        draw.text((side + 16, y + 10), boss_label, font=boss_font, fill=(255, 200, 100))

        stat_text = "攻:" + str(boss_atk) + "  防:" + str(boss_def)
        stw = text_width(draw, stat_text, boss_stat_font)
        draw.text((W - side - stw - 16, y + 14), stat_text, font=boss_stat_font, fill=(220, 180, 140))

        bar_x = side + 16
        bar_y = y + 56
        bar_w = W - side * 2 - 32
        bar_h = 20
        hp_bar(draw, bar_x, bar_y, bar_w, bar_h, boss_hp, boss_max, color=(220, 60, 60))
        hp_text = str(max(0, boss_hp)) + "/" + str(boss_max)
        htw = text_width(draw, hp_text, stat_font)
        draw.text((bar_x + bar_w // 2 - htw // 2, bar_y - 2), hp_text, font=stat_font, fill=(255, 255, 255))

        y += 88 + gap

    # 玩家区
    for p in players:
        cls_id = p.get("class_id", "unknown")
        cls_style = CLASS_STYLE.get(cls_id, CLASS_STYLE["unknown"])
        p_name = sanitize(p.get("name", "?"))
        p_hp = p.get("hp", 0)
        p_max = p.get("max_hp", 1)
        p_atk = p.get("attack", 0)
        p_def = p.get("defense", 0)
        alive = p.get("alive", True)
        shield = p.get("shield", 0)
        buffs = p.get("buffs", [])
        skills_cd = p.get("skills_cd", [])

        card_h = player_card_h

        if alive:
            card_fill = (*cls_style["bg"], 30)
            card_border = (*cls_style["color"], 120)
        else:
            card_fill = (40, 40, 45, 150)
            card_border = (80, 80, 85, 100)

        draw_rounded_rect(draw, [side, y, W - side, y + card_h], radius=10,
                          fill=card_fill, outline=card_border, width=2)

        bar_color = (*cls_style["color"], 200) if alive else (80, 80, 80, 100)
        draw_rounded_rect(draw, [side + 6, y + 10, side + 10, y + card_h - 10], radius=3, fill=bar_color)

        name_text = cls_style["tag"] + " " + p_name
        if not alive:
            name_text += " [倒下]"
        name_color = (255, 255, 255) if alive else (140, 140, 145)
        draw.text((side + 18, y + 8), name_text, font=name_font, fill=name_color)

        stat_text = "攻:" + str(p_atk) + "  防:" + str(p_def)
        if shield > 0:
            stat_text += "  盾+" + str(shield)
        stw = text_width(draw, stat_text, stat_font)
        draw.text((W - side - stw - 16, y + 12), stat_text, font=stat_font,
                  fill=(200, 210, 230) if alive else (100, 100, 110))

        bar_x = side + 18
        bar_y = y + 48
        bar_w = W - side * 2 - 36 - 120
        bar_h = 18
        if alive:
            hp_ratio = p_hp / max(p_max, 1)
            hp_color = (80, 200, 80) if hp_ratio > 0.4 else (250, 200, 60) if hp_ratio > 0.2 else (220, 70, 70)
            hp_bar(draw, bar_x, bar_y, bar_w, bar_h, p_hp, p_max, color=hp_color)
        else:
            hp_bar(draw, bar_x, bar_y, bar_w, bar_h, 0, p_max, color=(60, 60, 60))

        hp_text = str(max(0, p_hp)) + "/" + str(p_max)
        draw.text((bar_x + 6, bar_y - 1), hp_text, font=small_font, fill=(255, 255, 255))

        # Buff标签 — 全部清洗
        buff_x = bar_x + bar_w + 8
        for bi, buff_text in enumerate(buffs[:3]):
            clean_buff = sanitize(buff_text)
            if not clean_buff:
                continue
            bw = text_width(draw, clean_buff, small_font) + 10
            bx = buff_x + bi * (bw + 4)
            if bx + bw > W - side - 8:
                break
            draw_rounded_rect(draw, [bx, bar_y - 1, bx + bw, bar_y + 19], radius=8,
                            fill=(60, 80, 120, 200), outline=(100, 130, 180, 180), width=1)
            draw.text((bx + 5, bar_y), clean_buff, font=small_font, fill=(180, 200, 255))

        # 技能CD — 全部清洗
        if alive and skills_cd:
            cd_y = y + 72
            cd_x = side + 18
            for sk in skills_cd[:4]:
                sk_name = sanitize(sk.get("name", "?"))
                sk_cd = sk.get("cd", 0)
                if sk_cd > 0:
                    cd_text = sk_name + "(" + str(sk_cd) + ")"
                    cd_color = (140, 140, 150)
                else:
                    cd_text = sk_name + "[OK]"
                    cd_color = (100, 220, 120)
                draw.text((cd_x, cd_y), cd_text, font=small_font, fill=cd_color)
                cd_x += text_width(draw, cd_text, small_font) + 12
                if cd_x > W - side - 80:
                    break

        y += card_h + gap

    # 底部
    footer = "秘境远征 v3.0"
    ftw = text_width(draw, footer, small_font)
    draw.text(((W - ftw) // 2, total_h - 30), footer, font=small_font, fill=(80, 88, 110))

    img = img.convert("RGB")
    img.save(out_path, format="PNG", optimize=True)

def render_round_summary(data, out_path):
    W = 820
    side = 30
    gap = 10

    title_font = pick_font(36, bold=True)
    msg_font = pick_font(22, bold=False)
    summary_font = pick_font(24, bold=True)
    small_font = pick_font(18, bold=False)

    raw_messages = data.get("messages", [])
    boss = data.get("boss", {})
    players = data.get("players", [])

    # 清洗所有消息
    messages = []
    for m in raw_messages:
        if not m:
            continue
        cleaned = sanitize(m)
        if cleaned:
            messages.append(cleaned)

    max_msg_chars_per_line = 38

    msg_wrapped = []
    for m in messages:
        for sub in m.split("\n"):
            sub = sub.strip()
            if not sub:
                continue
            while len(sub) > max_msg_chars_per_line:
                msg_wrapped.append(sub[:max_msg_chars_per_line])
                sub = sub[max_msg_chars_per_line:]
            msg_wrapped.append(sub)

    msg_line_h = 32
    msg_area_h = len(msg_wrapped) * msg_line_h + 20
    summary_h = 100 if boss else 40
    total_h = 70 + msg_area_h + gap + summary_h + 30

    bg_top = (28, 32, 48)
    bg_bottom = (18, 20, 32)
    img = Image.new("RGB", (W, total_h), bg_bottom)
    draw = ImageDraw.Draw(img)
    for y in range(total_h):
        ratio = y / max(1, total_h - 1)
        r = int(bg_top[0] * (1 - ratio) + bg_bottom[0] * ratio)
        g = int(bg_top[1] * (1 - ratio) + bg_bottom[1] * ratio)
        b = int(bg_top[2] * (1 - ratio) + bg_bottom[2] * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    img = img.convert("RGBA")
    draw = ImageDraw.Draw(img)

    title = "第" + str(data.get("fight_round", "?")) + "回合 - 关卡" + str(data.get("boss_stage", "?"))
    draw.text((side, 18), title, font=title_font, fill=(255, 255, 255))

    draw.line([(side, 60), (W - side, 60)], fill=(60, 70, 100), width=1)

    y = 68
    for line in msg_wrapped:
        color = (220, 220, 230)
        if "BOSS" in line or "boss" in line or "[魔]" in line or "[冰]" in line:
            color = (255, 180, 120)
        elif "被击败" in line or "击败" in line:
            color = (100, 255, 120)
        elif "倒下" in line or "阵亡" in line or "失败" in line:
            color = (255, 100, 100)
        elif "治疗" in line or "恢复" in line or "HP" in line or "[心]" in line:
            color = (120, 255, 150)
        elif "暴击" in line or "影步" in line:
            color = (255, 200, 80)
        draw.text((side + 4, y), line, font=msg_font, fill=color)
        y += msg_line_h

    y += gap

    draw.line([(side, y), (W - side, y)], fill=(60, 70, 100), width=1)
    y += 8

    if boss:
        boss_name = sanitize(boss.get("name", "?"))
        boss_hp = boss.get("hp", 0)
        boss_max = boss.get("max_hp", 1)
        draw.text((side, y), "[BOSS] " + boss_name + " HP:" + str(max(0, boss_hp)) + "/" + str(boss_max), font=summary_font, fill=(255, 200, 100))
        y += 32

    for p in players:
        p_name = sanitize(p.get("name", "?"))
        p_hp = p.get("hp", 0)
        p_max = p.get("max_hp", 1)
        alive = p.get("alive", True)
        color = (200, 220, 240) if alive else (120, 120, 130)
        shield = p.get("shield", 0)
        shield_text = " 盾" + str(shield) if shield > 0 else ""
        status = "" if alive else " [倒下]"
        draw.text((side, y), p_name + status + " HP:" + str(p_hp) + "/" + str(p_max) + shield_text, font=small_font, fill=color)
        y += 24

    img = img.convert("RGB")
    img.save(out_path, format="PNG", optimize=True)

# =========================
# 路由
# =========================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "service": "expedition_image_backend",
        "port": PORT,
        "public_base_url": PUBLIC_BASE_URL,
        "font_info": get_font_info(),
    })

@app.route("/api/test", methods=["GET"])
def api_test():
    """生成测试图片，用于诊断字体和渲染问题"""
    test_data = {
        "room_id": "测试房间",
        "boss_stage": 1,
        "max_bosses": 3,
        "fight_round": 3,
        "turn_player": "测试勇者",
        "boss": {
            "name": "测试BOSS",
            "hp": 500,
            "max_hp": 800,
            "attack": 30,
            "defense": 15
        },
        "players": [
            {
                "class_id": "warrior",
                "name": "勇者",
                "hp": 100,
                "max_hp": 120,
                "attack": 35,
                "defense": 12,
                "alive": True,
                "shield": 20,
                "buffs": ["强化3", "护盾20"],
                "skills_cd": [
                    {"name": "重击", "cd": 0},
                    {"name": "战吼", "cd": 2}
                ]
            },
            {
                "class_id": "mage",
                "name": "法师",
                "hp": 60,
                "max_hp": 80,
                "attack": 50,
                "defense": 5,
                "alive": True,
                "shield": 0,
                "buffs": ["奥术亲和"],
                "skills_cd": [
                    {"name": "火球术", "cd": 1}
                ]
            }
        ]
    }
    filename = "exp_test_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + ".png"
    out_path = os.path.join(OUTPUT_DIR, filename)
    render_battle_status(test_data, out_path)
    return jsonify({
        "ok": True,
        "image_url": PUBLIC_BASE_URL + "/images/" + filename + "?v=" + str(int(time.time())),
        "font_info": get_font_info(),
    })

@app.route("/images/<path:filename>", methods=["GET"])
def serve_image(filename):
    return send_from_directory(OUTPUT_DIR, filename)

@app.route("/api/battle_status", methods=["POST"])
def api_battle_status():
    cleanup_output_dir()
    try:
        data = request.get_json(force=True, silent=False) or {}
        players = data.get("players")
        if not players:
            return jsonify({"ok": False, "error": "players 不能为空"}), 400

        filename = "exp_st_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8] + ".png"
        out_path = os.path.join(OUTPUT_DIR, filename)
        render_battle_status(data, out_path)

        return jsonify({
            "ok": True,
            "image_url": PUBLIC_BASE_URL + "/images/" + filename + "?v=" + str(int(time.time())),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/round_summary", methods=["POST"])
def api_round_summary():
    cleanup_output_dir()
    try:
        data = request.get_json(force=True, silent=False) or {}
        messages = data.get("messages")
        if not messages:
            return jsonify({"ok": False, "error": "messages 不能为空"}), 400

        filename = "exp_rv_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8] + ".png"
        out_path = os.path.join(OUTPUT_DIR, filename)
        render_round_summary(data, out_path)

        return jsonify({
            "ok": True,
            "image_url": PUBLIC_BASE_URL + "/images/" + filename + "?v=" + str(int(time.time())),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    print("=" * 60)
    print("[INFO] Expedition Image Backend v2")
    print("[INFO] Local URL: http://127.0.0.1:" + str(PORT))
    print("[INFO] Public image base: " + PUBLIC_BASE_URL)
    print("[INFO] Output dir: " + OUTPUT_DIR)
    print("[INFO] Font dir: " + FONT_DIR)
    fi = get_font_info()
    print("[INFO] Regular font: " + str(fi["regular"]))
    print("[INFO] Bold font: " + str(fi["bold"]))
    print("[INFO] Test endpoint: http://127.0.0.1:" + str(PORT) + "/api/test")
    print("=" * 60)
    app.run(host="0.0.0.0", port=PORT, debug=False)
