// ==UserScript==
// @name 综合功能包：背包 + 钓鱼 + 抽签 + 探险
// @author L.Y.
// @version 1.0.0
// @description 完整背包系统 + 钓鱼/抽签/探险三个子系统，语言模组可自定义
// @license CC-BY-NC-SA 4.0
// ==/UserScript>>

// ================================================================
//  ╔══════════════════════════════════════════════════════════════╗
//  ║                    一、语言模组（用户自定义）                ║
//  ║  改这里可以切换整体风格（日常/东方/西方），文本全局生效     ║
//  ╚══════════════════════════════════════════════════════════════╝
// ================================================================

const LANG = {

  // ---- 通用 ----
  SYS_NAME: "综合功能包",
  NO_MONEY: "囊中羞涩……钱包比脸还干净。",
  NO_ENERGY: "今天已经没有精力了，明天再来吧。",
  NO_ITEM: "你翻遍了背包也没找到这个东西。",

  // ---- 背包 ----
  PACK_EMPTY: "背包空空如也，连灰尘都没有。",
  PACK_FULL: "背包满了！先清理一下再继续吧。",
  PACK_VIEW: "你的背包（{used}/{max}）：",
  PACK_SELL_OK: "出售了 {item} x{count}，获得 {money} 金钱。",
  PACK_USE_OK: "使用了 {item}。",
  PACK_DISCARD_OK: "丢弃了 {item} x{count}。",
  PACK_GIVE_OK: "递出了 {item}。{name} 收下了。",

  // ---- 钓鱼 ----
  FISH_START: "你来到{place}，抛下了鱼线……",
  FISH_NOTHING: "水面一片平静……什么都没有。再等等吧。",
  FISH_CAUGHT: "鱼漂沉了！你钓到了{fish}！",
  FISH_BIG: "鱼线猛然绷紧——你费力拉起，竟是一条{fish}！",
  FISH_RARE: "水面泛起异样的波纹……你屏住呼吸提竿——{fish}！",
  FISH_LEGEND: "水面炸开！金光冲天而起！！你钓到了——{fish}！！！",
  FISH_SELL_ALL: "你把所有的鱼都卖掉了，获得 {money} 金钱。",
  FISH_NO_FISH: "背包里没有鱼可以卖。",

  // ---- 水域 ----
  WATER_POND:     "村边小池塘",
  WATER_LAKE:     "幽静湖泊",
  WATER_RIVER:    "湍急河流",
  WATER_COAST:    "浅海海岸",
  WATER_DEEPSEA:  "深海海域",
  WATER_MYSTERY:  "神秘水域",

  // ---- 抽签 ----
  DIVINE_TITLE: "✦ 今日运势 ✦",
  DIVINE_SIGN: "你抽到了：{sign}",
  DIVINE_ALREADY: "今天已经抽过了，你的运势是：{sign}",
  DIVINE_RERUN: "你消耗 20 水晶改签……新运势：{sign}",
  DIVINE_NO_CRYSTAL: "水晶不够，改签需要 20 水晶。",
  DIVINE_ADVICE: "建议：{advice}",
  DIVINE_BUFF: "今日效果：{buff}",

  // ---- 探险 ----
  EXP_START: "你准备好补给，踏入了{place}……",
  EXP_ENTER: "\n你来到了{place}。",
  EXP_FIGHT: "⚔ 遭遇战！你击败了{monster}，获得了战利品。",
  EXP_FIGHT_LOSE: "⚔ 遭遇战！你没能打过{monster}，灰溜溜地逃了。",
  EXP_TREASURE: "🎁 你发现了一个宝箱！获得了{item}。",
  EXP_TRAP: "⚠ 触发了陷阱！损失了{value}金钱。",
  EXP_REST: "💤 你找到了一处安全的地方，稍作休息。",
  EXP_DISCOVERY: "🔍 你发现了一些有趣的东西——{item}。",
  EXP_END: "\n探险结束！收获：{result}",
  EXP_END_EMPTY: "\n探险结束……虽然没什么收获，但至少活着回来了。",

  // ---- 区域 ----
  ZONE_FOREST:    "幽静森林",
  ZONE_CAVE:      "阴暗洞穴",
  ZONE_RUINS:     "古老遗迹",
  ZONE_VOLCANO:   "龙息火山",
  ZONE_ABYSS:     "虚空裂隙",

  // ---- 怪物名 ----
  MONSTERS: ["史莱姆", "野狼", "蝙蝠群", "哥布林", "巨型蜘蛛", "骷髅兵", "幽灵"],
  // 东方风格替换参考：["山魈", "狐妖", "飞头蛮", "河童", "土蜘蛛", "骸骨兵", "游魂"]
  // 西方风格替换参考：["Slime", "Dire Wolf", "Bat Swarm", "Goblin", "Giant Spider", "Skeleton", "Wraith"]

  // ---- 签文（12 种） ----
  SIGNS: [
    { name: "大吉",     icon: "🌟🌟", desc: "万事顺遂，心想事成。", buff: "今日所有系统好感度变化 +1" },
    { name: "吉",       icon: "⭐",   desc: "一切顺利，宜主动出击。", buff: "今日钓鱼稀有率提升" },
    { name: "中吉",     icon: "✨",   desc: "尚可，稳步前进即可。", buff: "今日探险获得物品概率提升" },
    { name: "小吉",     icon: "🌤",   desc: "略有小运，知足常乐。", buff: "今日送礼好感下限 +1" },
    { name: "末吉",     icon: "🌥",   desc: "不好不坏，平平淡淡。", buff: "无特殊效果" },
    { name: "末小吉",   icon: "🌦",   desc: "微有小运，但不足以成事。", buff: "无特殊效果" },
    { name: "半吉",     icon: "⛅",   desc: "一半运气，一半努力。", buff: "今日金钱消耗减半（向下取整）" },
    { name: "先凶后吉", icon: "🌩→🌤", desc: "起初不顺，但结局尚好。", buff: "探险首轮事件必定为正面" },
    { name: "凶",       icon: "🌧",   desc: "诸事不宜，宜静不宜动。", buff: "无特殊效果" },
    { name: "小凶",     icon: "🌨",   desc: "不太妙，凡事多留个心眼。", buff: "无特殊效果" },
    { name: "大凶",     icon: "⛈",   desc: "……要不今天回去睡觉？", buff: "无特殊效果" },
    { name: "无印",     icon: "🌀",   desc: "不可解，不可说，不可测。", buff: "今日一切随机波动翻倍（好坏都翻）" },
  ],
  ADVICE: {
    "大吉": "去买张彩票吧——哦不对，你已经在这里了。",
    "吉": "今天适合主动出击，去钓个鱼或者探险吧。",
    "中吉": "稳步前进，不要冒进。",
    "小吉": "小确幸也是幸福，去和{bot}打个招呼吧。",
    "末吉": "今天适合躺平。",
    "末小吉": "要不……去睡个回笼觉？",
    "半吉": "运气不够，努力来凑。",
    "先凶后吉": "开头不顺别灰心，结局会好的。",
    "凶": "宜宅家，忌出门。",
    "小凶": "今天诸事不宜……建议你去抽个签（？）",
    "大凶": "回床上，盖好被子，明天会好的。",
    "无印": "你凝视着深渊，深渊也在凝视着你。",
  },
};

// ================================================================
//  ╔══════════════════════════════════════════════════════════════╗
//  ║              二、物品定义（背包 + 钓鱼 + 探险）             ║
//  ╚══════════════════════════════════════════════════════════════╝
// ================================================================

const ITEMS = {
  // ===== 鱼类 =====
  // 格式：id: { name, type: "fish", value: 出售价, tier: 稀有度(1-5), desc, source: 来源水域 }
  minnow:     { name: "小鲫鱼",   type: "fish",  value: 3,  tier: 1, desc: "随处可见的小鱼，聊胜于无。" },
  crucian:    { name: "鲫鱼",     type: "fish",  value: 5,  tier: 1, desc: "普通的鲫鱼，熬汤还行。" },
  perch:      { name: "鲈鱼",     type: "fish",  value: 8,  tier: 2, desc: "肉质鲜美的鲈鱼。" },
  carp:       { name: "鲤鱼",     type: "fish",  value: 10, tier: 2, desc: "红尾鲤鱼，寓意吉祥。" },
  catfish:    { name: "鲶鱼",     type: "fish",  value: 12, tier: 2, desc: "滑溜溜的鲶鱼，个头不小。" },
  trout:      { name: "鳟鱼",     type: "fish",  value: 15, tier: 3, desc: "冷水鳟鱼，品质上乘。" },
  salmon:     { name: "三文鱼",   type: "fish",  value: 20, tier: 3, desc: "肥美的三文鱼，刺身极品。" },
  eel:        { name: "鳗鱼",     type: "fish",  value: 25, tier: 3, desc: "滑嫩的鳗鱼，蒲烧一绝。" },
  golden_carp:{ name: "金鳞鲤",   type: "fish",  value: 40, tier: 4, desc: "鳞片闪着金光的鲤鱼，罕见。" },
  moon_salmon:{ name: "月光鲑",   type: "fish",  value: 50, tier: 4, desc: "月光下才会出现的银色鲑鱼。" },
  dragon_koi: { name: "龙鲤",     type: "fish",  value: 80, tier: 5, desc: "传说中跃过龙门的鲤鱼，鳞片如龙。" },
  abyss_ray:  { name: "深渊鳐",   type: "fish",  value: 100,tier: 5, desc: "来自深海的幽光鳐鱼，神秘莫测。" },

  // ===== 探险战利品 =====
  herb:       { name: "药草",         type: "material", value: 5,  tier: 1, desc: "普通的药草，聊胜于无。" },
  ore:        { name: "铁矿石",       type: "material", value: 8,  tier: 1, desc: "一块铁矿石，能卖几个钱。" },
  feather:    { name: "奇异羽毛",     type: "material", value: 12, tier: 2, desc: "散发着微光的羽毛。" },
  crystal_shard:{ name: "水晶碎片",   type: "material", value: 15, tier: 2, desc: "破碎的水晶，仍蕴含着微弱的力量。" },
  ancient_coin:{ name: "古币",        type: "treasure", value: 20, tier: 2, desc: "一枚刻着未知文字的古币。" },
  gem:        { name: "宝石",         type: "treasure", value: 35, tier: 3, desc: "一颗切割精美的宝石，价值不菲。" },
  golden_idol:{ name: "黄金雕像",     type: "treasure", value: 50, tier: 3, desc: "一尊小巧的黄金雕像。" },
  magic_scroll:{name: "魔法卷轴",     type: "treasure", value: 60, tier: 4, desc: "记载着古老魔法的卷轴。" },
  dragon_scale:{name: "龙鳞",         type: "treasure", value: 80, tier: 4, desc: "一片散发着温热的龙鳞。" },
  star_fragment:{name: "星之碎片",    type: "treasure", value: 100,tier: 5, desc: "从天而降的星辰碎片，蕴含着无尽的力量。" },

  // ===== 消耗品 =====
  bandage:    { name: "绷带",       type: "consumable", value: 0, tier: 1, desc: "探险用的绷带，使用后恢复状态。", effect: { type: "heal" } },
  lucky_coin: { name: "幸运币",     type: "consumable", value: 0, tier: 2, desc: "抛向空中能带来好运的硬币。使用后当日运气 +1。", effect: { type: "luck", value: 1, duration: 86400 } },
  energy_drink:{name: "能量饮料",   type: "consumable", value: 0, tier: 1, desc: "喝下后精神焕发。使用后重置钓鱼/探险的每日次数 1 次。", effect: { type: "refresh", target: "daily" } },
};

// ===== 来源水域配置 =====
const FISH_WATERS = {
  pond: {
    nameKey: "WATER_POND",
    cost: 3,
    fish: [
      { id: "minnow",      weight: 40 },
      { id: "crucian",     weight: 30 },
      { id: "perch",       weight: 15 },
      { id: "carp",        weight: 10 },
      { id: "catfish",     weight: 5 },
    ],
  },
  lake: {
    nameKey: "WATER_LAKE",
    cost: 5,
    fish: [
      { id: "crucian",     weight: 25 },
      { id: "perch",       weight: 20 },
      { id: "carp",        weight: 20 },
      { id: "catfish",     weight: 15 },
      { id: "trout",       weight: 10 },
      { id: "golden_carp", weight: 8 },
      { id: "moon_salmon", weight: 2 },
    ],
  },
  river: {
    nameKey: "WATER_RIVER",
    cost: 8,
    fish: [
      { id: "catfish",     weight: 20 },
      { id: "trout",       weight: 20 },
      { id: "salmon",      weight: 20 },
      { id: "eel",         weight: 15 },
      { id: "golden_carp", weight: 10 },
      { id: "moon_salmon", weight: 10 },
      { id: "dragon_koi",  weight: 5 },
    ],
  },
  coast: {
    nameKey: "WATER_COAST",
    cost: 12,
    fish: [
      { id: "salmon",      weight: 30 },
      { id: "eel",         weight: 25 },
      { id: "moon_salmon", weight: 20 },
      { id: "dragon_koi",  weight: 15 },
      { id: "abyss_ray",   weight: 10 },
    ],
  },
  deepsea: {
    nameKey: "WATER_DEEPSEA",
    cost: 20,
    fish: [
      { id: "moon_salmon", weight: 30 },
      { id: "dragon_koi",  weight: 30 },
      { id: "abyss_ray",   weight: 30 },
      { id: "golden_carp", weight: 10 },
    ],
  },
  mystery: {
    nameKey: "WATER_MYSTERY",
    cost: 50,
    fish: [
      { id: "abyss_ray",   weight: 35 },
      { id: "dragon_koi",  weight: 30 },
      { id: "moon_salmon", weight: 20 },
      { id: "golden_carp", weight: 15 },
    ],
  },
};

// ===== 探险区域配置 =====
const EXP_ZONES = {
  forest: {
    nameKey: "ZONE_FOREST",
    cost: 10,
    minRounds: 2,
    maxRounds: 4,
    events: [
      { type: "fight",  weight: 30, monsters: ["史莱姆", "野狼", "蝙蝠群"] },
      { type: "treasure", weight: 20, items: ["herb", "ore", "feather"] },
      { type: "trap",   weight: 15, damage: [3, 8] },
      { type: "rest",   weight: 15 },
      { type: "discovery", weight: 20, items: ["herb", "ore", "ancient_coin"] },
    ],
  },
  cave: {
    nameKey: "ZONE_CAVE",
    cost: 20,
    minRounds: 3,
    maxRounds: 5,
    events: [
      { type: "fight",  weight: 30, monsters: ["蝙蝠群", "巨型蜘蛛", "哥布林"] },
      { type: "treasure", weight: 20, items: ["ore", "crystal_shard", "ancient_coin"] },
      { type: "trap",   weight: 20, damage: [5, 15] },
      { type: "rest",   weight: 10 },
      { type: "discovery", weight: 20, items: ["crystal_shard", "ancient_coin", "gem"] },
    ],
  },
  ruins: {
    nameKey: "ZONE_RUINS",
    cost: 35,
    minRounds: 3,
    maxRounds: 6,
    events: [
      { type: "fight",  weight: 25, monsters: ["骷髅兵", "幽灵", "哥布林"] },
      { type: "treasure", weight: 25, items: ["ancient_coin", "gem", "golden_idol"] },
      { type: "trap",   weight: 15, damage: [8, 20] },
      { type: "rest",   weight: 10 },
      { type: "discovery", weight: 25, items: ["gem", "golden_idol", "magic_scroll"] },
    ],
  },
  volcano: {
    nameKey: "ZONE_VOLCANO",
    cost: 50,
    minRounds: 4,
    maxRounds: 7,
    events: [
      { type: "fight",  weight: 30, monsters: ["巨型蜘蛛", "骷髅兵", "幽灵"] },
      { type: "treasure", weight: 20, items: ["gem", "golden_idol", "dragon_scale"] },
      { type: "trap",   weight: 20, damage: [10, 30] },
      { type: "rest",   weight: 5 },
      { type: "discovery", weight: 25, items: ["golden_idol", "dragon_scale", "star_fragment"] },
    ],
  },
  abyss: {
    nameKey: "ZONE_ABYSS",
    cost: 80,
    minRounds: 5,
    maxRounds: 8,
    events: [
      { type: "fight",  weight: 25, monsters: ["幽灵", "巨型蜘蛛", "骷髅兵"] },
      { type: "treasure", weight: 20, items: ["dragon_scale", "magic_scroll", "star_fragment"] },
      { type: "trap",   weight: 15, damage: [15, 40] },
      { type: "rest",   weight: 5 },
      { type: "discovery", weight: 35, items: ["magic_scroll", "star_fragment", "dragon_scale"] },
    ],
  },
};

// ================================================================
//  ╔══════════════════════════════════════════════════════════════╗
//  ║                   三、辅助函数                              ║
//  ╚══════════════════════════════════════════════════════════════╝
// ================================================================

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTodayDay() {
  return Math.floor((Date.now() / 1000 + 28800) / 86400);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(arr) {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let roll = Math.random() * total;
  for (const item of arr) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return arr[arr.length - 1];
}

function t(str) {
  if (typeof str === "string") {
    return str.replace(/\{bot\}/g, BOT_NAME);
  }
  return str;
}

function getMoney(ctx) {
  return seal.vars.intGet(ctx, "$m金钱")[0] || 0;
}

function setMoney(ctx, val) {
  seal.vars.intSet(ctx, "$m金钱", Math.max(0, val));
}

function addMoney(ctx, val) {
  const cur = getMoney(ctx);
  setMoney(ctx, cur + val);
}

function getCrystal(ctx) {
  return seal.vars.intGet(ctx, "$m水晶")[0] || 0;
}

function setCrystal(ctx, val) {
  seal.vars.intSet(ctx, "$m水晶", Math.max(0, val));
}

function addCrystal(ctx, val) {
  const cur = getCrystal(ctx);
  setCrystal(ctx, cur + val);
}

// 获取当前生效的签文 buff（存储在玩家 vars 中）
function getActiveSign(ctx) {
  const raw = seal.vars.strGet(ctx, "$m今日签文")[0];
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

function setActiveSign(ctx, sign) {
  seal.vars.strSet(ctx, "$m今日签文", JSON.stringify(sign));
}

function getTodaysSignDay(ctx) {
  return seal.vars.intGet(ctx, "$m签文日")[0] || 0;
}

function setTodaysSignDay(ctx, day) {
  seal.vars.intSet(ctx, "$m签文日", day);
}

// ================================================================
//  ╔══════════════════════════════════════════════════════════════╗
//  ║                   四、背包系统                              ║
//  ╚══════════════════════════════════════════════════════════════╝
// ================================================================

let BACKPACK_CAPACITY = 50;
let BACKPACK_STACK_LIMIT = 99;

class Backpack {
  constructor(ctx) {
    this.ctx = ctx;
    this.userId = ctx.player.userId;
    const raw = ext.storageGet("bp_" + this.userId);
    const data = raw ? JSON.parse(raw) : {};
    this.items = data.items || {};  // { itemId: count }
    this.maxCap = data.maxCap || BACKPACK_CAPACITY;
  }

  _save() {
    ext.storageSet("bp_" + this.userId, JSON.stringify({
      items: this.items,
      maxCap: this.maxCap,
    }));
  }

  // 当前已使用的格数
  get usedSlots() {
    return Object.keys(this.items).filter(id => this.items[id] > 0).length;
  }

  // 是否还有空位
  get hasSpace() {
    return this.usedSlots < this.maxCap;
  }

  // 是否已满
  get isFull() {
    return this.usedSlots >= this.maxCap;
  }

  // 获取某物品数量
  count(itemId) {
    return this.items[itemId] || 0;
  }

  // 添加物品（自动堆叠）
  add(itemId, count) {
    count = count || 1;
    const itemDef = ITEMS[itemId];
    if (!itemDef) return { ok: false, reason: "未知物品" };

    const current = this.items[itemId] || 0;

    // 需要新增格子
    if (current === 0 && this.isFull) {
      return { ok: false, reason: "背包已满" };
    }

    // 检查堆叠上限
    const canAdd = Math.min(count, BACKPACK_STACK_LIMIT - current);
    if (canAdd <= 0) return { ok: false, reason: "该物品已达堆叠上限" };

    this.items[itemId] = (this.items[itemId] || 0) + canAdd;
    this._save();
    return { ok: true, added: canAdd, remaining: count - canAdd };
  }

  // 移除物品
  remove(itemId, count) {
    count = count || 1;
    const current = this.items[itemId] || 0;
    if (current < count) return { ok: false, reason: "数量不足" };

    this.items[itemId] = current - count;
    if (this.items[itemId] <= 0) delete this.items[itemId];
    this._save();
    return { ok: true, removed: count };
  }

  // 查看背包
  view() {
    const entries = Object.entries(this.items).filter(([id, c]) => c > 0);
    if (entries.length === 0) return LANG.PACK_EMPTY;

    let res = LANG.PACK_VIEW.replace("{used}", String(this.usedSlots)).replace("{max}", String(this.maxCap));
    res += "\n" + "─".repeat(20);

    // 按类型分组
    const groups = { fish: [], material: [], treasure: [], consumable: [], other: [] };
    const typeLabels = { fish: "🐟 鱼类", material: "🧱 材料", treasure: "💎 宝藏", consumable: "🧪 消耗品", other: "📦 其他" };

    for (const [id, count] of entries) {
      const def = ITEMS[id];
      const type = def ? def.type : "other";
      if (!groups[type]) groups[type] = [];
      groups[type].push({ id, def, count });
    }

    for (const [type, list] of Object.entries(groups)) {
      if (list.length === 0) continue;
      res += "\n\n" + (typeLabels[type] || type) + "：";
      for (const item of list) {
        const tierStars = "★".repeat(item.def?.tier || 1);
        res += "\n  " + item.def?.name + " " + tierStars + " x" + item.count;
        if (item.def?.desc) res += "  " + item.def.desc;
      }
    }

    res += "\n\n💡 使用「出售 <物品> [数量]」卖东西换钱";
    res += "\n💡 使用「使用 <物品>」使用消耗品";
    return res;
  }

  // 出售物品
  sell(itemId, count) {
    const def = ITEMS[itemId];
    if (!def) return LANG.NO_ITEM;
    count = count || this.items[itemId] || 1;

    const result = this.remove(itemId, count);
    if (!result.ok) return result.reason;

    const totalMoney = (def.value || 0) * result.removed;
    addMoney(this.ctx, totalMoney);

    return LANG.PACK_SELL_OK
      .replace("{item}", def.name)
      .replace("{count}", String(result.removed))
      .replace("{money}", String(totalMoney));
  }

  // 使用消耗品
  use(itemId) {
    const def = ITEMS[itemId];
    if (!def) return LANG.NO_ITEM;
    if (def.type !== "consumable") return "「" + def.name + "」不是消耗品，无法使用。";

    if (this.count(itemId) < 1) return "你没有「" + def.name + "」。";

    const eff = def.effect;
    if (!eff) return "这个物品没有效果。";

    this.remove(itemId, 1);

    let result = LANG.PACK_USE_OK.replace("{item}", def.name);

    switch (eff.type) {
      case "heal":
        // 探险回血由探险系统处理，这里只是消耗物品
        result += " 感觉好多了。";
        break;
      case "luck":
        seal.vars.intSet(this.ctx, "$m道具好运", eff.value);
        seal.vars.intSet(this.ctx, "$m道具好运_upTime", Date.now() / 1000 + eff.duration);
        result += " 今日运气提升了！";
        break;
      case "refresh":
        // 重置每日标记
        seal.vars.intSet(this.ctx, "$m钓鱼日", 0);
        seal.vars.intSet(this.ctx, "$m探险日", 0);
        seal.vars.intSet(this.ctx, "$m钓鱼次数", 0);
        seal.vars.intSet(this.ctx, "$m探险次数", 0);
        result += " 精力恢复！今日的钓鱼和探险次数已重置。";
        break;
      default:
        result += " 没什么特别的效果。";
    }

    return result;
  }

  // 全部出售某类物品
  sellAllByType(type) {
    const entries = Object.entries(this.items).filter(([id, c]) => {
      const def = ITEMS[id];
      return def && def.type === type && c > 0;
    });

    if (entries.length === 0) {
      if (type === "fish") return LANG.FISH_NO_FISH;
      return "背包里没有可出售的这类物品。";
    }

    let totalMoney = 0;
    let totalCount = 0;

    for (const [id, count] of entries) {
      const def = ITEMS[id];
      totalMoney += (def.value || 0) * count;
      totalCount += count;
      delete this.items[id];
    }

    addMoney(this.ctx, totalMoney);
    this._save();

    return "出售了 " + totalCount + " 件物品，获得 " + totalMoney + " 金钱。";
  }
}

// ================================================================
//  ╔══════════════════════════════════════════════════════════════╗
//  ║                   五、钓鱼系统                              ║
//  ╚══════════════════════════════════════════════════════════════╝
// ================================================================

let FISH_DAILY_LIMIT = 10;

class Fishing {
  constructor(ctx) {
    this.ctx = ctx;
    this.userId = ctx.player.userId;
    this.today = getTodayDay();
    this.lastFishDay = seal.vars.intGet(ctx, "$m钓鱼日")[0] || 0;
    this.todayCount = seal.vars.intGet(ctx, "$m钓鱼次数")[0] || 0;
    if (this.lastFishDay !== this.today) {
      this.todayCount = 0;
      seal.vars.intSet(ctx, "$m钓鱼日", this.today);
    }
  }

  _saveCount() {
    seal.vars.intSet(this.ctx, "$m钓鱼次数", this.todayCount);
  }

  // 检查签文 buff
  _hasFishBuff() {
    const sign = getActiveSign(this.ctx);
    return sign && (sign.name === "吉" || sign.name === "大吉");
  }

  fish(waterId) {
    const water = FISH_WATERS[waterId];
    if (!water) return "未知的水域。可用水域：pond(池塘), lake(湖泊), river(河流), coast(海岸), deepsea(深海), mystery(神秘)";

    if (this.todayCount >= FISH_DAILY_LIMIT) {
      return LANG.NO_ENERGY;
    }

    const cost = water.cost;
    if (getMoney(this.ctx) < cost) return LANG.NO_MONEY;
    addMoney(this.ctx, -cost);

    this.todayCount++;
    this._saveCount();

    const placeName = LANG[water.nameKey] || water.nameKey;
    let result = LANG.FISH_START.replace("{place}", placeName);

    // 运气修正
    const jrrp = seal.vars.intGet(this.ctx, "$t人品")[0] || 50;
    const luckMod = seal.vars.intGet(this.ctx, "$m道具好运")[0] || 0;
    const luckUpTime = seal.vars.intGet(this.ctx, "$m道具好运_upTime")[0] || 0;
    const hasLuck = luckUpTime >= Date.now() / 1000 && luckMod > 0;

    let fishRoll = getRandomInt(1, 100);
    if (hasLuck) fishRoll += luckMod * 5;
    if (this._hasFishBuff()) fishRoll += 10;
    if (jrrp >= 80) fishRoll += 5;
    else if (jrrp <= 20) fishRoll -= 5;

    // 空竿判定
    if (fishRoll <= 20) {
      result += "\n" + LANG.FISH_NOTHING;
      return result;
    }

    // 选择鱼
    const picked = weightedPick(water.fish);
    const fishDef = ITEMS[picked.id];
    if (!fishDef) {
      result += "\n" + LANG.FISH_NOTHING;
      return result;
    }

    // 入库
    const bp = new Backpack(this.ctx);
    bp.add(picked.id, 1);

    // 根据稀有度选择台词
    const tier = fishDef.tier || 1;
    let catchMsg = "";
    if (tier >= 5) catchMsg = LANG.FISH_LEGEND;
    else if (tier >= 4) catchMsg = LANG.FISH_RARE;
    else if (tier >= 3) catchMsg = LANG.FISH_BIG;
    else catchMsg = LANG.FISH_CAUGHT;

    result += "\n" + catchMsg.replace("{fish}", fishDef.name);
    result += "\n（价值 " + fishDef.value + " 金钱，已放入背包）";

    return result;
  }
}

// ================================================================
//  ╔══════════════════════════════════════════════════════════════╗
//  ║                   六、抽签系统                              ║
//  ╚══════════════════════════════════════════════════════════════╝
// ================================================================

class Divination {
  constructor(ctx) {
    this.ctx = ctx;
    this.userId = ctx.player.userId;
    this.today = getTodayDay();
  }

  // 抽签（每日一次）
  draw() {
    const lastDay = getTodaysSignDay(this.ctx);
    const activeSign = getActiveSign(this.ctx);

    // 今天已抽过
    if (lastDay === this.today && activeSign) {
      return LANG.DIVINE_ALREADY.replace("{sign}", activeSign.icon + " " + activeSign.name)
        + "\n" + LANG.DIVINE_ADVICE.replace("{advice}", LANG.ADVICE[activeSign.name] || "")
        + "\n" + LANG.DIVINE_BUFF.replace("{buff}", activeSign.desc);
    }

    // 基于人品值决定签运
    const jrrp = seal.vars.intGet(this.ctx, "$t人品")[0] || 50;
    const roll = getRandomInt(1, 100) + Math.floor((jrrp - 50) / 10);

    let signIndex = 0;
    if (roll >= 95) signIndex = 0;       // 大吉
    else if (roll >= 85) signIndex = 1;  // 吉
    else if (roll >= 72) signIndex = 2;  // 中吉
    else if (roll >= 60) signIndex = 3;  // 小吉
    else if (roll >= 50) signIndex = 4;  // 末吉
    else if (roll >= 42) signIndex = 5;  // 末小吉
    else if (roll >= 35) signIndex = 6;  // 半吉
    else if (roll >= 28) signIndex = 7;  // 先凶后吉
    else if (roll >= 20) signIndex = 8;  // 凶
    else if (roll >= 12) signIndex = 9;  // 小凶
    else if (roll >= 5)  signIndex = 10; // 大凶
    else signIndex = 11;                  // 无印

    const sign = LANG.SIGNS[signIndex];
    setActiveSign(this.ctx, sign);
    setTodaysSignDay(this.ctx, this.today);

    let result = LANG.DIVINE_TITLE;
    result += "\n" + LANG.DIVINE_SIGN.replace("{sign}", sign.icon + " " + sign.name);
    result += "\n" + sign.desc;
    result += "\n" + LANG.DIVINE_ADVICE.replace("{advice}", LANG.ADVICE[sign.name] || "");
    result += "\n" + LANG.DIVINE_BUFF.replace("{buff}", sign.buff);

    return result;
  }

  // 改签（消耗水晶重新抽）
  rerun() {
    const cost = 20;
    if (getCrystal(this.ctx) < cost) {
      return LANG.DIVINE_NO_CRYSTAL;
    }
    addCrystal(this.ctx, -cost);

    // 清除今日标记，重新抽
    setTodaysSignDay(this.ctx, 0);
    setActiveSign(this.ctx, null);

    const result = this.draw();
    return LANG.DIVINE_RERUN.replace("{sign}", result.split("\n")[1] || "");
  }
}

// ================================================================
//  ╔══════════════════════════════════════════════════════════════╗
//  ║                   七、探险系统                              ║
//  ╚══════════════════════════════════════════════════════════════╝
// ================================================================

let EXP_DAILY_LIMIT = 5;

class Exploration {
  constructor(ctx) {
    this.ctx = ctx;
    this.userId = ctx.player.userId;
    this.today = getTodayDay();
    this.lastExpDay = seal.vars.intGet(ctx, "$m探险日")[0] || 0;
    this.todayCount = seal.vars.intGet(ctx, "$m探险次数")[0] || 0;
    if (this.lastExpDay !== this.today) {
      this.todayCount = 0;
      seal.vars.intSet(ctx, "$m探险日", this.today);
    }
  }

  _saveCount() {
    seal.vars.intSet(this.ctx, "$m探险次数", this.todayCount);
  }

  // 检查签文
  _getSignBonus() {
    const sign = getActiveSign(this.ctx);
    if (!sign) return {};
    if (sign.name === "中吉" || sign.name === "大吉") return { itemRate: 1.3 };
    if (sign.name === "先凶后吉") return { firstEventGood: true };
    if (sign.name === "无印") return { chaos: true };
    return {};
  }

  explore(zoneId) {
    const zone = EXP_ZONES[zoneId];
    if (!zone) return "未知区域。可用区域：forest(森林), cave(洞穴), ruins(遗迹), volcano(火山), abyss(深渊)";

    if (this.todayCount >= EXP_DAILY_LIMIT) {
      return LANG.NO_ENERGY;
    }

    const cost = zone.cost;
    if (getMoney(this.ctx) < cost) return LANG.NO_MONEY;
    addMoney(this.ctx, -cost);

    this.todayCount++;
    this._saveCount();

    const placeName = LANG[zone.nameKey] || zone.nameKey;
    const signBonus = this._getSignBonus();
    let result = LANG.EXP_START.replace("{place}", placeName);

    const rounds = getRandomInt(zone.minRounds, zone.maxRounds);
    let totalGain = 0;
    let itemsFound = [];

    for (let i = 0; i < rounds; i++) {
      result += LANG.EXP_ENTER.replace("{place}", placeName);

      let eventPool = [...zone.events];

      // 先凶后吉：首轮必定为正面事件
      if (i === 0 && signBonus.firstEventGood) {
        // 只保留正面事件
        eventPool = zone.events.filter(e => e.type !== "trap");
        if (eventPool.length === 0) eventPool = zone.events;
      }

      // 无印签：事件池打乱权重
      if (signBonus.chaos) {
        for (const evt of eventPool) {
          evt.weight = getRandomInt(1, 50);
        }
      }

      const picked = weightedPick(eventPool);

      switch (picked.type) {
        case "fight": {
          const monster = pickRandom(picked.monsters);
          const fightRoll = getRandomInt(1, 100);
          const jrrp = seal.vars.intGet(this.ctx, "$t人品")[0] || 50;
          if (fightRoll + Math.floor((jrrp - 50) / 5) > 50) {
            // 胜利
            const rewardMoney = getRandomInt(5, 15);
            addMoney(this.ctx, rewardMoney);
            totalGain += rewardMoney;
            result += "\n" + LANG.EXP_FIGHT.replace("{monster}", monster) + " 获得 " + rewardMoney + " 金钱。";
          } else {
            const loseMoney = getRandomInt(3, 10);
            addMoney(this.ctx, -loseMoney);
            result += "\n" + LANG.EXP_FIGHT_LOSE.replace("{monster}", monster) + " 损失 " + loseMoney + " 金钱。";
          }
          break;
        }

        case "treasure": {
          const itemId = pickRandom(picked.items);
          const def = ITEMS[itemId];
          if (def) {
            const bp = new Backpack(this.ctx);
            const addResult = bp.add(itemId, 1);
            if (addResult.ok) {
              itemsFound.push(def.name);
              result += "\n" + LANG.EXP_TREASURE.replace("{item}", def.name);
            }
          }
          break;
        }

        case "trap": {
          const damage = getRandomInt(picked.damage[0], picked.damage[1]);
          addMoney(this.ctx, -damage);
          result += "\n" + LANG.EXP_TRAP.replace("{value}", String(damage));
          break;
        }

        case "rest": {
          result += "\n" + LANG.EXP_REST;
          break;
        }

        case "discovery": {
          const itemId = pickRandom(picked.items);
          const def = ITEMS[itemId];
          if (def) {
            const bp = new Backpack(this.ctx);
            const addResult = bp.add(itemId, 1);
            if (addResult.ok) {
              itemsFound.push(def.name);
              result += "\n" + LANG.EXP_DISCOVERY.replace("{item}", def.name);
            }
          }
          break;
        }
      }
    }

    // 汇总
    if (totalGain > 0 || itemsFound.length > 0) {
      let summary = "";
      if (totalGain > 0) summary += "金钱 +" + totalGain;
      if (itemsFound.length > 0) summary += (summary ? "，物品：" : "物品：") + itemsFound.join("、");
      result += "\n" + LANG.EXP_END.replace("{result}", summary);
    } else {
      result += LANG.EXP_END_EMPTY;
    }

    return result;
  }
}

// ================================================================
//  ╔══════════════════════════════════════════════════════════════╗
//  ║             八、扩展注册与命令处理                          ║
//  ╚══════════════════════════════════════════════════════════════╝
// ================================================================

let ext = seal.ext.find("ComboPack");
if (!ext) {
  ext = seal.ext.new("ComboPack", "kakakumous", "1.0.0");
  seal.ext.register(ext);
}

// ============================================================
//  插件 UI 配置（在骰子设置界面中可调）
// ============================================================

seal.ext.registerStringConfig(ext, "命令前缀", "◆日常◆", "所有综合功能命令必须以此前缀开头，防止日常对话误触发");
seal.ext.registerIntConfig(ext, "背包容量", BACKPACK_CAPACITY, "背包最多容纳的物品种类数");
seal.ext.registerIntConfig(ext, "物品堆叠上限", BACKPACK_STACK_LIMIT, "同种物品最多堆叠的数量");
seal.ext.registerIntConfig(ext, "钓鱼每日上限", FISH_DAILY_LIMIT, "每日钓鱼的最大次数");
seal.ext.registerIntConfig(ext, "探险每日上限", EXP_DAILY_LIMIT, "每日探险的最大次数");

function loadComboConfig() {
  BACKPACK_CAPACITY = seal.ext.getIntConfig(ext, "背包容量");
  BACKPACK_STACK_LIMIT = seal.ext.getIntConfig(ext, "物品堆叠上限");
  FISH_DAILY_LIMIT = seal.ext.getIntConfig(ext, "钓鱼每日上限");
  EXP_DAILY_LIMIT = seal.ext.getIntConfig(ext, "探险每日上限");
}

loadComboConfig();

function comboCmdPrefix() { return seal.ext.getStringConfig(ext, "命令前缀") || "◆日常◆"; }

ext.onNotCommandReceived = (ctx, msg) => {
  const raw = msg.message.trim();
  const prefix = comboCmdPrefix();
  // 非前缀命令 → 放行给其他扩展
  if (!raw.startsWith(prefix)) return seal.ext.newCmdExecuteResult(false);
  const cmd = raw.slice(prefix.length).trim();
  const parts = cmd.split(/\s+/);
  const mainCmd = parts[0];
  loadComboConfig(); // 刷新最新配置

  // =============================================================
  //  背包
  // =============================================================

  if (cmd === "查看背包" || cmd === "背包") {
    const bp = new Backpack(ctx);
    seal.replyToSender(ctx, msg, bp.view());
    return seal.ext.newCmdExecuteResult(true);
  }

  if (cmd.startsWith("出售 ") || cmd.startsWith("卖 ")) {
    const prefix = cmd.startsWith("出售 ") ? "出售 " : "卖 ";
    let rest = cmd.slice(prefix.length).trim();
    if (!rest) {
      seal.replyToSender(ctx, msg, "用法：出售 <物品名> [数量]  或  卖鱼");
      return seal.ext.newCmdExecuteResult(true);
    }

    // 特殊：卖鱼 = 卖掉所有鱼
    if (rest === "鱼" || rest === "所有鱼" || rest === "全部鱼") {
      const bp = new Backpack(ctx);
      seal.replyToSender(ctx, msg, bp.sellAllByType("fish"));
      return seal.ext.newCmdExecuteResult(true);
    }

    // 解析物品名和数量：支持"出售 鲈鱼 3"格式
    const restParts = rest.split(/\s+/);
    let sellCount = 1;
    let sellName = rest;
    if (restParts.length >= 2 && !isNaN(restParts[restParts.length - 1])) {
      sellCount = parseInt(restParts[restParts.length - 1]);
      sellName = restParts.slice(0, -1).join(" ");
    }

    const bp = new Backpack(ctx);
    const itemMatch = Object.entries(ITEMS).find(([k, v]) =>
      v.name === sellName || v.name.includes(sellName) || k === sellName
    );
    if (!itemMatch) {
      seal.replyToSender(ctx, msg, "未找到可出售的物品：「" + sellName + "」");
      return seal.ext.newCmdExecuteResult(true);
    }

    seal.replyToSender(ctx, msg, bp.sell(itemMatch[0], sellCount));
    return seal.ext.newCmdExecuteResult(true);
  }

  if (cmd.startsWith("使用 ")) {
    // 如果用户在远征中，跳过交给远征系统处理
    const expRoom = seal.vars.strGet(ctx, "$m远征房间")[0];
    if (expRoom) {
      return seal.ext.newCmdExecuteResult(false);
    }

    const itemName = cmd.slice(3).trim();
    if (!itemName) {
      seal.replyToSender(ctx, msg, "用法：使用 <物品名>");
      return seal.ext.newCmdExecuteResult(true);
    }
    const bp = new Backpack(ctx);
    const itemMatch = Object.entries(ITEMS).find(([k, v]) =>
      v.name === itemName || v.name.includes(itemName) || k === itemName
    );
    if (!itemMatch) {
      seal.replyToSender(ctx, msg, "未找到物品：「" + itemName + "」");
      return seal.ext.newCmdExecuteResult(true);
    }
    seal.replyToSender(ctx, msg, bp.use(itemMatch[0]));
    return seal.ext.newCmdExecuteResult(true);
  }

  // =============================================================
  //  钓鱼
  // =============================================================

  if (cmd === "钓鱼" || parts[0] === "钓鱼") {
    let waterId = "pond";
    if (parts.length > 1) {
      const waterMap = {
        "池塘": "pond", "pond": "pond",
        "湖泊": "lake", "lake": "lake",
        "河流": "river", "river": "river",
        "海岸": "coast", "coast": "coast",
        "深海": "deepsea", "deepsea": "deepsea",
        "神秘": "mystery", "mystery": "mystery",
      };
      waterId = waterMap[parts[1]] || "pond";
    }
    const f = new Fishing(ctx);
    seal.replyToSender(ctx, msg, f.fish(waterId));
    return seal.ext.newCmdExecuteResult(true);
  }

  // 钓鱼帮助
  if (cmd === "钓鱼帮助") {
    seal.replyToSender(ctx, msg, "\
🎣 钓鱼系统\n\n\
钓鱼 <水域>  去指定水域钓鱼（消耗金钱）\n\n\
水域：\n\
  池塘 pond     - 消耗 3 金钱，新手区\n\
  湖泊 lake     - 消耗 5 金钱\n\
  河流 river    - 消耗 8 金钱\n\
  海岸 coast    - 消耗 12 金钱\n\
  深海 deepsea  - 消耗 20 金钱\n\
  神秘 mystery  - 消耗 50 金钱\n\n\
每日上限：" + FISH_DAILY_LIMIT + " 次\n\
钓到的鱼自动放入背包，可用「卖鱼」一次性出售\n\
受人品值和签运影响");
    return seal.ext.newCmdExecuteResult(true);
  }

  // =============================================================
  //  抽签
  // =============================================================

  if (cmd === "抽签" || cmd === "今日运势" || cmd === "运势") {
    const d = new Divination(ctx);
    seal.replyToSender(ctx, msg, d.draw());
    return seal.ext.newCmdExecuteResult(true);
  }

  if (cmd === "改签") {
    const d = new Divination(ctx);
    seal.replyToSender(ctx, msg, d.rerun());
    return seal.ext.newCmdExecuteResult(true);
  }

  // =============================================================
  //  探险
  // =============================================================

  if (cmd === "探险" || parts[0] === "探险") {
    let zoneId = "forest";
    if (parts.length > 1) {
      const zoneMap = {
        "森林": "forest", "forest": "forest",
        "洞穴": "cave", "cave": "cave",
        "遗迹": "ruins", "ruins": "ruins",
        "火山": "volcano", "volcano": "volcano",
        "深渊": "abyss", "abyss": "abyss",
      };
      zoneId = zoneMap[parts[1]] || "forest";
    }
    const e = new Exploration(ctx);
    seal.replyToSender(ctx, msg, e.explore(zoneId));
    return seal.ext.newCmdExecuteResult(true);
  }

  // 探险帮助
  if (cmd === "探险帮助") {
    seal.replyToSender(ctx, msg, "\
🗺 探险系统\n\n\
探险 <区域>  前往指定区域探险（消耗金钱）\n\n\
区域：\n\
  森林 forest  - 消耗 10 金钱，入门\n\
  洞穴 cave    - 消耗 20 金钱\n\
  遗迹 ruins   - 消耗 35 金钱\n\
  火山 volcano - 消耗 50 金钱\n\
  深渊 abyss   - 消耗 80 金钱\n\n\
每日上限：" + EXP_DAILY_LIMIT + " 次\n\
探险中可能遇到战斗、宝箱、陷阱、发现等事件\n\
获得的物品自动放入背包\n\
受人品值和签运影响");
    return seal.ext.newCmdExecuteResult(true);
  }

  // =============================================================
  //  帮助
  // =============================================================

  if (cmd === "综合帮助" || cmd === "功能帮助") {
    seal.replyToSender(ctx, msg, "\
📦 " + LANG.SYS_NAME + " 使用指南\n\n\
背包：\n\
  背包 / 查看背包    查看背包内容\n\
  出售 <物品> [数量]  卖出物品换钱\n\
  卖鱼               一次性卖掉所有鱼\n\
  使用 <物品>        使用消耗品\n\n\
🎣 钓鱼：\n\
  钓鱼 [水域]        去钓鱼\n\
  钓鱼帮助           查看钓鱼详情\n\n\
🔮 抽签：\n\
  抽签 / 今日运势    抽取今日运势\n\
  改签               消耗 20 水晶重抽\n\n\
🗺 探险：\n\
  探险 [区域]        开始探险\n\
  探险帮助           查看探险详情\n\n\
💡 所有产出自动放入背包，记得定期清理。\n\
💡 语言模组位于代码顶部「一、语言模组」，可自定义风格。");
    return seal.ext.newCmdExecuteResult(true);
  }
};
