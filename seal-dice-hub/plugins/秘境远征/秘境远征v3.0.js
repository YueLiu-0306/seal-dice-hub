// ==UserScript==
// @name 秘境远征 v2.1：多人合作 + 肉鸽 + BOSS 战
// @author L.Y.
// @version 2.2.1
// @description 职业技能 + 肉鸽事件层 + 多 BOSS 关卡 + 技能书扩展 + 前缀防误触 + 特长系统 + 肉鸽战斗 + 事件连锁 + 信物收集 + 隐藏结局 + 事件标记
// @license CC-BY-NC-SA 4.0
// ==/UserScript==

// ================================================================
//  一、配置
// ================================================================

const EXPEDITION = {
  // 图片后端开关：true时状态和回合结果生成图片，false时纯文本
  IMAGE_ENABLED: true,
  // 图片后端地址（与Python Flask脚本的地址一致）
  IMAGE_BACKEND: "http://127.0.0.1:8015",
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  BOARD_SIZE: 16,
  PREP_ROUNDS: 5,              // 5轮：肉鸽探索与精英战斗交替
  ELITE_FIGHT_ROUNDS: [2, 4],  // 第2、4轮触发精英小战斗（其余为探索轮）
  BOSS_ACT_INTERVAL: 3,
  ACTION_COOLDOWN: 3000,
  ROOM_TIMEOUT: 900000,      // 15 分钟
  BOSS_TURN_TIMEOUT: 120000,
  ROGUE_EVENT_CHANCE: 0.45,  // 掷骰子后 45% 触发肉鸽事件
  AUTO_ADVANCE_COOLDOWN: 8000,
  MAX_BOSSES: 3,              // 最多打 3 关 BOSS
  CMD_PREFIX: "◆远征◆",     // 所有远征命令必须以此前缀开头，防止误触
  MAX_TALENTS: 3,            // 最多持有特长数
};

// ================================================================
//  一-B、特长定义
// ================================================================

const TALENTS = {
  // ── 先天特长（选职时三选一）──
  bornFierce: {
    id: "bornFierce", name: "天生蛮力", icon: "💪", category: "born",
    desc: "基础攻击力 +3",
    onApply: function(p) { p.attack += 3; p.attack = Math.max(1, p.attack); },
  },
  bornIronSkin: {
    id: "bornIronSkin", name: "铁皮", icon: "🪨", category: "born",
    desc: "基础防御力 +2，最大HP +5",
    onApply: function(p) { p.defense += 2; p.maxHp += 5; p.hp += 5; },
  },
  bornLucky: {
    id: "bornLucky", name: "幸运星", icon: "🍀", category: "born",
    desc: "运气检定阈值 -1，事件掉落概率提升",
    onApply: function(p) { p._luckyBonus = 1; },
  },
  bornSwift: {
    id: "bornSwift", name: "迅捷", icon: "💨", category: "born",
    desc: "10% 概率闪避BOSS/精英怪攻击",
    onApply: function(p) { p._dodgeChance = 0.1; },
  },
  // ── 后天特长（事件解锁）──
  treasureHunter: {
    id: "treasureHunter", name: "寻宝本能", icon: "🗺", category: "acquired",
    desc: "棋盘格子额外获得 50% 金钱",
    onApply: function(p) { p._moneyBonus = 0.5; },
  },
  battleInstinct: {
    id: "battleInstinct", name: "战斗直觉", icon: "⚡️", category: "acquired",
    desc: "攻击BOSS/精英怪时 15% 概率伤害 +50%",
    onApply: function(p) { p._critBonus = 0.15; },
  },
  survival: {
    id: "survival", name: "求生本能", icon: "❤️‍🔥", category: "acquired",
    desc: "HP 低于 30% 时防御力 +5",
    onApply: function(p) { p._survivalActive = true; },
  },
  warBlood: {
    id: "warBlood", name: "战血", icon: "🩸", category: "acquired",
    desc: "每次击杀精英怪攻击力 +1（可叠加）",
    onApply: function(p) { p._warBlood = 0; },
  },
  manaAffinity: {
    id: "manaAffinity", name: "魔力亲和", icon: "🔮", category: "acquired",
    desc: "所有技能 CD -1（最低 1）",
    onApply: function(p) { p._cdReduction = 1; },
  },
  intimidation: {
    id: "intimidation", name: "威压", icon: "😤", category: "acquired",
    desc: "对精英怪额外造成 20% 伤害",
    onApply: function(p) { p._eliteBonus = 0.2; },
  },
};

// 先天特长池（选职时三选一，随机抽取3个）
const BORN_TALENT_POOL = ["bornFierce", "bornIronSkin", "bornLucky", "bornSwift"];

// ================================================================
//  一-C、精英怪 / 遭遇怪定义（肉鸽战斗用）
// ================================================================

const ELITE_MONSTERS = [
  {
    id: "rogueKnight", name: "流寇骑士", icon: "🏴‍☠️",
    desc: "盘踞在秘境小道的亡命之徒，刀法凌厉。", type: "solo",
    baseHp: 65, baseAtk: 10, reward: { money: 25, attack: 2 },
    relicDrop: { id: "tarnishedBadge", name: "锈蚀的骑士徽章", icon: "🎖", desc: "从流寇骑士身上剥落的徽章，隐约散发着战意。" },
  },
  {
    id: "wildBeast", name: "荒野凶兽", icon: "🐺",
    desc: "被秘境能量侵蚀的巨狼，獠牙滴着暗色涎水。", type: "solo",
    baseHp: 55, baseAtk: 13, reward: { money: 20, defense: 2 },
    relicDrop: { id: "beastFang", name: "裂魂兽牙", icon: "🦷", desc: "凶兽折断的獠牙，仍残留着狂暴的能量。" },
  },
  {
    id: "cursedArmor", name: "诅咒铠甲", icon: "🛡️",
    desc: "被暗影附身的古旧铠甲，行动迟缓但攻击沉重。", type: "elite",
    baseHp: 150, baseAtk: 13, reward: { money: 35, defense: 3 },
    relicDrop: { id: "cursedShard", name: "诅咒碎片", icon: "💎", desc: "铠甲核心的暗色碎片，触碰时传来低语。" },
  },
  {
    id: "shadowSpider", name: "暗影蛛群", icon: "🕷",
    desc: "成群的暗影蜘蛛从墙壁涌出！", type: "elite",
    baseHp: 120, baseAtk: 14, reward: { money: 30, attack: 3 },
    relicDrop: { id: "spiderSilk", name: "暗影蛛丝", icon: "🕸", desc: "凝固后坚如钢丝的蛛丝，可织成护甲。" },
  },
  {
    id: "frostElemental", name: "冰元素", icon: "🧊",
    desc: "秘境中凝聚的冰元素生物，周身弥漫寒雾。", type: "solo",
    baseHp: 50, baseAtk: 15, reward: { money: 18, crystal: 3 },
    relicDrop: { id: "frostCore", name: "冰晶核心", icon: "❄️", desc: "冰元素消散后遗留的内核，冰冷刺骨。" },
  },
  {
    id: "banditChief", name: "强盗头子", icon: "🗡️",
    desc: "强盗团伙的首领，据说藏了不少好东西。", type: "elite",
    baseHp: 170, baseAtk: 12, reward: { money: 50, item: "bigPotion", count: 2 },
    relicDrop: { id: "banditMap", name: "残破的藏宝图", icon: "🗺", desc: "标记着秘境深处某处宝藏的地图碎片。" },
  },
  {
    id: "goblinAmbush", name: "哥布林劫匪团", icon: "🧌",
    desc: "一群地精打扮的哥布林拦住了去路——等等，它们看起来好眼熟……", type: "elite",
    baseHp: 90, baseAtk: 11, reward: { money: 25, item: "potion", count: 3 },
    relicDrop: { id: "goblinMedal", name: "哥布林营长勋章", icon: "🏅", desc: "哥布林训练营颁发的荣誉勋章，虽然含金量存疑。" },
  },
  {
    id: "skeletonArcher", name: "骷髅弓手", icon: "💀",
    desc: "秘境中被唤起的骷髅弓手，箭矢带着腐蚀之力。", type: "solo",
    baseHp: 48, baseAtk: 16, reward: { money: 22, attack: 2 },
    relicDrop: { id: "boneBowstring", name: "枯骨弓弦", icon: "🏹", desc: "骷髅弓手遗留的弓弦，拨动时发出骨鸣般的颤音。" },
  },
  {
    id: "mimicChest", name: "宝箱怪", icon: "🧰",
    desc: "伪装成宝箱的怪物，张开大嘴时才暴露真面目！", type: "solo",
    baseHp: 70, baseAtk: 14, reward: { money: 35, item: "bigPotion", count: 1 },
    relicDrop: { id: "mimicTongue", name: "拟态舌刃", icon: "👅", desc: "宝箱怪伸缩自如的舌刃，切割力惊人。" },
  },
  {
    id: "flameImp", name: "烈焰小鬼", icon: "🔥",
    desc: "浑身燃烧着火焰的小恶魔，跳跃间留下一串火痕。", type: "solo",
    baseHp: 40, baseAtk: 18, reward: { money: 20, crystal: 4 },
    relicDrop: { id: "impHorn", name: "小鬼火角", icon: "🦬", desc: "烈焰小鬼断落的角，仍在持续燃烧。" },
  },
  {
    id: "stoneGargoyle", name: "石像鬼", icon: "🗿",
    desc: "栖息在秘境穹顶的石像鬼，皮坚如岩，俯冲攻击凌厉。", type: "elite",
    baseHp: 200, baseAtk: 15, reward: { money: 40, defense: 3 },
    relicDrop: { id: "gargoyleEye", name: "石化之眼", icon: "👁", desc: "石像鬼的眼珠，与它对视时感觉身体在凝固。" },
  },
  {
    id: "voidLeech", name: "虚空水蛭", icon: "🪱",
    desc: "从空间裂缝中钻出的半透明水蛭，吸食的不只是血液。", type: "elite",
    baseHp: 110, baseAtk: 13, reward: { money: 30, crystal: 5 },
    relicDrop: { id: "voidMucus", name: "虚空黏液", icon: "💧", desc: "虚空水蛭分泌的黏液，接触物体会短暂消失。" },
  },
  {
    id: "crystalGolem", name: "水晶魔像", icon: "💎",
    desc: "由秘境水晶凝结而成的人形魔像，折射着七彩光芒。", type: "elite",
    baseHp: 180, baseAtk: 14, reward: { money: 35, crystal: 6 },
    relicDrop: { id: "crystalHeart", name: "水晶心脏", icon: "💠", desc: "水晶魔像的核心，内部流转着秘境的纯粹能量。" },
  },
  {
    id: "plagueRat", name: "瘟疫鼠王", icon: "🐀",
    desc: "体型如牛的巨鼠，身上散发着瘟疫的气息，尾尖滴着毒液。", type: "solo",
    baseHp: 60, baseAtk: 15, reward: { money: 18, item: "dotPotion", count: 2 },
    relicDrop: { id: "plagueTail", name: "瘟疫鼠尾", icon: "🦠", desc: "瘟疫鼠王断裂的尾巴，仍散发着致命的毒气。" },
  },
  {
    id: "runeKnight", name: "符文骑士", icon: "⚔️",
    desc: "远古文明留下的符文铠甲骑士，剑上刻满战斗铭文，自动执行战斗程序。", type: "elite",
    baseHp: 160, baseAtk: 17, reward: { money: 45, attack: 3, defense: 2 },
    relicDrop: { id: "runeBlade", name: "符文剑刃", icon: "🗡️", desc: "符文骑士的剑刃，上面的铭文仍在微微发光。" },
  },
];

// 事件连锁表：某个事件处理后可能触发后续事件
// chainFrom: 源事件id, chance: 触发概率, target: 目标事件id
const EVENT_CHAINS = [
  { chainFrom: "treasureChest", chance: 0.3, target: "trapPit" },
  { chainFrom: "forestSage", chance: 0.4, target: "ancientBook" },
  { chainFrom: "shrine", chance: 0.3, target: "fairySpring" },
  { chainFrom: "wanderer", chance: 0.25, target: "ancientBook" },
  { chainFrom: "fairySpring", chance: 0.35, target: "powerTest" },
  { chainFrom: "GoblinTrainingCamp", chance: 0.5, target: "GoblinReturn", requireFlag: "goblinTrained" },
  { chainFrom: "GoblinTrainingCamp", chance: 0.8, target: "GoblinReturn", requireFlag: "goblinPatron" },
];

// 特长解锁表：通过特定事件检定通过后可解锁后天特长
const TALENT_UNLOCKS = [
  { eventId: "powerTest", choiceIdx: 1, talentId: "battleInstinct", desc: "力量试炼石的认可让你领悟了战斗直觉" },
  { eventId: "defTest", choiceIdx: 1, talentId: "survival", desc: "穿越盾阵的经历激发了你求生的本能" },
  { eventId: "luckTest", choiceIdx: 1, talentId: "treasureHunter", desc: "命运骰子的青睐唤醒了你寻宝的直觉" },
  { eventId: "forestSage", choiceIdx: 2, talentId: "manaAffinity", desc: "贤者的休息治愈触发了你体内沉睡的魔力" },
];

// 信物结局表：收集特定信物组合后击败第3关BOSS触发隐藏第4关
// relicIds: 需要持有的信物ID列表（全部满足）
// 默认通关结局（不满足任何信物条件）
const DEFAULT_ENDING = {
  name: "秘境封印",
  desc: "击败了所有BOSS后，秘境的异动逐渐平息。你收集的远征记录成为冒险者公会的重要文献。",
};

// 道具ID→名称映射
const ITEM_NAMES = {
  potion: "治疗药水",
  bigPotion: "大治疗药水",
  shield: "护盾",
  atkPotion: "猛力药水",
  critPotion: "鹰眼药水",
  dotPotion: "剧毒药水",
  reviveScroll: "复活卷轴",
  actionHorn: "行动号角",
};

// ================================================================
//  二、通用技能书池（探索阶段可额外习得的技能）
// ================================================================

const UNIVERSAL_SKILLBOOKS = [
  {
    id: "bookPowerStrike", name: "力量打击", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "造成 1.6 倍攻击力的伤害（通用技能书习得）",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      const dmg = Math.max(1, Math.floor(atk * 1.6) + getRandomInt(0, 2));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      return { msg: "📖 " + player.name + " 发动【力量打击】！造成 " + dmg + " 点伤害！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
    },
  },
  {
    id: "bookQuickHeal", name: "快速回复", icon: "📖", cooldown: 0, maxCd: 3,
    desc: "恢复自身 25 HP（通用技能书习得）",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const amt = Math.min(25, player.maxHp - player.hp);
      player.hp += amt;
      return { msg: "📖 " + player.name + " 发动【快速回复】！恢复 " + amt + " HP！" };
    },
  },
  {
    id: "bookFireBurst", name: "火焰爆发", icon: "📖", cooldown: 0, maxCd: 5,
    desc: "对 BOSS 造成攻击力 1.8 倍伤害，附带灼烧 1 层",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      const dmg = Math.max(1, Math.floor(atk * 1.8) + getRandomInt(0, 3));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      if (!boss._burnStacks) boss._burnStacks = 0;
      if (!boss._burnDuration) boss._burnDuration = 0;
      boss._burnStacks = Math.min(boss._burnStacks + 1, 3);
      boss._burnDuration = Math.max(boss._burnDuration, 2);
      return { msg: "📖 " + player.name + " 发动【火焰爆发】！造成 " + dmg + " 点伤害！灼烧 " + boss._burnStacks + " 层！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
    },
  },
  {
    id: "bookThorns", name: "荆棘护甲", icon: "📖", cooldown: 0, maxCd: 6,
    desc: "本回合 BOSS 攻击你时反弹 50% 伤害",
    universal: true,
    execute: function(game, ctx, player, boss) {
      player._thornsActive = true;
      return { msg: "📖 " + player.name + " 发动【荆棘护甲】！BOSS 攻击时将反弹 50% 伤害。" };
    },
  },
  {
    id: "bookSmite", name: "神圣打击", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "基于自身当前HP 100% 造成穿盾贯穿伤害（无视护盾）",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const dmg = Math.max(1, Math.floor(player.hp * 1.0));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      return { msg: "📖 " + player.name + " 发动【神圣打击】！造成 " + dmg + " 点穿盾贯穿伤害（基于自身当前HP）！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg, trueDamage: true };
    },
  },
  {
    id: "bookShieldBash", name: "盾击", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "造成防御 x2.5 的伤害，且使 BOSS 下次攻击伤害减半",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const dmg = Math.max(1, Math.floor(player.defense * 2.5));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      boss._frostDebuff = true;
      return { msg: "📖 " + player.name + " 发动【盾击】！造成 " + dmg + " 点伤害，BOSS 下次攻击减半！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
    },
  },
  {
    id: "bookVulnerability", name: "脆弱诅咒", icon: "📖", cooldown: 0, maxCd: 5,
    desc: "使BOSS下次受到的伤害增加50%（脆弱标记）",
    universal: true,
    execute: function(game, ctx, player, boss) {
      boss._vulnerable = true;
      return { msg: "📖 " + player.name + " 发动【脆弱诅咒】！" + boss.name + " 被标记脆弱，下次受到的伤害增加50%！" };
    },
  },
  {
    id: "bookCombo", name: "连击之书", icon: "📖", cooldown: 0, maxCd: 6,
    desc: "被动：每次攻击有25%概率额外造成一次普攻伤害，一回合仅触发一次",
    universal: true,
    execute: function(game, ctx, player, boss) {
      return { msg: "📖 " + player.name + " 已习得【连击】被动！每次攻击有25%概率额外攻击一次。" };
    },
  },
  {
    id: "bookSeal", name: "封印术", icon: "📖", cooldown: 0, maxCd: 7,
    desc: "封印BOSS 2回合，使其只能普攻无法使用技能",
    universal: true,
    execute: function(game, ctx, player, boss) {
      boss._sealed = 2;
      return { msg: "📖 " + player.name + " 发动【封印术】！" + boss.name + " 被封印2回合，只能进行普攻！" };
    },
  },
  // ---- v3.0 新增技能书 ----
  {
    id: "bookCounterattack", name: "逆转反击", icon: "📖", cooldown: 0, maxCd: 1,
    desc: "本回合受到伤害时，反弹等量伤害（反转）",
    universal: true,
    execute: function(game, ctx, player, boss) {
      player._counterAtkTurn = true;
      return { msg: "📖 " + player.name + " 发动【逆转反击】！本回合受到伤害时反弹等量伤害！" };
    },
  },
  {
    id: "bookImpactAttack", name: "冲击", icon: "📖", cooldown: 0, maxCd: 3,
    desc: "造成 1 倍攻击力 + 1 倍防御力的真实伤害",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      const dmg = Math.max(1, atk + player.defense + getRandomInt(-1, 2));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      return { msg: "📖 " + player.name + " 发动【冲击】！造成 " + dmg + " 点真实伤害！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg, trueDamage: true };
    },
  },
  {
    id: "bookDoubleSlash", name: "二连斩", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "快速攻击两次，造成 (0.8 倍攻击力) x 2 的伤害",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      var total = 0;
      var detail = [];
      for (var i = 0; i < 2; i++) {
        var hit = Math.max(1, Math.floor(atk * 0.8) + getRandomInt(-1, 2));
        boss.hp -= hit;
        player.totalDamage += hit;
        total += hit;
        detail.push(hit);
      }
      return { msg: "📖 " + player.name + " 发动【二连斩】！造成 " + detail[0] + " + " + detail[1] + " = " + total + " 点伤害！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: total };
    },
  },
  {
    id: "bookMixedBlessing", name: "双刃剑", icon: "📖", cooldown: 0, maxCd: 5,
    desc: "造成 2.5 倍攻击力伤害，但对自己造成 0.8 倍攻击力伤害",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      const dmgToBoss = Math.max(1, Math.floor(atk * 2.5) + getRandomInt(-1, 3));
      const dmgToSelf = Math.max(1, Math.floor(atk * 0.8));
      boss.hp -= dmgToBoss;
      player.totalDamage += dmgToBoss;
      player.hp -= dmgToSelf;
      if (player.hp <= 0) { player.hp = 0; player.alive = false; }
      return { msg: "📖 " + player.name + " 发动【双刃剑】！对 " + boss.name + " 造成 " + dmgToBoss + " 点伤害，但自伤 " + dmgToSelf + " 点！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp + "\n💔 自身 HP：" + player.hp + "/" + player.maxHp, dmg: dmgToBoss };
    },
  },
  {
    id: "bookFireAffinity", name: "火元素亲和", icon: "📖", cooldown: 0, maxCd: 1,
    desc: "火焰伤害 x1.2，不可叠加，持续整场战斗",
    universal: true,
    execute: function(game, ctx, player, boss) {
      if (player._fireAffinity) return { msg: "📖 火元素亲和已经生效中！" };
      player._fireAffinity = true;
      return { msg: "📖 " + player.name + " 发动【火元素亲和】！本次战斗火焰伤害永久提升 20%！" };
    },
  },
  {
    id: "bookFireSpell", name: "火焰术", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "造成 2 倍攻击力的火焰伤害",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      var mult = player._fireAffinity ? 1.2 : 1.0;
      const dmg = Math.max(1, Math.floor(atk * 2 * mult) + getRandomInt(0, 3));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      return { msg: "📖 " + player.name + " 发动【火焰术】！造成 " + dmg + " 点火焰伤害！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
    },
  },
  {
    id: "bookFireTide", name: "火潮", icon: "📖", cooldown: 0, maxCd: 5,
    desc: "造成 0.3 倍攻击力的火焰伤害，附带灼烧 3 层",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      var mult = player._fireAffinity ? 1.2 : 1.0;
      const dmg = Math.max(1, Math.floor(atk * 0.3 * mult));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      if (!boss._burnStacks) boss._burnStacks = 0;
      if (!boss._burnDuration) boss._burnDuration = 0;
      boss._burnStacks = Math.min(boss._burnStacks + 3, 9);
      boss._burnDuration = Math.max(boss._burnDuration, 3);
      return { msg: "📖 " + player.name + " 发动【火潮】！造成 " + dmg + " 点火焰伤害！灼烧 " + boss._burnStacks + " 层！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
    },
  },
  {
    id: "bookExplosion", name: "爆裂魔法", icon: "📖", cooldown: 0, maxCd: 8,
    desc: "引爆所有灼烧层数，造成 (灼烧层数 x 0.9) x 1.4 倍攻击力伤害，清除灼烧",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      var mult = player._fireAffinity ? 1.2 : 1.0;
      var burnStacks = boss._burnStacks || 0;
      var dmg = Math.max(1, Math.floor(burnStacks * 0.9 * atk * 1.4 * mult));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      boss._burnStacks = 0;
      boss._burnDuration = 0;
      return { msg: "📖 " + player.name + " 发动【爆裂魔法】！引爆 " + burnStacks + " 层灼烧，造成 " + dmg + " 点火焰伤害！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
    },
  },
  {
    id: "bookCryoTherapy", name: "冻结术", icon: "📖", cooldown: 0, maxCd: 5,
    desc: "造成 1 倍攻击力伤害，30% 概率使 BOSS 下一次行动被跳过",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      const dmg = Math.max(1, Math.floor(atk * 1.0) + getRandomInt(-1, 2));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      var frozen = Math.random() < 0.3;
      var extraMsg = frozen ? "\n❄️ " + boss.name + " 被冻结了！下一次行动将被跳过！" : "";
      if (frozen) { boss._skipNext = true; }
      return { msg: "📖 " + player.name + " 发动【冻结术】！造成 " + dmg + " 点伤害！" + extraMsg + "\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
    },
  },
  {
    id: "bookArcticBlast", name: "极寒风暴", icon: "📖", cooldown: 0, maxCd: 7,
    desc: "造成 1.6 倍攻击力伤害，BOSS 下一次行动被跳过",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      const dmg = Math.max(1, Math.floor(atk * 1.6) + getRandomInt(0, 3));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      boss._skipNext = true;
      return { msg: "📖 " + player.name + " 发动【极寒风暴】！造成 " + dmg + " 点伤害！" + boss.name + " 被冻结了！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
    },
  },
  {
    id: "bookArmorPiercing", name: "碎甲锥", icon: "📖", cooldown: 0, maxCd: 5,
    desc: "造成 1.5 倍攻击力真实伤害，清除BOSS护盾，下一回合BOSS伤害减半",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      const dmg = Math.max(1, Math.floor(atk * 1.5) + getRandomInt(0, 3));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      var shieldCleared = 0;
      if (game.bossSkillActive && game.bossSkillActive["shield"] > 0) {
        shieldCleared = game.bossSkillActive["shield"];
        game.bossSkillActive["shield"] = 0;
      }
      boss._defReset = true;
      var extraMsg = "";
      if (shieldCleared > 0) extraMsg += "清除了 " + shieldCleared + " 层护盾！";
      extraMsg += boss.name + " 下次伤害减半！";
      return { msg: "📖 " + player.name + " 发动【碎甲锥】！造成 " + dmg + " 点真实伤害！" + extraMsg + "\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg, trueDamage: true };
    },
  },
  {
    id: "bookMysticComet", name: "魔力彗星", icon: "📖", cooldown: 0, maxCd: 10,
    desc: "造成 3 倍攻击力的真实伤害",
    universal: true,
    execute: function(game, ctx, player, boss) {
      const atk = getEffectiveAttack(player);
      const dmg = Math.max(1, Math.floor(atk * 3) + getRandomInt(0, 5));
      boss.hp -= dmg;
      player.totalDamage += dmg;
      return { msg: "📖 " + player.name + " 发动【魔力彗星】！造成 " + dmg + " 点真实伤害！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg, trueDamage: true };
    },
  },
  {
    id: "bookAlchemy", name: "炼金术", icon: "📖", cooldown: 0, maxCd: 6,
    desc: "生成一瓶随机药剂（大治疗药水/鹰眼药水/护盾/力量药水）",
    universal: true,
    execute: function(game, ctx, player, boss) {
      var potions = ["bigPotion", "critPotion", "shield", "atkPotion"];
      var potion = potions[Math.floor(Math.random() * potions.length)];
      var potionNames = { bigPotion: "大治疗药水", critPotion: "鹰眼药水", shield: "护盾", atkPotion: "力量药水" };
      if (!player.items) player.items = [];
      var existing = player.items.find(function(i) { return i.id === potion; });
      if (existing) { existing.count += 1; }
      else { player.items.push({ id: potion, count: 1 }); }
      return { msg: "📖 " + player.name + " 发动【炼金术】！获得一瓶【" + potionNames[potion] + "】！" };
    },
  },
  {
    id: "bookBless", name: "庇佑术", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "获得一次抵挡所有伤害的庇佑（至多叠加 2 层）",
    universal: true,
    execute: function(game, ctx, player, boss) {
      var addLayers = Math.min(1, 2 - (player._blessing || 0));
      player._blessing = (player._blessing || 0) + addLayers;
      return { msg: "📖 " + player.name + " 发动【庇佑术】！获得 " + addLayers + " 层庇佑！（当前 " + player._blessing + " 层）" };
    },
  },
  {
    id: "bookHolyLight", name: "圣洁术", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "解除自身所有负面效果（冻结/束缚/跳过/中毒）",
    universal: true,
    execute: function(game, ctx, player, boss) {
      cleanseDebuffs(player);
      return { msg: "📖 " + player.name + " 发动【圣洁术】！解除了所有负面效果！" };
    },
  },
  {
    id: "bookSingleHeal", name: "单体治愈", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "恢复自身 30% 最大 HP 并额外回复 1 x 攻击力的 HP",
    universal: true,
    execute: function(game, ctx, player, boss) {
      var pctHeal = Math.floor(player.maxHp * 0.3);
      var atkHeal = getEffectiveAttack(player);
      var total = Math.min(pctHeal + atkHeal, player.maxHp - player.hp);
      player.hp += total;
      player.totalHeal += total;
      return { msg: "📖 " + player.name + " 发动【单体治愈】！恢复 " + total + " HP！（30% +" + atkHeal + "）" };
    },
  },
  {
    id: "bookFeeble", name: "虚弱", icon: "📖", cooldown: 0, maxCd: 4,
    desc: "BOSS 下一次造成的伤害 x0.6",
    universal: true,
    execute: function(game, ctx, player, boss) {
      boss._weakDebuff = true;
      return { msg: "📖 " + player.name + " 发动【虚弱】！" + boss.name + " 下次伤害降低 40%！" };
    },
  },
  {
    id: "bookDmgBoost", name: "伤害增益", icon: "📖", cooldown: 0, maxCd: 6,
    desc: "3 回合内造成的伤害提升至 1.3 倍",
    universal: true,
    execute: function(game, ctx, player, boss) {
      player._dmgBoost = 3;
      return { msg: "📖 " + player.name + " 发动【伤害增益】！3 回合内伤害 x1.3！" };
    },
  },
  {
    id: "bookAtkBoostS", name: "攻击增益·小", icon: "📖", cooldown: 0, maxCd: 6,
    desc: "3 回合内攻击力提升 20%",
    universal: true,
    execute: function(game, ctx, player, boss) {
      player._atkBuff = 3;
      return { msg: "📖 " + player.name + " 发动【攻击增益·小】！3 回合内攻击力 +20%！" };
    },
  },
  {
    id: "bookDefBoost", name: "防御增益", icon: "📖", cooldown: 0, maxCd: 5,
    desc: "3 回合内防御力提升 20%",
    universal: true,
    execute: function(game, ctx, player, boss) {
      player._defBuff = 3;
      return { msg: "📖 " + player.name + " 发动【防御增益】！3 回合内受伤减免 20%！" };
    },
  },
  {
    id: "bookConcentrate", name: "聚精会神", icon: "📖", cooldown: 0, maxCd: 8,
    desc: "攻击必定暴击，持续 3 回合",
    universal: true,
    execute: function(game, ctx, player, boss) {
      player._critGuaranteed = 3;
      return { msg: "📖 " + player.name + " 发动【聚精会神】！3 回合内攻击必定暴击！" };
    },
  },
  {
    id: "bookVampiric",
    name: "吸血",
    icon: "📖",
    cooldown: 0,
    maxCd: 6,
    desc: "使用后 3 次行动内获得 50% 吸血效果",
    universal: true,
    execute: function(game, ctx, player, boss) {
      player._vampiricTurns = 3;
      return { msg: "📖 " + player.name + " 发动【吸血】！接下来 3 次攻击将回复造成伤害 50% 的生命值！" };
    },
  },
];

const RELIC_ENDINGS = [
  {
    id: "ending_void",
    relicIds: ["cursedShard", "frostCore"],
    name: "虚空裂缝",
    desc: "诅咒碎片与冰晶核心产生共鸣，秘境深处裂开了一道通往虚空的裂缝。远古封印正在崩解……必须进入阻止灾难！",
    bossPool: [
      {
        name: "虚空侵蚀体", icon: "🌀",
        desc: "从裂缝中涌出的不可名状之物，是虚空领主残骸的变异体。它正在吞噬整个秘境。",
        baseHp: 900,
        baseAtk: 28,
        skills: [
          { name: "虚空吞噬", desc: "吞噬一名玩家，造成 30 点伤害并回复等量HP", damage: 30, trigger: "turn", triggerVal: 2, drain: true },
          { name: "维度崩塌", desc: "对所有玩家造成 18 点伤害并降低攻击力 2", damage: 18, trigger: "turn", triggerVal: 3, aoe: true, atkReduce: 2 },
          { name: "湮灭脉冲", desc: "血量低于 30% 时每回合全体 15 点伤害", damage: 15, trigger: "hp", triggerVal: 0.3 },
        ],
      },
    ],
    victoryBonus: { money: 100, crystal: 15 },
  },
  {
    id: "ending_dragon",
    relicIds: ["beastFang", "tarnishedBadge"],
    name: "龙裔觉醒",
    desc: "兽牙与骑士徽章上的纹路相互呼应——它们竟然是龙族后裔的信物！远征的尽头，沉睡的龙族血脉正在觉醒……",
    bossPool: [
      {
        name: "觉醒龙裔", icon: "🐉",
        desc: "远古巨龙的后裔，被信物唤醒了龙族之力。它的双眼燃烧着金色的怒火。",
        baseHp: 800,
        baseAtk: 30,
        skills: [
          { name: "龙息连击", desc: "连续喷吐两次龙息，全体各造成 20 点伤害", damage: 20, trigger: "turn", triggerVal: 2, aoe: true, doubleHit: true },
          { name: "龙鳞强化", desc: "每 3 回合获得 3 层护盾，受伤减半", trigger: "turn", triggerVal: 3 },
          { name: "终焉龙威", desc: "血量低于 25% 时所有玩家跳过行动 + 全体 12 点伤害", damage: 12, trigger: "hp", triggerVal: 0.25, aoe: true, stunAll: true },
        ],
      },
    ],
    victoryBonus: { money: 120, crystal: 20 },
  },
  {
    id: "ending_treasure",
    relicIds: ["banditMap", "spiderSilk"],
    name: "秘境秘宝",
    desc: "藏宝图碎片与暗影蛛丝交织在一起，浮现出通往秘境最深处宝藏密室的路径！传说中那位强盗头子藏匿的秘宝就在前方……",
    bossPool: [
      {
        name: "守护者魔像", icon: "🗿",
        desc: "密室入口的终极守护者，一座由秘境精华铸成的巨大魔像。它存在的唯一意义就是守护身后的宝物。",
        baseHp: 750,
        baseAtk: 20,
        skills: [
          { name: "精华冲击", desc: "对随机目标造成 35 点伤害", damage: 35, trigger: "turn", triggerVal: 2 },
          { name: "密室封印", desc: "每 4 回合全体玩家无法使用技能", trigger: "turn", triggerVal: 4, silence: true },
          { name: "终极守护", desc: "血量低于 20% 时攻击力翻倍，防御力 +10", trigger: "hp", triggerVal: 0.2 },
        ],
      },
    ],
    victoryBonus: { money: 200, crystal: 10, item: "bigPotion", count: 5 },
  },
  {
    id: "ending_goblin",
    relicIds: ["goblinMedal"],
    name: "哥布林的终极试炼",
    desc: "你身上的哥布林营长勋章突然发出了强烈的光芒！一个声音传来：'恩人！我们的终极训练营已经建成了，请你来做最终试炼！'",
    bossPool: [
      {
        name: "哥布林大王", icon: "🧌",
        desc: "训练营的最终Boss——哥布林大王！它站在擂台中央，虽然是哥布林体型却异常巨大，浑身散发着不明的力量。",
        baseHp: 700,
        baseAtk: 20,
        skills: [
          { name: "训练营突袭", desc: "召唤一群哥布林学徒攻击全体，造成 16 点伤害", damage: 16, trigger: "turn", triggerVal: 2, aoe: true },
          { name: "哥布林战术", desc: "随机偷取一名玩家 5 攻击力并加给自己", trigger: "turn", triggerVal: 3, atkSteal: 5 },
          { name: "最终一击", desc: "血量低于 30% 时攻击力 +100%，但防御力归零", trigger: "hp", triggerVal: 0.3 },
        ],
      },
    ],
    victoryBonus: { money: 150, crystal: 8, attack: 5, defense: 3 },
  },
];

// ================================================================
//  三、职业定义（含技能与被动）
// ================================================================

const CLASSES = {
  warrior: {
    id: "warrior",
    name: "战士",
    icon: "⚔️",
    desc: "近战高输出，擅长正面交锋。越战越勇，绝不倒下。",
    bonusHp: 20, bonusAtk: 5, bonusDef: 3,
    passive: {
      name: "战意狂潮",
      desc: "HP每降低10点，攻击力+15%；进入BOSS战时将当前HP的50%转化为血盾（伤害和治疗优先作用于血盾），战斗结束后根据两根血条剩余血量加权提升最大HP上限，攻击加成战后自动消失",
    },
    skills: [
      {
        id: "heavyStrike", name: "重击", icon: "💥", cooldown: 0, maxCd: 3,
        desc: "造成 1.8 倍攻击力的伤害，无视 BOSS 护盾",
        execute: function(game, ctx, player, boss) {
          const atk = getEffectiveAttack(player);
          const dmg = Math.max(1, Math.floor(atk * 1.8) + getRandomInt(-1, 2));
          boss.hp -= dmg;
          player.totalDamage += dmg;
          let msg = "💥 " + player.name + " 发动【重击】！造成 " + dmg + " 点伤害！";
          msg += "\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp;
          return { msg: msg, dmg: dmg, trueDamage: true };
        },
      },
      {
        id: "warCry", name: "战吼", icon: "📯", cooldown: 0, maxCd: 5,
        desc: "全体队友攻击力 +3，持续本次 BOSS 战",
        execute: function(game, ctx, player, boss) {
          let names = [];
          for (const p of game.players) {
            if (p.alive) {
              p._warCryBonus = (p._warCryBonus || 0) + 3;
              names.push(p.name);
            }
          }
          return { msg: "📯 " + player.name + " 发动【战吼】！全体攻击力 +3！（" + names.join("、") + "）" };
        },
      },
    ],
  },
  mage: {
    id: "mage",
    name: "法师",
    icon: "🔮",
    desc: "远程法术输出，拥有强力范围技能。",
    bonusHp: 10, bonusAtk: 2, bonusDef: 0,
    passive: {
      name: "奥术亲和",
      desc: "所有技能伤害 +60%，每学习一本技能书额外 +10%",
    },
    skills: [
      {
        id: "fireball", name: "火球术", icon: "🔥", cooldown: 0, maxCd: 3,
        desc: "造成 2 倍攻击力的火焰伤害，附带灼烧（每回合 3 点/层，持续 2 回合）",
        execute: function(game, ctx, player, boss) {
          const atk = getEffectiveAttack(player);
          const dmg = Math.max(1, Math.floor(atk * 2) + getRandomInt(0, 3));
          boss.hp -= dmg;
          player.totalDamage += dmg;
          if (!boss._burnStacks) boss._burnStacks = 0;
          if (!boss._burnDuration) boss._burnDuration = 0;
          boss._burnStacks = Math.min(boss._burnStacks + 1, 3);
          boss._burnDuration = Math.max(boss._burnDuration, 2);
          let msg = "🔥 " + player.name + " 发动【火球术】！造成 " + dmg + " 点伤害！";
          msg += "\n☀️ 灼烧叠加至 " + boss._burnStacks + " 层（每回合 " + (boss._burnStacks * 3) + " 点）";
          msg += "\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp;
          return { msg: msg, dmg: dmg };
        },
      },
      {
        id: "frostNova", name: "冰霜新星", icon: "❄️", cooldown: 0, maxCd: 5,
        desc: "对 BOSS 造成攻击力 1.2 倍伤害，并使其下一次攻击伤害减半",
        execute: function(game, ctx, player, boss) {
          const atk = getEffectiveAttack(player);
          const dmg = Math.max(1, Math.floor(atk * 1.2));
          boss.hp -= dmg;
          player.totalDamage += dmg;
          boss._frostDebuff = true;
          let msg = "❄️ " + player.name + " 发动【冰霜新星】！造成 " + dmg + " 点伤害！";
          msg += "\n🧊 " + boss.name + " 被冰冻削弱，下次攻击伤害减半！";
          msg += "\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp;
          return { msg: msg, dmg: dmg };
        },
      },
    ],
  },
  healer: {
    id: "healer",
    name: "祭司",
    icon: "✨️",
    desc: "治疗专家，按百分比恢复团队HP，越残血恢复越多。",
    bonusHp: 15, bonusAtk: 4, bonusDef: 2,
    passive: {
      name: "复苏之风",
      desc: "回合结束时，全体队友恢复已损失HP的 10%；祭司每次施放技能后，全体额外恢复最大HP 5%",
    },
    skills: [
      {
        id: "groupHeal", name: "群体治愈", icon: "💚", cooldown: 0, maxCd: 4,
        desc: "为全体队友恢复各自最大HP 20% 的HP",
        execute: function(game, ctx, player, boss) {
          let healed = [];
          for (const p of game.players) {
            if (p.alive && p.hp < p.maxHp) {
              const amt = Math.min(Math.floor(p.maxHp * 0.2), p.maxHp - p.hp);
              p.hp += amt;
              player.totalHeal += amt;
              healed.push(p.name + "+" + amt);
            }
          }
          return { msg: "💚 " + player.name + " 发动【群体治愈】！全体恢复各自最大HP 20%。（" + healed.join(" ") + "）" };
        },
      },
      {
        id: "revive", name: "复活术", icon: "🌟", cooldown: 0, maxCd: 8,
        desc: "复活一名倒下的队友，恢复 30% 最大 HP",
        execute: function(game, ctx, player, boss) {
          const dead = game.players.filter(p => !p.alive);
          if (dead.length === 0) return { msg: "🌟 没有需要复活的目标，技能浪费了……" };
          const target = pickRandom(dead);
          target.alive = true;
          var _revivePct = seal.ext.getIntConfig(ext, "复活恢复比例/%") / 100;
          target.hp = Math.max(1, Math.floor(target.maxHp * _revivePct));
          return { msg: "🌟 " + player.name + " 发动【复活术】！" + target.name + " 被复活了！（HP " + target.hp + "/" + target.maxHp + "）" };
        },
      },
    ],
  },
  assassin: {
    id: "assassin",
    name: "刺客",
    icon: "🗡️",
    desc: "高爆发高暴击，擅长收割残血目标，BOSS越残越恐怖。",
    bonusHp: 0, bonusAtk: 7, bonusDef: 0,
    passive: {
      name: "夺命追击",
      desc: "暴击伤害提升至 2.5 倍；BOSS HP 每降低 10%，攻击力 +8%；击杀 BOSS 时恢复全体 20% 最大HP",
    },
    skills: [
      {
        id: "backstab", name: "背刺", icon: "🗡️", cooldown: 0, maxCd: 2,
        desc: "造成攻击力倍率伤害，BOSS 血量越低伤害越高（1.5~2.5 倍）",
        execute: function(game, ctx, player, boss) {
          const hpRatio = boss.hp / boss.maxHp;
          const multiplier = hpRatio < 0.3 ? 2.5 : (hpRatio < 0.5 ? 2.0 : 1.5);
          const atk = getEffectiveAttack(player);
          const dmg = Math.max(1, Math.floor(atk * multiplier) + getRandomInt(0, 3));
          boss.hp -= dmg;
          player.totalDamage += dmg;
          let msg = "🗡️ " + player.name + " 发动【背刺】！" + multiplier.toFixed(1) + " 倍伤害！造成 " + dmg + " 点！";
          msg += "\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp;
          return { msg: msg, dmg: dmg };
        },
      },
      {
        id: "shadowStep", name: "影步", icon: "👤", cooldown: 0, maxCd: 6,
        desc: "进入影步状态 5 回合：闪避期间 BOSS 攻击无效，下次攻击必定暴击（5 倍伤害）",
        execute: function(game, ctx, player, boss) {
          player._shadowStep = 5;
          return { msg: "👤 " + player.name + " 进入【影步】状态（5回合）！期间闪避 BOSS 攻击，下次攻击必定暴击。" };
        },
      },
    ],
  },
  tank: {
    id: "tank",
    name: "守卫",
    icon: "🛡️",
    desc: "高防高血量，团队核心肉盾。越挨打越硬，反伤制敌。",
    bonusHp: 35, bonusAtk: 5, bonusDef: 6,
    passive: {
      name: "不动如山",
      desc: "常驻减伤 20%；嘲讽期间代承伤害降低 50%，反弹 50% 伤害给 BOSS，攻击力 +30%；HP 低于 40% 时代承 70% 且反伤翻倍；每回合结束时对 BOSS 造成防御力等额的固定伤害",
    },
    skills: [
      {
        id: "taunt", name: "嘲讽", icon: "😤", cooldown: 0, maxCd: 3,
        desc: "开启承伤光环（持续 3 回合），期间队友受到的 50% 伤害由守卫代为承受，守卫攻击力 +30%、防御力 +5",
        execute: function(game, ctx, player, boss) {
          player._taunting = true;
          player._tauntDuration = 3;
          player._tauntAtkBuff = 0.3;
          player._defBuff = (player._defBuff || 0) + 5;
          return { msg: "😤 " + player.name + " 发动【嘲讽】！承伤光环开启（3 回合），队友受到伤害的 50% 将由守卫承受，守卫攻击力 +30%，防御力 +5！" };
        },
      },
      {
        id: "ironWall", name: "铁壁", icon: "🏔", cooldown: 0, maxCd: 5,
        desc: "为全体队友提供 15 点伤害吸收护盾 + 防御力 +3（持续 2 回合）",
        execute: function(game, ctx, player, boss) {
          for (const p of game.players) {
            if (p.alive) {
              p._ironWallShield = (p._ironWallShield || 0) + 15;
              p._ironWallDuration = 2;
              p._defBuff = (p._defBuff || 0) + 3;
            }
          }
          return { msg: "🏔 " + player.name + " 发动【铁壁】！全体获得 15 点吸收护盾 + 防御力 +3（持续 2 回合）！" };
        },
      },
    ],
  },

  berserker: {
    id: "berserker",
    name: "狂战士",
    icon: "🗡️",
    desc: "越打越强，本质后期高手。",
    bonusHp: 35, bonusAtk: 7, bonusDef: 4,
    passive: {
      name: "战斗意志",
      desc: "每经过一个自己的回合叠加一层战斗意志，每层提升 2 点攻击力，但每层失去 2 点HP",
    },
    skills: [
      {
        id: "combatStatus", name: "战斗状态", icon: "💪", cooldown: 0, maxCd: 2,
        desc: "立刻获得 10 层战斗意志（+20 攻击力，HP -20）",
        execute: function(game, ctx, player, boss) {
          player._battleStacks = (player._battleStacks || 0) + 10;
          player.hp = Math.max(1, player.hp - 20);
          return { msg: "💪 " + player.name + " 发动【战斗状态】！战斗意志 +10 层（当前 " + player._battleStacks + " 层，攻击力 +" + (player._battleStacks * 2) + "，HP -20）" };
        },
      },
      {
        id: "rage", name: "暴走", icon: "🔥", cooldown: 0, maxCd: 6,
        desc: "立刻造成一次（战斗意志层数 x 2 + 1.5 倍攻击力）的伤害",
        execute: function(game, ctx, player, boss) {
          const stacks = player._battleStacks || 0;
          const atk = getEffectiveAttack(player);
          const dmg = Math.max(1, Math.floor(stacks * 2 + atk * 1.5) + getRandomInt(-1, 3));
          boss.hp -= dmg;
          player.totalDamage += dmg;
          player._battleStacks = 0;
          return { msg: "🔥 " + player.name + " 发动【暴走】！释放全部 " + stacks + " 层战斗意志，造成 " + dmg + " 点伤害！\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp, dmg: dmg };
        },
      },
    ],
  },
  fool: {
    id: "fool",
    name: "愚者",
    icon: "🤡",
    desc: "尚在生长的新生儿，命运尚未定型。每回合随机获得一种职业的临时能力，充满不确定性。",
    bonusHp: 12, bonusAtk: 3, bonusDef: 2,
    passive: {
      name: "混沌共鸣",
      desc: "每回合开始时，随机获得一个其他职业的被动效果（持续本回合）",
    },
    skills: [
      {
        id: "trick", name: "命运之戏", icon: "🎭", cooldown: 0, maxCd: 2,
        desc: "随机触发一个强力效果：高额伤害 / 全体治疗 / 全体护盾 / BOSS减攻",
        execute: function(game, ctx, player, boss) {
          var roll = getRandomInt(1, 4);
          var msg = "🎭 " + player.name + " 发动【命运之戏】！";
          var resultDmg = 0;
          if (roll === 1) {
            // 高额伤害
            var dmg = getEffectiveAttack(player) + getRandomInt(8, 15);
            boss.hp -= dmg;
            player.totalDamage += dmg;
            msg += "命运选择了【毁灭】——对 " + boss.name + " 造成 " + dmg + " 点伤害！";
            resultDmg = dmg;
          } else if (roll === 2) {
            // 全体治疗
            var healed = [];
            for (var pi = 0; pi < game.players.length; pi++) {
              var pp = game.players[pi];
              if (pp.alive && pp.hp < pp.maxHp) {
                var amt = Math.min(Math.floor(pp.maxHp * 0.15), pp.maxHp - pp.hp);
                pp.hp += amt;
                player.totalHeal += amt;
                healed.push(pp.name + "+" + amt);
              }
            }
            msg += "命运选择了【慈悲】——全体恢复 HP！（" + (healed.length > 0 ? healed.join(" ") : "全员满血") + "）";
          } else if (roll === 3) {
            // 全体护盾
            for (var pi = 0; pi < game.players.length; pi++) {
              var pp = game.players[pi];
              if (pp.alive) {
                pp._ironWallShield = (pp._ironWallShield || 0) + 8;
                pp._ironWallDuration = 2;
              }
            }
            msg += "命运选择了【庇护】——全体获得 8 点吸收护盾！";
          } else {
            // BOSS减攻
            boss.attack = Math.max(1, boss.attack - 3);
            msg += "命运选择了【削弱】——" + boss.name + " 攻击力 -3！";
          }
          msg += "\n❤️ " + boss.name + " HP：" + Math.max(0, boss.hp) + "/" + boss.maxHp;
          if (resultDmg > 0) return { msg: msg, dmg: resultDmg, trueDamage: true };
          return { msg: msg };
        },
      },
      {
        id: "jesterStep", name: "小丑步法", icon: "🎪", cooldown: 0, maxCd: 5,
        desc: "闪避下一次 BOSS 攻击，并获得下一次攻击暴击率 100%",
        execute: function(game, ctx, player, boss) {
          player._foolDodge = true;
          player._foolCritNext = true;
          return { msg: "🎪 " + player.name + " 发动【小丑步法】！下一次攻击必定闪避，且下一次攻击必定暴击！" };
        },
      },
    ],
  },

};

function cleanseDebuffs(player) {
  player.skipNext = false;
  if (player._frozenTurns) player._frozenTurns = 0;
  if (player._defResetTimer) player._defResetTimer = 0;
  if (player._poisonedByBoss) player._poisonedByBoss = false;
  // 注意：不清除增益buff
}

const CLASS_LIST = Object.keys(CLASSES);

// ================================================================
//  四、棋盘格子定义
// ================================================================

const BOARD_TILES = [
  { type: "money",   icon: "💰", label: "金钱",     desc: "获得 20 金钱补给",            effect: { money: 20 } },
  { type: "equip",   icon: "🎒", label: "装备",     desc: "获得武器「铁剑」，攻击 +3",    effect: { attack: 3 } },
  { type: "potion",  icon: "🧪", label: "药水",     desc: "获得「治疗药水」x2",          effect: { item: "potion", count: 2 } },
  { type: "attack",  icon: "⚔️",  label: "磨刀石",   desc: "攻击力永久 +2",              effect: { attack: 2 } },
  { type: "defense", icon: "🛡️",  label: "护甲片",   desc: "防御力永久 +2",              effect: { defense: 2 } },
  { type: "trap",    icon: "💀", label: "陷阱",     desc: "损失 10 金钱",               effect: { money: -10 } },
  { type: "money",   icon: "💰", label: "财宝",     desc: "获得 30 金钱",                effect: { money: 30 } },
  { type: "shield",  icon: "🔰", label: "护盾",     desc: "获得「护盾」x1（抵挡一次伤害）", effect: { item: "shield", count: 1 } },
  { type: "attack",  icon: "⚔️",  label: "附魔",     desc: "攻击力永久 +3",              effect: { attack: 3 } },
  { type: "potion",  icon: "🧪", label: "大药水",   desc: "获得「大治疗药水」x1",        effect: { item: "bigPotion", count: 1 } },
  { type: "trap",    icon: "💀", label: "落石",     desc: "损失 20 金钱，跳过下一轮",     effect: { money: -20, skipNext: true } },
  { type: "buff",    icon: "🌟", label: "祝福",     desc: "攻击和防御各 +2",            effect: { attack: 2, defense: 2 } },
  { type: "money",   icon: "💰", label: "古币",     desc: "获得 15 金钱",                effect: { money: 15 } },
  { type: "potion",  icon: "🧪", label: "圣水",     desc: "获得「大治疗药水」x1",        effect: { item: "bigPotion", count: 1 } },
  { type: "attack",  icon: "⚔️",  label: "真伤附魔",  desc: "攻击力永久 +4",              effect: { attack: 4 } },
  { type: "defense", icon: "🛡️",  label: "精锻铠甲",  desc: "防御力永久 +3",              effect: { defense: 3 } },
  { type: "skillbook", icon: "📕", label: "技能书",  desc: "随机获得一本通用技能书",       effect: { skillBook: true } },
  { type: "skillbook", icon: "📗", label: "古籍残卷", desc: "随机获得一本通用技能书",       effect: { skillBook: true } },
  { type: "skillbook", icon: "📘", label: "魔法卷轴", desc: "随机获得一本通用技能书",       effect: { skillBook: true } },
  { type: "buff",    icon: "🌟", label: "生命祝福", desc: "最大 HP +8",                  effect: { maxHpBonus: 8 } },
  { type: "buff",    icon: "🌟", label: "战神祝福", desc: "攻击 +5",                     effect: { attack: 5 } },
  { type: "potion",  icon: "🔴", label: "猛力药水", desc: "获得「猛力药水」x1（战斗中攻击+5）", effect: { item: "atkPotion", count: 1 } },
  { type: "potion",  icon: "🟡", label: "鹰眼药水", desc: "获得「鹰眼药水」x1（3次攻击暴击+30%）", effect: { item: "critPotion", count: 1 } },
  { type: "potion",  icon: "🟢", label: "剧毒药水", desc: "获得「剧毒药水」x1（对BOSS施加剧毒）", effect: { item: "dotPotion", count: 1 } },
  { type: "potion",  icon: "⬜", label: "复活卷轴", desc: "获得「复活卷轴」x1（复活一名队友）", effect: { item: "reviveScroll", count: 1 } },
  { type: "potion",  icon: "📯", label: "行动号角", desc: "获得「行动号角」x1（拉条：让队友额外行动一轮）", effect: { item: "actionHorn", count: 1 } },
  { type: "attack",  icon: "⚔️",  label: "精锻武器",  desc: "攻击力永久 +5",              effect: { attack: 5 } },
  { type: "defense", icon: "🛡️",  label: "秘银铠甲",  desc: "防御力永久 +4",              effect: { defense: 4 } },
];

// ================================================================
//  五、肉鸽事件定义
// ================================================================

const ROGUE_EVENTS = [
  {
    id: "treasureChest",
    name: "神秘宝箱",
    icon: "📦",
    desc: "你发现了一个落满灰尘的宝箱……",
    choices: [
      { text: "直接打开", outcomes: [
        { weight: 50, result: "good", msg: "宝箱里有一把精良武器！攻击力 +5！", effect: { attack: 5 } },
        { weight: 30, result: "good", msg: "宝箱里有一些金币！获得 25 金钱。", effect: { money: 25 } },
        { weight: 20, result: "bad",  msg: "触发了陷阱！受到 8 点伤害！", effect: { selfDamage: 8 } },
      ]},
      { text: "用绳子撬开（需要 10 金钱）", condition: "money >= 10", cost: { money: 10 }, outcomes: [
        { weight: 70, result: "good", msg: "安全撬开！获得大治疗药水 x2！", effect: { item: "bigPotion", count: 2 } },
        { weight: 30, result: "good", msg: "安全撬开！获得攻击力 +4 和防御力 +2！", effect: { attack: 4, defense: 2 } },
      ]},
      { text: "绕过去", outcomes: [
        { weight: 100, result: "neutral", msg: "你谨慎地绕过了宝箱。安全第一。" },
      ]},
    ],
  },
  {
    id: "powerTest",
    name: "力量试炼石",
    icon: "✊️",
    desc: "一块刻着符文巨手的石碑，似乎在评估挑战者的力量。石碑上刻着：力量高于凡人者将获得祝福，弱者将承受代价……",
    check: { stat: "attack", threshold: 12, passDesc: "攻击力 ≥ 12：力量认可", failDesc: "攻击力 < 12：力量不足" },
    choices: [
      { text: "接受力量检定", checkRequired: true, outcomes: [
        { pass: { result: "good", msg: "符文巨手发出金光！你被认可为强者！攻击力 +4，最大HP +5！", effect: { attack: 4, maxHpBonus: 5 } } },
        { fail: { result: "bad", msg: "符文巨手暗淡……你的力量尚不足够。受到 10 点伤害。", effect: { selfDamage: 10 } } },
      ]},
      { text: "强行砸碎石碑（高攻击力额外奖励）", checkRequired: true, outcomes: [
        { pass: { result: "good", msg: "石碑在你拳下粉碎！力量溢出！攻击力 +7！", effect: { attack: 7 } } },
        { fail: { result: "bad", msg: "石碑纹丝不动，反震之力传来！受到 15 点伤害，攻击力 -2。", effect: { selfDamage: 15, attack: -2 } } },
      ]},
      { text: "不碰，绕路走", outcomes: [
        { weight: 100, result: "neutral", msg: "你明智地绕过了试炼石。" },
      ]},
    ],
  },
  {
    id: "forestSage",
    name: "林中贤者",
    icon: "🌲",
    desc: "在你们行进的过程中遇见一名老者。他自称是隐居在此的贤者，并表示前方路途凶险，希望你们能够折返。",
    choices: [
      { text: "用力量说服他", checkRequired: true, check: {
        stat: "attack",
        tiered: true,
        tiers: [
          { min: 15, key: "strong", label: "力量 ≥ 15：强壮有力" },
          { min: 10, max: 14, key: "average", label: "10 ≤ 力量 < 15：差强人意" },
          { max: 9, key: "weak", label: "力量 < 10：太过孱弱" },
        ],
      }, outcomes: [
        { strong: { result: "good", msg: "老者拍了拍你胳膊上的肌肉，认同了你的能力，并交给你一些东西。", effect: { money: 10 } } },
        { average: { result: "neutral", msg: "老者看着你算差强人意的身板，叹了口气递给你一包药粉。获得治疗药水 x2。", effect: { item: "potion", count: 2 } } },
        { weak: { result: "neutral", msg: "老者不认可地摇了摇头，什么都没说离开了。你隐约觉得他刚刚对你翻了个白眼。", effect: {} } },
      ]},
      { text: "请求休息一晚", outcomes: [
        { weight: 100, result: "good", msg: "老者看着你疲惫的样子，没有拒绝。休息一晚后你精神焕发，最大HP +10，HP 恢复 15。", effect: { maxHpBonus: 10, heal: 15 } },
      ]},
      { text: "什么都别说了，打劫", checkRequired: true, check: {
        custom: function(player, ctx) {
          var atk = getEffectiveAttack(player);
          if (player.classId === "assassin" || atk >= 25) {
            return { key: "robSuccess", msg: "\n🔍 检定结果：你" + (player.classId === "assassin" ? "作为刺客的偷窃技巧" : "恐怖的力量") + "让老者毫无还手之力！" };
          }
          return { key: "robFail", msg: "\n🔍 检定结果：你既没有刺客的身手，力量也不够，老者看起来不好惹……" };
        },
      }, outcomes: [
        { robSuccess: { result: "good", msg: "老者气得呼吸困难，在你哼着歌把他家里所有的值钱东西拿走之前，你听见他用12种语言把你骂了一遍。真不愧是贤者的知识储备！", effect: { attack: 5, money: 30, crystal: 5 } } },
        { robFail: { result: "bad", msg: "你没打过他，也没能趁机偷走什么东西，还被狠狠用拐杖抽了屁股，现在火辣辣地痛。", effect: { selfDamage: 10 } } },
      ]},
    ],
  },
  {
    id: "defTest",
    name: "守卫之盾阵",
    icon: "🛡️",
    desc: "前方排列着数面能量盾牌，不断变换阵型。只有足够坚固的防御才能安全穿越，否则将被弹飞。",
    check: { stat: "defense", threshold: 6, passDesc: "防御力 ≥ 6：坚如磐石", failDesc: "防御力 < 6：难以抵挡" },
    choices: [
      { text: "正面穿越盾阵", checkRequired: true, outcomes: [
        { pass: { result: "good", msg: "盾牌为你让路！你吸收了残余能量，防御力 +3，获得护盾x1！", effect: { defense: 3 }, extraItem: { id: "shield", count: 1 } } },
        { fail: { result: "bad", msg: "盾牌能量将你弹飞！受到 12 点伤害！", effect: { selfDamage: 12 } } },
      ]},
      { text: "绕路（安全但耗时）", outcomes: [
        { weight: 70, result: "neutral", msg: "你小心绕过了盾阵，损失了一些时间。" },
        { weight: 30, result: "good", msg: "绕路途中意外捡到金币！获得 10 金钱。", effect: { money: 10 } },
      ]},
    ],
  },
  {
    id: "hpTest",
    name: "生命之泉试炼",
    icon: "💧",
    desc: "一汪散发着荧光的泉水，泉水旁的石碑写着：生命充沛者饮之可获神力，衰弱者饮之将被吞噬……",
    check: { stat: "hpPercent", threshold: 70, passDesc: "HP ≥ 70%：生命充沛", failDesc: "HP < 70%：状态不佳" },
    choices: [
      { text: "饮用泉水", checkRequired: true, outcomes: [
        { pass: { result: "good", msg: "泉水与你的生命力共鸣！最大HP +15，HP全满，攻击力 +2！", effect: { maxHpBonus: 15, fullHeal: true, attack: 2 } } },
        { fail: { result: "bad", msg: "泉水侵蚀了你虚弱的身体！HP -15，最大HP -5！", effect: { selfDamage: 15, maxHpBonus: -5 } } },
      ]},
      { text: "用容器带走泉水", condition: "money >= 8", cost: { money: 8 }, outcomes: [
        { weight: 60, result: "good", msg: "成功装瓶！获得大治疗药水 x1。", effect: { item: "bigPotion", count: 1 } },
        { weight: 40, result: "good", msg: "泉水中含有水晶碎片！获得 2 水晶。", effect: { crystal: 2 } },
      ]},
      { text: "观察后离开", outcomes: [
        { weight: 100, result: "neutral", msg: "你观察了一会儿便离开了。" },
      ]},
    ],
  },
  {
    id: "luckTest",
    name: "命运骰子",
    icon: "🎲",
    desc: "空中悬浮着一颗闪烁的巨型骰子，它似乎想邀请你来一场命运的对赌。掷出的点数越大，奖励越丰厚——但点数太小也会付出代价……",
    check: { stat: "luck", threshold: 4, passDesc: "掷出 4-6：好运降临", failDesc: "掷出 1-3：霉运缠身" },
    choices: [
      { text: "掷命运骰子", checkRequired: true, outcomes: [
        { pass: { result: "good", msg: "骰子停在 [5]！命运眷顾了你！攻击力 +3，防御力 +2，获得 15 金钱！", effect: { attack: 3, defense: 2, money: 15 } } },
        { fail: { result: "bad", msg: "骰子停在 [2]……命运对你皱眉。受到 10 点伤害，金钱 -10。", effect: { selfDamage: 10, money: -10 } } },
      ]},
      { text: "连续掷两次（收益与风险翻倍）", checkRequired: true, outcomes: [
        { pass: { result: "good", msg: "两次都掷出了高点数！大吉大利！攻击力 +5，最大HP +10，获得 25 金钱！", effect: { attack: 5, maxHpBonus: 10, money: 25 } } },
        { fail: { result: "bad", msg: "两次都是低点数……大凶！受到 20 点伤害，防御力 -2，金钱 -15。", effect: { selfDamage: 20, defense: -2, money: -15 } } },
      ]},
      { text: "拒绝赌博，直接走", outcomes: [
        { weight: 100, result: "neutral", msg: "你摇摇头，离开了命运骰子。谨慎也是一种智慧。" },
      ]},
    ],
  },
  {
    id: "mixedTest",
    name: "双子石像",
    icon: "🎭",
    desc: "两座石像分立通道两侧。左边的石像手持巨剑，右边的石像举着大盾。它们同时开口：'选择你的道路——勇者之路需力量，守卫之路需坚韧。'",
    choices: [
      { text: "勇者之路（攻击力检定 ≥ 10）", check: { stat: "attack", threshold: 10, passDesc: "攻击力 ≥ 10", failDesc: "攻击力 < 10" }, checkRequired: true, outcomes: [
        { pass: { result: "good", msg: "巨剑石像认可你的勇气！攻击力 +5，获得攻击之书！", effect: { attack: 5 }, grantSkill: "bookPowerStrike" } },
        { fail: { result: "bad", msg: "巨剑石像摇头——你的力量不够。它挥剑将你击退！受到 12 点伤害。", effect: { selfDamage: 12 } } },
      ]},
      { text: "守卫之路（防御力检定 ≥ 5）", check: { stat: "defense", threshold: 5, passDesc: "防御力 ≥ 5", failDesc: "防御力 < 5" }, checkRequired: true, outcomes: [
        { pass: { result: "good", msg: "大盾石像认可你的坚韧！防御力 +4，最大HP +8！", effect: { defense: 4, maxHpBonus: 8 } } },
        { fail: { result: "bad", msg: "大盾石像叹息——你太脆弱了。冲击波将你震飞！受到 12 点伤害。", effect: { selfDamage: 12 } } },
      ]},
      { text: "两座石像都不理，从中间穿过去", outcomes: [
        { weight: 40, result: "neutral", msg: "你胆大包天地从两座石像中间走过去了。什么也没发生。" },
        { weight: 30, result: "good", msg: "两座石像居然都对你微微点头！获得 10 金钱和 5 HP 恢复。", effect: { money: 10, heal: 5 } },
        { weight: 30, result: "bad", msg: "两座石像同时怒视你！受到 8 点伤害！", effect: { selfDamage: 8 } },
      ]},
    ],
  },
  {
    id: "shrine",
    name: "古老祭坛",
    icon: "⛩️",
    desc: "一座散发着微弱光芒的石制祭坛矗立在前方。",
    choices: [
      { text: "献上 15 金钱祈祷", condition: "money >= 15", cost: { money: 15 }, outcomes: [
        { weight: 60, result: "good", msg: "神明的庇佑降临！HP 恢复至满，最大 HP +10！", effect: { fullHeal: true, maxHpBonus: 10 } },
        { weight: 40, result: "good", msg: "祭坛发光！攻击力和防御力各 +3！", effect: { attack: 3, defense: 3 } },
      ]},
      { text: "触摸祭坛", outcomes: [
        { weight: 40, result: "good", msg: "温暖的力量涌入体内！恢复 20 HP！", effect: { heal: 20 } },
        { weight: 30, result: "neutral", msg: "什么也没有发生……" },
        { weight: 30, result: "bad",  msg: "一阵刺痛！防御力 -1！", effect: { defense: -1 } },
      ]},
      { text: "不理会", outcomes: [
        { weight: 100, result: "neutral", msg: "你无视了祭坛继续前进。" },
      ]},
    ],
  },
  {
    id: "wanderer",
    name: "流浪商人",
    icon: "🧙",
    desc: "一个神秘的流浪商人向你招手。",
    choices: [
      { text: "购买治疗药水 x3（15 金钱）", condition: "money >= 15", cost: { money: 15 }, outcomes: [
        { weight: 100, result: "good", msg: "交易成功！获得治疗药水 x3！", effect: { item: "potion", count: 3 } },
      ]},
      { text: "购买护盾 x2（20 金钱）", condition: "money >= 20", cost: { money: 20 }, outcomes: [
        { weight: 100, result: "good", msg: "交易成功！获得护盾 x2！", effect: { item: "shield", count: 2 } },
      ]},
      { text: "购买攻防材料包（25 金钱，攻击+3防御+2）", condition: "money >= 25", cost: { money: 25 }, outcomes: [
        { weight: 100, result: "good", msg: "交易成功！获得精良材料！攻击力 +3，防御力 +2！", effect: { attack: 3, defense: 2 } },
      ]},
      { text: "购买复活卷轴 x1（30 金钱）", condition: "money >= 30", cost: { money: 30 }, outcomes: [
        { weight: 100, result: "good", msg: "交易成功！获得复活卷轴 x1！", effect: { item: "reviveScroll", count: 1 } },
      ]},
      { text: "免费鉴定（随机增益或减益）", outcomes: [
        { weight: 50, result: "good", msg: "商人看中你的潜力！攻击力 +3！", effect: { attack: 3 } },
        { weight: 50, result: "bad",  msg: "商人暗算了你！HP -10！", effect: { selfDamage: 10 } },
      ]},
      { text: "不理会", outcomes: [
        { weight: 100, result: "neutral", msg: "你警惕地走开了。" },
      ]},
    ],
  },
  {
    id: "trapPit",
    name: "暗道陷阱",
    icon: "🕳",
    desc: "前方的地面突然塌陷，露出一个深不见底的陷阱！",
    choices: [
      { text: "跳过去", outcomes: [
        { weight: 60, result: "good", msg: "你灵巧地跳了过去！在对面发现了金币，获得 15 金钱。", effect: { money: 15 } },
        { weight: 40, result: "bad",  msg: "没跳过去！摔了进去，受到 12 点伤害！", effect: { selfDamage: 12 } },
      ]},
      { text: "绕路（跳过本回合行动）", outcomes: [
        { weight: 100, result: "neutral", msg: "你小心翼翼地绕了过去，浪费了一些时间。" },
      ]},
      { text: "丢石头试探", outcomes: [
        { weight: 70, result: "good", msg: "石头落了进去，确认了安全路径。获得 10 金钱。", effect: { money: 10 } },
        { weight: 30, result: "neutral", msg: "石头掉进去什么也听不到……你决定绕路。" },
      ]},
    ],
  },
  {
    id: "ancientBook",
    name: "古卷残页",
    icon: "📜",
    desc: "地上散落着一本残破的古籍，似乎记载着某种秘密。",
    choices: [
      { text: "仔细研读", outcomes: [
        { weight: 40, result: "good", msg: "你领悟了战斗技巧！攻击力 +4！", effect: { attack: 4 } },
        { weight: 30, result: "good", msg: "书页中夹着水晶碎片！获得 3 水晶！", effect: { crystal: 3 } },
        { weight: 30, result: "bad",  msg: "古卷上附着的诅咒发动！HP -15！", effect: { selfDamage: 15 } },
      ]},
      { text: "收藏起来", outcomes: [
        { weight: 100, result: "good", msg: "古卷可以卖出好价钱。获得 20 金钱。", effect: { money: 20 } },
      ]},
      { text: "不予理会", outcomes: [
        { weight: 100, result: "neutral", msg: "你继续前进。" },
      ]},
    ],
  },
  {
    id: "fairySpring",
    name: "妖精泉",
    icon: "🧝",
    desc: "清澈的泉水旁，一个小妖精正在嬉戏。",
    choices: [
      { text: "饮用泉水（消耗 5 金钱）", condition: "money >= 5", cost: { money: 5 }, outcomes: [
        { weight: 60, result: "good", msg: "泉水甘甜！最大 HP +15，HP 全满！", effect: { maxHpBonus: 15, fullHeal: true } },
        { weight: 40, result: "good", msg: "泉水让你充满力量！攻击力 +5！", effect: { attack: 5 } },
      ]},
      { text: "和妖精聊天", outcomes: [
        { weight: 50, result: "good", msg: "妖精很开心，给了你护盾 x1！", effect: { item: "shield", count: 1 } },
        { weight: 50, result: "neutral", msg: "妖精害羞地躲了起来。" },
      ]},
      { text: "离开", outcomes: [
        { weight: 100, result: "neutral", msg: "你礼貌地离开了。" },
      ]},
    ],
  },
  {
    id: "skillBookMerchant",
    name: "流浪术士",
    icon: "🧙‍♂️",
    desc: "一个神秘的术士在路边摆摊，上面摆满了泛着微光的技能书。",
    choices: [
      { text: "花 20 金钱购买一本（随机技能书）", condition: "money >= 20", cost: { money: 20 }, outcomes: [
        { weight: 100, result: "good", msg: "你获得了一本技能书！", effect: { skillBook: true } },
      ]},
      { text: "花 15 金钱购买猛力药水 x2", condition: "money >= 15", cost: { money: 15 }, outcomes: [
        { weight: 100, result: "good", msg: "交易成功！获得猛力药水 x2！", effect: { item: "atkPotion", count: 2 } },
      ]},
      { text: "花 15 金钱购买鹰眼药水 x2", condition: "money >= 15", cost: { money: 15 }, outcomes: [
        { weight: 100, result: "good", msg: "交易成功！获得鹰眼药水 x2！", effect: { item: "critPotion", count: 2 } },
      ]},
      { text: "免费试读（攻击 +2 或 HP -8）", outcomes: [
        { weight: 50, result: "good", msg: "书中的知识让你受益！攻击力 +2！", effect: { attack: 2 } },
        { weight: 50, result: "bad",  msg: "书页上的咒语反噬！HP -8！", effect: { selfDamage: 8 } },
      ]},
      { text: "不理会", outcomes: [
        { weight: 100, result: "neutral", msg: "你匆匆走过。" },
      ]},
    ],
  },
  {
    id: "abandonedCamp",
    name: "废弃营地",
    icon: "⛺️",
    desc: "你发现了一个废弃的冒险者营地，物资散落一地。",
    choices: [
      { text: "搜索物资", outcomes: [
        { weight: 40, result: "good", msg: "找到了治疗药水 x2 和护盾 x1！", effect: { item: "potion", count: 2 }, extraItem: { id: "shield", count: 1 } },
        { weight: 30, result: "good", msg: "找到了一把好武器！攻击力 +4！", effect: { attack: 4 } },
        { weight: 20, result: "neutral", msg: "除了一些碎布，什么都没找到。" },
        { weight: 10, result: "bad",  msg: "营地里埋着陷阱！受到 10 点伤害！", effect: { selfDamage: 10 } },
      ]},
      { text: "休息片刻", outcomes: [
        { weight: 70, result: "good", msg: "短暂休息让你恢复了精力！恢复 15 HP！", effect: { heal: 15 } },
        { weight: 30, result: "neutral", msg: "太紧张了，没能休息好。" },
      ]},
      { text: "赶紧离开", outcomes: [
        { weight: 100, result: "neutral", msg: "你谨慎地离开了废弃营地。" },
      ]},
    ],
  },
  {
    id: "GoblinTrainingCamp",
    name: "哥布林训练营",
    icon: "🧌",
    desc: "你突然发现一张破烂的传单，按照上面的地址寻找后，竟然发现了一处由哥布林经营的……训练营。哥布林老板看向你，眼里闪烁着感动的泪水：“你是我的第一名顾客！",
    choices: [
      { text: "花钱报名：提高攻击力（10金钱）", condition: "money >= 10", cost: { money: 10 }, outcomes: [
        { weight: 100, result: "good", msg: "老板尽职尽责地教给了你战斗的技巧。金钱-10，攻击力 +3！", effect: { attack: 3 }, setFlag: "goblinTrained" },
      ]},
      { text: "花钱报名：提高防御力（10金钱）", condition: "money >= 10", cost: { money: 10 }, outcomes: [
        { weight: 100, result: "good", msg: "老板尽职尽责地教给你战斗时保护自己的方法。金钱-10，防御力 +2！", effect: { defense: 2 }, setFlag: "goblinTrained" },
      ]},
      { text: "资助老板扩大规模（20金钱）", condition: "money >= 20", cost: { money: 20 }, outcomes: [
        { weight: 100, result: "good", msg: "老板的眼泪喷涌而出，它握着你的手管你叫恩人，并告诉你一定滴水之恩涌泉相报。到底是哪儿学来的话术？金钱-20\n（注：哥布林势力已将你们标记为盟友，路上遇到哥布林小怪时不会发生战斗）", effect: { skipGoblinElite: true }, setFlag: "goblinPatron" },
      ]},
      { text: "置之不理", outcomes: [
        { weight: 100, result: "neutral", msg: "你丢掉了传单继续前进，即便哥布林老板就在你身后挽留你。" },
      ]},
    ],
  },
  {
    id: "GoblinReturn",
    name: "哥布林老板的回报",
    icon: "🧌",
    desc: "一个矮小的身影追上你们——居然是那个哥布林老板！它气喘吁吁地递上一个沉甸甸的袋子：“恩人！这是我的全部家当！",
    choices: [
      { text: "收下谢礼", conditionFlag: "goblinPatron", outcomes: [
        { weight: 100, result: "good", msg: "哥布林老板把所有积蓄都给了你：50 金钱、攻击力 +5、防御力 +3！它含泪告别：“我会把训练营做大做强的！", effect: { money: 50, attack: 5, defense: 3 }, setFlag: "goblinRepaid" },
      ]},
      { text: "继续培训（10金钱）", condition: "money >= 10", conditionFlag: "goblinTrained", cost: { money: 10 }, outcomes: [
        { weight: 60, result: "good", msg: "老板的高级课程！攻击力 +5，防御力 +2！", effect: { attack: 5, defense: 2 }, setFlag: "goblinMastered" },
        { weight: 40, result: "good", msg: "老板的特训很辛苦，但你成长了！最大HP +20，攻击力 +3！", effect: { maxHpBonus: 20, attack: 3 }, setFlag: "goblinMastered" },
      ]},
      { text: "告诉它回去了", outcomes: [
        { weight: 100, result: "neutral", msg: "哥布林老板遗憾地转身离去，走了两步又回头看了你一眼……" },
      ]},
    ],
  },
  {
    id: "fortuneTeller",
    name: "命运占卜",
    icon: "🔮",
    desc: "一位蒙眼的占卜师坐在水晶球后，低声说道：“你的命运……已被窥见。”",
    choices: [
      { text: "支付 15 金钱占卜（获得一个随机增益）", condition: "money >= 15", cost: { money: 15 }, outcomes: [
        { type: "buff", weight: 40, effect: { attack: 3, defense: 2 }, msg: "🔮 水晶球闪烁光芒——你的攻击 +3，防御 +2！" },
        { type: "buff", weight: 30, effect: { maxHpBonus: 10 }, msg: "🔮 生命之光照耀——最大 HP +10！" },
        { type: "heal", weight: 30, effect: { healPct: 0.3, healPctAll: true }, msg: "🔮 星辰之力涌入——全体恢复 30% HP！" },
      ]},
      { text: "拒绝占卜，自行离开", cost: {}, outcomes: [
        { type: "none", weight: 100, effect: {}, msg: "你礼貌地离开了占卜摊位。" },
      ]},
    ],
  },
  {
    id: "treasureGoblin",
    name: "哥布林劫匪",
    icon: "👺",
    desc: "一只绿皮哥布林挡住了去路，手里攥着闪闪发光的钱袋！",
    choices: [
      { text: "与哥布林战斗（力量检定 ≥ 8）", checkRequired: true, check: { stat: "attack", threshold: 8, passDesc: "攻击力 ≥ 8", failDesc: "攻击力 < 8" }, outcomes: [
        { pass: { result: "good", msg: "👾 你击败了哥布林！获得 30 金钱和 +2 攻击力！", effect: { money: 30, attack: 2 } } },
        { fail: { result: "bad", msg: "👾 哥布林太灵活了！你被抢走了 15 金钱！", effect: { money: -15 } } },
      ]},
      { text: "花 10 金钱贿赂它", condition: "money >= 10", cost: { money: 10 }, outcomes: [
        { type: "pass", weight: 100, effect: { item: "critPotion", count: 1 }, msg: "👺 哥布林咧嘴笑了，丢给你一瓶鹰眼药水。" },
      ]},
    ],
  },
  {
    id: "ancientGolem",
    name: "远古石像",
    icon: "🗿",
    desc: "一尊巨大的石像矗立在路旁，表面刻满了古老的符文。符文似乎在微微发光……",
    choices: [
      { text: "触摸石像符文（智力检定）", checkRequired: true, check: {
        stat: "attack",
        tiered: true,
        tiers: [
          { min: 14, key: "strong", label: "攻击力 ≥ 14：完全破解符文" },
          { min: 8, max: 13, key: "average", label: "8 ≤ 攻击力 < 14：部分解读" },
          { max: 7, key: "weak", label: "攻击力 < 8：符文反噬" },
        ],
      }, outcomes: [
        { strong: { result: "good", msg: "🗿 符文能量涌入你的身体！防御 +3，最大 HP +5！", effect: { defense: 3, maxHpBonus: 5 } } },
        { average: { result: "good", msg: "🗿 你勉强解读了部分符文……恢复 25% HP，获得 20 金钱。", effect: { healPct: 0.25, money: 20 } } },
        { weak: { result: "bad", msg: "🗿 石像突然震动！巨大的冲击波把你击退！下一轮跳过。", effect: { skipNext: true } } },
      ]},
      { text: "绕过石像继续前进", cost: {}, outcomes: [
        { type: "none", weight: 100, effect: {}, msg: "你小心翼翼地绕过了石像。" },
      ]},
    ],
  },
  {
    id: "cursedFountain",
    name: "诅咒之泉",
    icon: "⛲️",
    desc: "一潭泛着紫光的泉水，水面上漂浮着奇怪的泡泡。传说喝下泉水会获得力量，也可能遭受诅咒……",
    choices: [
      { text: "喝下泉水（50/50 概率）", cost: {}, outcomes: [
        { type: "custom", weight: 50, effect: { attack: 4, defense: 2, maxHpBonus: 8 }, msg: "⛲️ 泉水的力量涌入全身！攻击 +4，防御 +2，最大 HP +8！" },
        { type: "custom", weight: 50, effect: { attack: -2, money: -10 }, msg: "⛲️ 诅咒之力侵蚀了你！攻击 -2，失去 10 金钱……" },
      ]},
      { text: "用瓶子装一瓶泉水带走（20 金钱）", condition: "money >= 20", cost: { money: 20 }, outcomes: [
        { type: "buff", weight: 100, effect: { item: "bigPotion", count: 2 }, msg: "⛲️ 你花 20 金钱装了一瓶泉水，变成了大治疗药水 x2！" },
      ]},
    ],
  },
  {
    id: "wanderingBard",
    name: "流浪吟游诗人",
    icon: "🎵",
    desc: "一位吟游诗人弹着竖琴走过，旋律令人心旷神怡。“来，朋友，听我唱一曲？”",
    choices: [
      { text: "驻足聆听（魅力检定）", checkRequired: true, check: {
        stat: "defense",
        tiered: true,
        tiers: [
          { min: 8, key: "strong", label: "防御力 ≥ 8：完全沉浸" },
          { min: 4, max: 7, key: "average", label: "4 ≤ 防御力 < 8：有些走神" },
          { max: 3, key: "weak", label: "防御力 < 4：无法专注" },
        ],
      }, outcomes: [
        { strong: { result: "good", msg: "🎵 悠扬的旋律治愈了心灵！最大 HP +5，全体恢复 20% HP！", effect: { maxHpBonus: 5, healPct: 0.2, healPctAll: true } } },
        { average: { result: "good", msg: "🎵 旋律还不错……攻击 +2。", effect: { attack: 2 } } },
        { weak: { result: "bad", msg: "🎵 诗人弹了一个不和谐的音，你头晕目眩！下一轮跳过。", effect: { skipNext: true } } },
      ]},
      { text: "花 10 金钱请他演奏一曲", condition: "money >= 10", cost: { money: 10 }, outcomes: [
        { type: "buff", weight: 100, effect: { attack: 2, defense: 2 }, msg: "🎵 诗人欣然演奏，你的斗志昂扬！攻击 +2，防御 +2！" },
      ]},
    ],
  },
  {
    id: "demonDeal",
    name: "与恶魔做个交易？",
    icon: "👿",
    desc: "走到一半时，你的眼前突然出现一片黑暗。在你做出反应之前，耳边却先传来了恶魔的狞笑声。“想不想和我做个交易，冒险者大人？”祂诱惑性地开口。",
    choices: [
      { text: "那就拿走我的灵魂吧！", outcomes: [
        { weight: 100, result: "good", msg: "“做得好，”祂笑得更大声了，“这个交给你！”扣除15生命上限，获得技能书【吸血】（使用后三次行动内获得吸血50%）", effect: { maxHpLoss: 15, grantSkill: "bookVampiric" } },
      ]},
      { text: "要索就索我队友的！", outcomes: [
        { weight: 100, result: "good", msg: "恶魔愣了一下，随即爆发出刺耳的笑声。“干得漂亮！这恶魔真该你来当。”随机扣除一名队友15生命上限，获得技能书【吸血】", effect: { allyMaxHpLoss: 15, grantSkill: "bookVampiric" } },
      ]},
      { text: "保持沉默", outcomes: [
        { weight: 100, result: "neutral", msg: "恶魔自讨没趣离开了，你的视野恢复了正常。" },
      ]},
    ],
  },
  {
    id: "enchantedLibrary",
    name: "魔法图书馆",
    icon: "📚",
    desc: "一间藏有无数古籍的图书馆，书架直抵穹顶。空气中弥漫着旧纸张和魔法的味道。",
    choices: [
      { text: "翻阅战斗书籍", outcomes: [
        { weight: 45, result: "good", msg: "你找到一本战斗指南！攻击力 +4！", effect: { attack: 4 } },
        { weight: 30, result: "good", msg: "书中夹着一张技能书页！获得随机技能书！", effect: { skillBook: true } },
        { weight: 25, result: "neutral", msg: "内容太过晦涩，你什么也没看懂……" },
      ]},
      { text: "翻阅防御书籍", checkRequired: true, check: { stat: "defense", threshold: 4, passDesc: "防御力 ≥ 4", failDesc: "防御力 < 4" }, outcomes: [
        { pass: { result: "good", msg: "你领悟了防御精髓！防御力 +4，最大HP +8！", effect: { defense: 4, maxHpBonus: 8 } } },
        { fail: { result: "bad", msg: "书中的知识太过深奥，你的大脑过载了！受到 8 点伤害。", effect: { selfDamage: 8 } } },
      ]},
      { text: "偷走一本稀有古籍（需 15 金钱）", condition: "money >= 15", cost: { money: 15 }, outcomes: [
        { weight: 60, result: "good", msg: "成功偷走！古籍蕴含强大魔力，攻击力 +5，防御力 +2！", effect: { attack: 5, defense: 2 } },
        { weight: 40, result: "bad", msg: "书架上的魔法陷阱触发了！受到 12 点伤害，但书还是到手了。攻击力 +3。", effect: { selfDamage: 12, attack: 3 } },
      ]},
    ],
  },
  {
    id: "blacksmithForge",
    name: "矮人铁匠铺",
    icon: "🔨",
    desc: "路旁传来叮叮当当的打铁声。一位矮人铁匠正在炉火前挥锤，看到你后咧嘴一笑：“冒险者！要不要升级一下你的装备？”",
    choices: [
      { text: "升级武器（20 金钱，攻击力 +5）", condition: "money >= 20", cost: { money: 20 }, outcomes: [
        { weight: 100, result: "good", msg: "矮人铁匠手艺精湛！武器焕然一新，攻击力 +5！", effect: { attack: 5 } },
      ]},
      { text: "升级护甲（20 金钱，防御力 +3，最大HP +10）", condition: "money >= 20", cost: { money: 20 }, outcomes: [
        { weight: 100, result: "good", msg: "护甲被加固了！防御力 +3，最大HP +10！", effect: { defense: 3, maxHpBonus: 10 } },
      ]},
      { text: "打造全套装备（40 金钱，攻防各 +3，最大HP +10）", condition: "money >= 40", cost: { money: 40 }, outcomes: [
        { weight: 100, result: "good", msg: "矮人铁匠拿出了看家本领！全套装备完成！攻击力 +3，防御力 +3，最大HP +10！", effect: { attack: 3, defense: 3, maxHpBonus: 10 } },
      ]},
      { text: "帮忙打铁（获得随机收益）", outcomes: [
        { weight: 40, result: "good", msg: "铁匠很满意你的帮忙！获得 20 金钱和猛力药水 x1！", effect: { money: 20, item: "atkPotion", count: 1 } },
        { weight: 35, result: "good", msg: "打铁让你肌肉更强健了！攻击力 +3！", effect: { attack: 3 } },
        { weight: 25, result: "bad", msg: "锤子砸到了手指……受到 6 点伤害。", effect: { selfDamage: 6 } },
      ]},
    ],
  },
  {
    id: "magicTeleporter",
    name: "魔法传送阵",
    icon: "🌀",
    desc: "地面上刻着一个复杂的魔法阵，符文闪烁着蓝光。它似乎能将你传送到某个未知的地方……",
    choices: [
      { text: "站上去传送", outcomes: [
        { weight: 30, result: "good", msg: "传送成功！你到达了一个藏宝点，获得 30 金钱和 3 水晶！", effect: { money: 30, crystal: 3 } },
        { weight: 25, result: "good", msg: "传送到了一处温泉！恢复全部HP，最大HP +8！", effect: { fullHeal: true, maxHpBonus: 8 } },
        { weight: 25, result: "neutral", msg: "传送阵只是闪了一下，什么也没发生……" },
        { weight: 20, result: "bad", msg: "传送出错！你被甩了出来，受到 15 点伤害！", effect: { selfDamage: 15 } },
      ]},
      { text: "研究符文（智力检定）", checkRequired: true, check: { stat: "attack", threshold: 14, passDesc: "攻击力 ≥ 14（魔力学识）", failDesc: "攻击力 < 14" }, outcomes: [
        { pass: { result: "good", msg: "你破解了传送阵的秘密！提取了水晶能量，获得 5 水晶和 15 金钱！", effect: { crystal: 5, money: 15 } } },
        { fail: { result: "neutral", msg: "符文太过复杂，你没能破解。传送阵的光芒逐渐消散了。" } },
      ]},
      { text: "离开", outcomes: [
        { weight: 100, result: "neutral", msg: "你决定不冒险，绕开了传送阵。" },
      ]},
    ],
  },
  {
    id: "hauntedGraveyard",
    name: "闹鬼墓地",
    icon: "⚰️",
    desc: "一片弥漫着白雾的墓地，墓碑歪歪斜斜地排列着。偶尔能看到幽灵在墓碑间飘过……",
    choices: [
      { text: "探索墓地", outcomes: [
        { weight: 30, result: "good", msg: "你在一个坟墓里找到了遗物！获得 25 金钱和护盾 x1！", effect: { money: 25, item: "shield", count: 1 } },
        { weight: 25, result: "good", msg: "幽灵向你致意并赠予祝福！攻击力 +3，防御力 +2！", effect: { attack: 3, defense: 2 } },
        { weight: 25, result: "bad", msg: "一个幽灵穿过了你的身体！受到 12 点伤害，防御力 -1。", effect: { selfDamage: 12, defense: -1 } },
        { weight: 20, result: "bad", msg: "墓地里突然涌出大量骷髅！你勉强逃出，受到 15 点伤害！", effect: { selfDamage: 15 } },
      ]},
      { text: "在墓碑前祈祷", outcomes: [
        { weight: 50, result: "good", msg: "亡灵安息了。你感到一阵温暖，最大HP +10，HP 恢复 20！", effect: { maxHpBonus: 10, heal: 20 } },
        { weight: 50, result: "neutral", msg: "祈祷后什么也没发生，但你觉得内心平静了一些。" },
      ]},
      { text: "赶紧离开", outcomes: [
        { weight: 100, result: "neutral", msg: "你加快脚步离开了墓地。" },
      ]},
    ],
  },
  {
    id: "alchemistLab",
    name: "炼金工坊",
    icon: "⚗️",
    desc: "一间充满奇怪气味的工坊，桌上摆满了瓶瓶罐罐。一位戴着防毒面具的炼金术士正在调配药剂。",
    choices: [
      { text: "购买随机药剂（12 金钱）", condition: "money >= 12", cost: { money: 12 }, outcomes: [
        { weight: 35, result: "good", msg: "你获得了猛力药水 x2！", effect: { item: "atkPotion", count: 2 } },
        { weight: 30, result: "good", msg: "你获得了鹰眼药水 x2！", effect: { item: "critPotion", count: 2 } },
        { weight: 20, result: "good", msg: "你获得了剧毒药水 x1！", effect: { item: "dotPotion", count: 1 } },
        { weight: 15, result: "good", msg: "炼金术士心情好，额外送了你大治疗药水 x1！", effect: { item: "bigPotion", count: 1 } },
      ]},
      { text: "请炼金术士强化装备（25 金钱）", condition: "money >= 25", cost: { money: 25 }, outcomes: [
        { weight: 60, result: "good", msg: "装备被附魔了！攻击力 +4，防御力 +2！", effect: { attack: 4, defense: 2 } },
        { weight: 40, result: "good", msg: "药剂渗透进你的身体！最大HP +12，攻击力 +2！", effect: { maxHpBonus: 12, attack: 2 } },
      ]},
      { text: "自愿试药（风险与收益并存）", outcomes: [
        { weight: 40, result: "good", msg: "药效惊人！全属性提升！攻击 +3，防御 +2，最大HP +8！", effect: { attack: 3, defense: 2, maxHpBonus: 8 } },
        { weight: 35, result: "bad", msg: "副作用发作！HP -15，攻击力 -1。", effect: { selfDamage: 15, attack: -1 } },
        { weight: 25, result: "good", msg: "药剂让你获得了水晶能量！获得 4 水晶！", effect: { crystal: 4 } },
      ]},
    ],
  },
  {
    id: "crystalMine",
    name: "水晶矿脉",
    icon: "⛏️",
    desc: "岩壁上嵌满了闪闪发光的水晶。看起来可以开采，但水晶周围有魔法护层保护。",
    choices: [
      { text: "开采水晶（攻击力检定）", checkRequired: true, check: { stat: "attack", threshold: 10, passDesc: "攻击力 ≥ 10", failDesc: "攻击力 < 10" }, outcomes: [
        { pass: { result: "good", msg: "你击碎了护层！获得 5 水晶和 10 金钱！", effect: { crystal: 5, money: 10 } } },
        { fail: { result: "bad", msg: "护层反弹了你的攻击！受到 8 点伤害。", effect: { selfDamage: 8 } } },
      ]},
      { text: "小心翼翼地采集", outcomes: [
        { weight: 50, result: "good", msg: "成功采集到 3 水晶！", effect: { crystal: 3 } },
        { weight: 30, result: "good", msg: "采到了一块大水晶！获得 5 水晶！", effect: { crystal: 5 } },
        { weight: 20, result: "neutral", msg: "水晶太硬了，你只采到了一些碎屑。获得 1 水晶。", effect: { crystal: 1 } },
      ]},
      { text: "吞下水晶碎片", outcomes: [
        { weight: 40, result: "good", msg: "水晶能量融入你的身体！攻击力 +4，防御力 +1！", effect: { attack: 4, defense: 1 } },
        { weight: 35, result: "good", msg: "水晶碎片在体内释放能量！最大HP +12！", effect: { maxHpBonus: 12 } },
        { weight: 25, result: "bad", msg: "碎片割伤了内脏！受到 14 点伤害！", effect: { selfDamage: 14 } },
      ]},
    ],
  },
  {
    id: "mirrorOfTruth",
    name: "真实之镜",
    icon: "🪞",
    desc: "一面巨大的镜子矗立在通道中央。镜面上没有你的倒影，只有一片迷雾。镜子下方刻着：直面真实者，将获得力量。",
    choices: [
      { text: "直视镜子", outcomes: [
        { weight: 35, result: "good", msg: "镜子中显现出你最强的一面！攻击力 +5，防御力 +2！", effect: { attack: 5, defense: 2 } },
        { weight: 25, result: "good", msg: "镜子映出了你潜在的生命力！最大HP +15，HP 全满！", effect: { maxHpBonus: 15, fullHeal: true } },
        { weight: 20, result: "bad", msg: "镜子映出了你内心深处的恐惧！受到 15 点伤害，攻击力 -2。", effect: { selfDamage: 15, attack: -2 } },
        { weight: 20, result: "neutral", msg: "镜面一片空白。你什么也没看到……" },
      ]},
      { text: "打破镜子", outcomes: [
        { weight: 40, result: "good", msg: "碎片中迸发出能量！获得 25 金钱和 3 水晶！", effect: { money: 25, crystal: 3 } },
        { weight: 35, result: "bad", msg: "七年的厄运降临！受到 18 点伤害！", effect: { selfDamage: 18 } },
        { weight: 25, result: "good", msg: "碎片中藏着一本技能书！", effect: { skillBook: true } },
      ]},
      { text: "绕行", outcomes: [
        { weight: 100, result: "neutral", msg: "你不愿直面真实，绕开了镜子。" },
      ]},
    ],
  },
  {
    id: "merchantCaravan",
    name: "商队驻地",
    icon: "🐪",
    desc: "一支小型商队在路边扎营休息。领队看到你们后热情地招手：“冒险者大人！我们刚从远方运来一批特价商品！”",
    choices: [
      { text: "购买武器箱（18 金钱，随机攻防提升）", condition: "money >= 18", cost: { money: 18 }, outcomes: [
        { weight: 50, result: "good", msg: "箱子里是把好剑！攻击力 +5！", effect: { attack: 5 } },
        { weight: 30, result: "good", msg: "箱子里是护甲！防御力 +3，最大HP +5！", effect: { defense: 3, maxHpBonus: 5 } },
        { weight: 20, result: "good", msg: "箱子里是双剑！攻击力 +3，防御力 +2！", effect: { attack: 3, defense: 2 } },
      ]},
      { text: "购买神秘盲盒（10 金钱）", condition: "money >= 10", cost: { money: 10 }, outcomes: [
        { weight: 30, result: "good", msg: "盲盒里是技能书！", effect: { skillBook: true } },
        { weight: 25, result: "good", msg: "盲盒里是 3 瓶治疗药水！", effect: { item: "potion", count: 3 } },
        { weight: 20, result: "good", msg: "盲盒里是复活卷轴！", effect: { item: "reviveScroll", count: 1 } },
        { weight: 15, result: "good", msg: "盲盒里是 5 水晶！", effect: { crystal: 5 } },
        { weight: 10, result: "bad", msg: "盲盒里是……一块石头。你被坑了。" },
      ]},
      { text: "购买保险（8 金钱，获得护盾x2）", condition: "money >= 8", cost: { money: 8 }, outcomes: [
        { weight: 100, result: "good", msg: "交易成功！获得护盾 x2！", effect: { item: "shield", count: 2 } },
      ]},
      { text: "和领队聊天后离开", outcomes: [
        { weight: 50, result: "good", msg: "领队给了你一些旅途建议，防御力 +1。", effect: { defense: 1 } },
        { weight: 50, result: "neutral", msg: "闲聊了一会儿后你继续上路。" },
      ]},
    ],
  },
  {
    id: "dragonStatue",
    name: "龙之祭坛",
    icon: "🐉",
    desc: "一尊古老的龙形石像矗立在祭坛上。石龙的眼中嵌着两颗发光的宝石，似乎蕴含着远古龙族的力量。",
    choices: [
      { text: "献上 20 金钱祈祷龙之祝福", condition: "money >= 20", cost: { money: 20 }, outcomes: [
        { weight: 40, result: "good", msg: "龙之力量降临！攻击力 +6！", effect: { attack: 6 } },
        { weight: 30, result: "good", msg: "龙之庇护笼罩！防御力 +4，最大HP +10！", effect: { defense: 4, maxHpBonus: 10 } },
        { weight: 30, result: "good", msg: "龙之智慧启发！获得随机技能书！", effect: { skillBook: true } },
      ]},
      { text: "抠下龙眼宝石", outcomes: [
        { weight: 30, result: "good", msg: "成功取下宝石！获得 40 金钱和 5 水晶！", effect: { money: 40, crystal: 5 } },
        { weight: 35, result: "bad", msg: "龙像喷出火焰！受到 18 点伤害！", effect: { selfDamage: 18 } },
        { weight: 35, result: "bad", msg: "龙像活了过来！一阵龙威将你震退，受到 15 点伤害，攻击力 -2。", effect: { selfDamage: 15, attack: -2 } },
      ]},
      { text: "触摸龙像获取力量（HP检定）", checkRequired: true, check: { stat: "hpPercent", threshold: 60, passDesc: "HP ≥ 60%：生命力旺盛", failDesc: "HP < 60%：状态不佳" }, outcomes: [
        { pass: { result: "good", msg: "龙像认可你的生命力！攻击力 +4，防御力 +3，最大HP +8！", effect: { attack: 4, defense: 3, maxHpBonus: 8 } } },
        { fail: { result: "bad", msg: "龙像吸走了你的生命力！HP -12，最大HP -5。", effect: { selfDamage: 12, maxHpBonus: -5 } } },
      ]},
    ],
  },
  {
    id: "timeRift",
    name: "时间裂缝",
    icon: "⏳",
    desc: "空间中出现了一道扭曲的裂缝，从中可以看到过去与未来的模糊影像。裂缝边缘散发着时空之力……",
    choices: [
      { text: "回溯过去（恢复状态）", outcomes: [
        { weight: 50, result: "good", msg: "时间回溯！HP 恢复至满，最大HP +5！", effect: { fullHeal: true, maxHpBonus: 5 } },
        { weight: 30, result: "good", msg: "你从过去的战斗中汲取了经验！攻击力 +4，防御力 +2！", effect: { attack: 4, defense: 2 } },
        { weight: 20, result: "neutral", msg: "过去的影像模糊不清，你什么也没获得。" },
      ]},
      { text: "窥探未来（获取信息）", outcomes: [
        { weight: 40, result: "good", msg: "你看到了未来的宝藏位置！获得 30 金钱和 3 水晶！", effect: { money: 30, crystal: 3 } },
        { weight: 30, result: "good", msg: "未来的你传授了一招！获得随机技能书！", effect: { skillBook: true } },
        { weight: 30, result: "bad", msg: "看到了不祥的未来……精神受到冲击，受到 10 点伤害。", effect: { selfDamage: 10 } },
      ]},
      { text: "吸收时空之力", outcomes: [
        { weight: 35, result: "good", msg: "时空之力融入身体！全属性提升：攻击 +3，防御 +2，最大HP +8！", effect: { attack: 3, defense: 2, maxHpBonus: 8 } },
        { weight: 35, result: "good", msg: "时空碎片凝结成水晶！获得 6 水晶！", effect: { crystal: 6 } },
        { weight: 30, result: "bad", msg: "时空紊乱！你被时间碎片割伤，受到 16 点伤害！", effect: { selfDamage: 16 } },
      ]},
    ],
  },
  {
    id: "slimePit",
    name: "史莱姆坑",
    icon: "🟢",
    desc: "一个充满各色史莱姆的大坑。它们蹦蹦跳跳，看起来人畜无害，但散发着奇怪的魔力。",
    choices: [
      { text: "跳进坑里抓史莱姆", outcomes: [
        { weight: 35, result: "good", msg: "你抓到了一只金史莱姆！获得 25 金钱和 3 水晶！", effect: { money: 25, crystal: 3 } },
        { weight: 25, result: "good", msg: "史莱姆的核心能量强化了你！攻击力 +3，防御力 +2！", effect: { attack: 3, defense: 2 } },
        { weight: 25, result: "bad", msg: "酸性史莱姆腐蚀了你的装备！防御力 -2。", effect: { defense: -2 } },
        { weight: 15, result: "bad", msg: "一群史莱姆把你淹没了！受到 12 点伤害！", effect: { selfDamage: 12 } },
      ]},
      { text: "用瓶子收集史莱姆", outcomes: [
        { weight: 50, result: "good", msg: "收集成功！史莱姆变成了大治疗药水 x2！", effect: { item: "bigPotion", count: 2 } },
        { weight: 30, result: "good", msg: "收集到了特殊史莱姆！获得剧毒药水 x1！", effect: { item: "dotPotion", count: 1 } },
        { weight: 20, result: "neutral", msg: "史莱姆都跑了，你只抓到了一手黏液……" },
      ]},
      { text: "绕过去", outcomes: [
        { weight: 100, result: "neutral", msg: "你不想弄脏鞋子，绕开了史莱姆坑。" },
      ]},
    ],
  },
  {
    id: "wishingWell",
    name: "许愿井",
    icon: "🪙",
    desc: "一口古老的石井，井水清澈见底。井底散落着无数硬币，据说向井中投币许愿可以获得祝福……",
    choices: [
      { text: "投入 10 金币许愿", condition: "money >= 10", cost: { money: 10 }, outcomes: [
        { weight: 30, result: "good", msg: "愿望成真！攻击力 +4！", effect: { attack: 4 } },
        { weight: 25, result: "good", msg: "井水涌出能量！最大HP +12，HP 恢复 20！", effect: { maxHpBonus: 12, heal: 20 } },
        { weight: 20, result: "good", msg: "井底浮上来一瓶药水！获得大治疗药水 x2！", effect: { item: "bigPotion", count: 2 } },
        { weight: 15, result: "good", msg: "井中闪过一道光！获得 3 水晶！", effect: { crystal: 3 } },
        { weight: 10, result: "neutral", msg: "你的硬币沉入井底，什么也没发生……" },
      ]},
      { text: "投入 30 金币许大愿", condition: "money >= 30", cost: { money: 30 }, outcomes: [
        { weight: 40, result: "good", msg: "大愿成真！获得随机技能书和 5 水晶！", effect: { skillBook: true, crystal: 5 } },
        { weight: 30, result: "good", msg: "井神显现！全属性提升：攻击 +3，防御 +3，最大HP +10！", effect: { attack: 3, defense: 3, maxHpBonus: 10 } },
        { weight: 30, result: "bad", msg: "贪婪惹怒了井神！受到 15 点伤害，失去 10 金钱。", effect: { selfDamage: 15, money: -10 } },
      ]},
      { text: "从井里捞钱", outcomes: [
        { weight: 30, result: "good", msg: "你捞到了 20 金钱！", effect: { money: 20 } },
        { weight: 30, result: "bad", msg: "井水冰凉刺骨！受到 8 点伤害。", effect: { selfDamage: 8 } },
        { weight: 40, result: "neutral", msg: "你什么也没捞到，还弄了一身湿。" },
      ]},
    ],
  },
];

// ================================================================
//  六、BOSS 定义
// ================================================================

const BOSS_STAGES = [
  {
    stage: 1,
    bossPool: [
      {
        name: "巨魔", icon: "👹",
        desc: "拥有巨大身躯，力大无穷的魔物。",
        baseHp: 330,
        baseAtk: 14,
        baseDef: 4,
        skills: [
          { name: "抓取投掷", desc: "随机抓起一位玩家并抛出，使该玩家跳过一回合", trigger: "turn", triggerVal: 3, bind: true },
          { name: "战吼", desc: "巨魔捶胸并发出狂啸，提升 50% 攻击力，持续 3 回合", trigger: "turn", triggerVal: 5 },
          { name: "巨魔血统", desc: "血量低于 20% 时，每回合恢复最大生命值的 25%，持续 2 回合", trigger: "hp", triggerVal: 0.2 },
        ],
      },
      {
        name: "奇美拉", icon: "🦁",
        desc: "拥有三个头的魔物，全身上下散发着怪异的气息。",
        baseHp: 270,
        baseAtk: 16,
        baseDef: 3,
        skills: [
          { name: "喷射火焰", desc: "从后方的蛇头喷出火焰，造成 12 点伤害并附加灼烧", damage: 12, trigger: "turn", triggerVal: 2, aoe: true, burn: true },
          { name: "诡异吼叫", desc: "羊头与狮头同时嘶吼，使下一次受到的伤害减半", trigger: "turn", triggerVal: 4 },
          { name: "合成兽", desc: "血量低于 50% 时，每回合免疫一次受到的攻击", trigger: "hp", triggerVal: 0.5 },
        ],
      },
      {
        name: "石巨人", icon: "🗿",
        desc: "由山石凝聚而成的巨型魔像，每一步都震颤大地。",
        baseHp: 260,
        baseAtk: 15,
        baseDef: 6,
        skills: [
          { name: "地震",     desc: "猛击地面，对所有玩家造成 14 点伤害",   damage: 14, trigger: "turn", triggerVal: 3, aoe: true },
          { name: "岩石护盾", desc: "生成护盾，接下来 3 次受伤减半",        trigger: "turn", triggerVal: 4 },
          { name: "愤怒爆发", desc: "血量低于 35% 时攻击力 +80%",           trigger: "hp",  triggerVal: 0.35 },
        ],
      },
      {
        name: "毒蛛女王", icon: "🕷",
        desc: "盘踞在洞穴深处的巨型蜘蛛，毒液腐蚀一切。",
        baseHp: 230,
        baseAtk: 17,
        baseDef: 2,
        skills: [
          { name: "毒液喷射", desc: "对所有玩家造成 10 点伤害并附加中毒", damage: 10, trigger: "turn", triggerVal: 2, aoe: true, poison: true },
          { name: "蛛网束缚", desc: "随机一名玩家跳过下一轮行动",          trigger: "turn", triggerVal: 3, bind: true },
          { name: "狂暴产卵", desc: "血量低于 40% 时攻击力 +60%",           trigger: "hp",  triggerVal: 0.4 },
        ],
      },
    ],
  },
  {
    stage: 2,
    bossPool: [
      {
        name: "血肉怨灵", icon: "👻",
        desc: "由无数血肉组成的奇怪液状人形魔物，似乎只是触碰就能将人的血肉分解并吸收。",
        baseHp: 800,
        baseAtk: 15,
        baseDef: 5,
        skills: [
          { name: "血肉沼泽", desc: "将血肉形成沼泽，对所有玩家造成 10 点伤害", damage: 10, trigger: "turn", triggerVal: 3, aoe: true },
          { name: "血肉蠕虫", desc: "召唤一只血肉蠕虫，随机选择一名玩家，每回合造成 8 点伤害，持续 3 回合", trigger: "turn", triggerVal: 4 },
          { name: "血肉汲取", desc: "血量低于 100% 时，每次攻击恢复造成伤害的生命值", trigger: "hp", triggerVal: 1.0 },
        ],
      },
      {
        name: "石像天使", icon: "👼",
        desc: "拥有一半白一半黑羽翼的天使，祂双手交叉捂住双眼，似乎已经被石化了数千年。",
        baseHp: 480,
        baseAtk: 20,
        baseDef: 8,
        skills: [
          { name: "黑白天使", desc: "对一名玩家造成 30 点伤害，并恢复另一名玩家造成伤害一半的血量", damage: 30, trigger: "turn", triggerVal: 2 },
          { name: "黑暗祝福", desc: "对随机一名玩家造成 20 点伤害，并使其跳过 2 回合", trigger: "turn", triggerVal: 4, damage: 20, bind: true },
          { name: "神圣诅咒", desc: "血量低于 30% 时，将恢复效果修改为造成伤害", trigger: "hp", triggerVal: 0.3 },
        ],
      },
      {
        name: "暗影法师", icon: "🧙",
        desc: "操控暗影的神秘施法者，擅长范围攻击和诅咒。",
        baseHp: 380,
        baseAtk: 22,
        baseDef: 4,
        skills: [
          { name: "暗影爆破", desc: "对随机目标造成 22 点伤害",           damage: 22, trigger: "turn", triggerVal: 2 },
          { name: "暗影之幕", desc: "降低所有玩家攻击力 3 点（可叠加）",    trigger: "turn", triggerVal: 3, aoe: true, atkReduce: 3 },
          { name: "死亡低语", desc: "血量低于 30% 时，每回合额外造成 8 点群体伤害", damage: 8, trigger: "hp", triggerVal: 0.3 },
        ],
      },
      {
        name: "冰霜巨人", icon: "🧊",
        desc: "来自极北冰原的巨人，所到之处万物冰封。",
        baseHp: 420,
        baseAtk: 21,
        baseDef: 7,
        skills: [
          { name: "暴风雪",   desc: "对所有玩家造成 15 点伤害并降低防御 2", damage: 15, trigger: "turn", triggerVal: 2, aoe: true, defReduce: 2 },
          { name: "冰甲",     desc: "获得 3 层护盾，受伤减半",              trigger: "turn", triggerVal: 4 },
          { name: "绝对零度", desc: "血量低于 25% 时，随机冻结一名玩家 2 轮", trigger: "hp", triggerVal: 0.25 },
        ],
      },
    ],
  },
  {
    stage: 3,
    bossPool: [
      {
        name: "黑暗帝王", icon: "👑",
        desc: "暗元素的人型凝聚体，操控一切暗元素能量的帝王，拥有让一切探索的力量。",
        baseHp: 550,
        baseAtk: 28,
        baseDef: 10,
        skills: [
          { name: "黑暗降临", desc: "对所有玩家造成 22 点伤害，并使随机一名玩家跳过回合", damage: 22, trigger: "turn", triggerVal: 3, aoe: true },
          { name: "暗影穿刺", desc: "随机选择两名玩家受到 30 点真实伤害，并跳过 2 回合", trigger: "turn", triggerVal: 5 },
          { name: "深渊凝视", desc: "血量低于 25% 时，每回合使随机一名玩家跳过回合", trigger: "hp", triggerVal: 0.25 },
        ],
      },
      {
        name: "剑圣残影", icon: "⚔️",
        desc: "传说中剑圣的残影，即便圣剑已经不在他的手中，残影的一举一动也散发着威严。",
        baseHp: 600,
        baseAtk: 30,
        baseDef: 8,
        skills: [
          { name: "神圣斩", desc: "施展能够直接消灭魔物的斩击，对随机目标造成 35 点伤害", damage: 35, trigger: "turn", triggerVal: 2 },
          { name: "弱点洞悉", desc: "3 回合中随机标记一名玩家，将该玩家的防御力削减为 0，并集中攻击", trigger: "turn", triggerVal: 4 },
          { name: "圣剑之力", desc: "血量低于 40% 时，攻击力提升 60% 并只会造成真实伤害", trigger: "hp", triggerVal: 0.4 },
        ],
      },
      {
        name: "远古巨龙", icon: "🐲",
        desc: "沉睡了千年的古龙，被远征队的脚步声惊醒。龙吟震裂山石。",
        baseHp: 600,
        baseAtk: 30,
        baseDef: 12,
        skills: [
          { name: "龙息",   desc: "喷吐烈焰，对所有玩家造成 20 点伤害",    damage: 20, trigger: "turn", triggerVal: 2, aoe: true },
          { name: "龙威",   desc: "威压全场，所有玩家跳过下一次行动",      trigger: "turn", triggerVal: 4 },
          { name: "狂暴",   desc: "血量低于 25% 时每回合攻击两次",         trigger: "hp",  triggerVal: 0.25 },
        ],
      },
      {
        name: "虚空领主", icon: "🌌",
        desc: "来自异次元的统治者，空间在其意志下扭曲。",
        baseHp: 650,
        baseAtk: 28,
        baseDef: 9,
        skills: [
          { name: "虚空裂隙", desc: "撕裂空间，对随机目标造成 25 点伤害",  damage: 25, trigger: "turn", triggerVal: 2 },
          { name: "维度置换", desc: "随机交换两名玩家的 HP（取平均）",      trigger: "turn", triggerVal: 3, swap: true },
          { name: "湮灭",     desc: "血量低于 20% 时每回合全体 12 点伤害",  damage: 12, trigger: "hp", triggerVal: 0.2 },
        ],
      },
    ],
  },

];

// ================================================================
//  七、辅助函数
// ================================================================

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandom(outcomes) {
  const totalWeight = outcomes.reduce(function(s, o) { return s + o.weight; }, 0);
  let r = Math.random() * totalWeight;
  for (const o of outcomes) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

function now() {
  return Date.now();
}

function getMoney(ctx) {
  return seal.vars.intGet(ctx, "$m金钱")[0] || 0;
}

function addMoney(ctx, val) {
  const cur = getMoney(ctx);
  seal.vars.intSet(ctx, "$m金钱", Math.max(0, cur + val));
}

function getCrystal(ctx) {
  return seal.vars.intGet(ctx, "$m水晶")[0] || 0;
}

function addCrystal(ctx, val) {
  const cur = getCrystal(ctx);
  seal.vars.intSet(ctx, "$m水晶", Math.max(0, cur + val));
}

function getTodayDay() {
  return Math.floor((Date.now() / 1000 + 28800) / 86400);
}

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getEffectiveAttack(player) {
  var base = player.attack + (player._warCryBonus || 0) + (player._atkPotionBuff ? 5 : 0);
  if (player._battleStacks > 0) base += player._battleStacks * 2;
  if (player._tauntAtkBuff > 0) base = Math.floor(base * (1 + player._tauntAtkBuff));
  if (player._atkBuff > 0) base = Math.floor(base * 1.2);
  return base;
}

function getDamageMultiplier(player) {
  if (player._dmgBoost > 0) return 1.3;
  return 1.0;
}

function getPlayerEffectiveAtk(player) {
  var base = getEffectiveAttack(player);
  if (player._atkBuff > 0) base = Math.floor(base * 1.2);
  return base;
}

// 给玩家分配随机技能书
function grantRandomSkillBook(player) {
  const owned = player._extraSkills || [];
  // 从未拥有的技能书中随机选一本
  const available = UNIVERSAL_SKILLBOOKS.filter(function(b) {
    return !owned.find(function(o) { return o.id === b.id; });
  });
  if (available.length === 0) return null;
  const book = available[Math.floor(Math.random() * available.length)];
  if (!player._extraSkills) player._extraSkills = [];
  player._extraSkills.push({
    id: book.id,
    name: book.name,
    icon: book.icon,
    maxCd: book.maxCd,
    desc: book.desc,
  });
  return book;
}

// ================================================================
//  八、游戏核心类
// ================================================================

class ExpeditionGame {
  constructor(roomId) {
    this.roomId = roomId;
    const raw = ext.storageGet("exped_" + this.roomId);
    const data = raw ? JSON.parse(raw) : null;

    if (data) {
      this.roomId = data.roomId;
      this.creatorId = data.creatorId;
      this.status = data.status;
      this.players = data.players || [];
      this.board = data.board || [];
      this.currentPlayerIdx = data.currentPlayerIdx || 0;
      this.prepRound = data.prepRound || 0;
      this.boss = data.boss || null;
      this.turnOrder = data.turnOrder || [];
      this.bossTurnCount = data.bossTurnCount || 0;
      this.playerActionsThisRound = data.playerActionsThisRound || 0;
      this.createdAt = data.createdAt || now();
      this.lastActionTime = data.lastActionTime || now();
      this.fightRound = data.fightRound || 0;
      this.phase = data.phase || "";
      this.bossSkillActive = data.bossSkillActive || {};
      this.log = data.log || [];
      this.bossStage = data.bossStage || 0;
      this.currentEvent = data.currentEvent || null;
      // 恢复custom函数（JSON序列化会丢失函数）
      if (this.currentEvent && ROGUE_EVENTS) {
        var freshEvent = ROGUE_EVENTS.find(function(e) { return e.id === this.currentEvent.id; }.bind(this));
        if (freshEvent) this.currentEvent = freshEvent;
      }
      this.eventPlayerIdx = typeof data.eventPlayerIdx === 'number' ? data.eventPlayerIdx : -1;
      this.currentEventId = data.currentEventId || null;
      this.eliteMonster = data.eliteMonster || null;
      this.eliteTargetPlayer = data.eliteTargetPlayer || null;
      this.elitePhase = data.elitePhase || "";
      this.chainEventQueue = data.chainEventQueue || [];
      this.teamRelics = data.teamRelics || null;
      this.hiddenBossStage = data.hiddenBossStage || false;
      this.hiddenEndingData = data.hiddenEndingData || null;
      this._bossActionMsg = data._bossActionMsg || "";
      this._bossIntroMsg = data._bossIntroMsg || "";
      this._eliteIntroMsg = data._eliteIntroMsg || "";
      this._roundMsgBuffer = data._roundMsgBuffer || [];
      this._roundComplete = data._roundComplete || false;
      this._loaded = true;
    } else {
      this.creatorId = "";
      this.status = "waiting";
      this.players = [];
      this.board = this._generateBoard();
      this.currentPlayerIdx = 0;
      this.prepRound = 0;
      this.boss = null;
      this.turnOrder = [];
      this.bossTurnCount = 0;
      this.playerActionsThisRound = 0;
      this.createdAt = now();
      this.lastActionTime = now();
      this.fightRound = 0;
      this.phase = "";
      this.bossSkillActive = {};
      this.log = [];
      this.bossStage = 0;
      this.currentEvent = null;
      this.eventPlayerIdx = -1;
      this.currentEventId = null;
      this.eliteMonster = null;
      this.eliteTargetPlayer = null;
      this.elitePhase = "";
      this.chainEventQueue = [];
      this.teamRelics = null;
      this.hiddenBossStage = false;
      this.hiddenEndingData = null;
      this._bossActionMsg = "";
      this._bossIntroMsg = "";
      this._eliteIntroMsg = "";
      this._roundMsgBuffer = [];
      this._roundComplete = false;
      this._loaded = false;
    }
  }

  _save() {
    ext.storageSet("exped_" + this.roomId, JSON.stringify({
      roomId: this.roomId,
      creatorId: this.creatorId,
      status: this.status,
      players: this.players,
      board: this.board,
      currentPlayerIdx: this.currentPlayerIdx,
      prepRound: this.prepRound,
      boss: this.boss,
      turnOrder: this.turnOrder,
      bossTurnCount: this.bossTurnCount,
      playerActionsThisRound: this.playerActionsThisRound,
      createdAt: this.createdAt,
      lastActionTime: this.lastActionTime,
      fightRound: this.fightRound,
      phase: this.phase,
      bossSkillActive: this.bossSkillActive,
      log: this.log,
      bossStage: this.bossStage,
      currentEvent: this.currentEvent,
      eventPlayerIdx: this.eventPlayerIdx,
      currentEventId: this.currentEventId,
      eliteMonster: this.eliteMonster,
      eliteTargetPlayer: this.eliteTargetPlayer,
      elitePhase: this.elitePhase,
      chainEventQueue: this.chainEventQueue,
      teamRelics: this.teamRelics,
      hiddenBossStage: this.hiddenBossStage,
      hiddenEndingData: this.hiddenEndingData,
      _bossActionMsg: this._bossActionMsg || "",
      _bossIntroMsg: this._bossIntroMsg || "",
      _eliteIntroMsg: this._eliteIntroMsg || "",
      _roundMsgBuffer: this._roundMsgBuffer || [],
      _roundComplete: this._roundComplete || false,
    }));
    this.lastActionTime = now();
  }

  _destroy() {
    ext.storageSet("exped_" + this.roomId, "");
  }

  _generateBoard() {
    const base = [...BOARD_TILES];
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base.slice(0, EXPEDITION.BOARD_SIZE);
  }

  _findPlayer(userId) {
    return this.players.find(function(p) { return p.userId === userId; });
  }

  _playerIndex(userId) {
    return this.players.findIndex(function(p) { return p.userId === userId; });
  }

  _checkTimeout() {
    if (this.status === "waiting" || this.status === "ended") return false;
    if (now() - this.lastActionTime > EXPEDITION.ROOM_TIMEOUT) {
      this.status = "ended";
      this._save();
      return true;
    }
    return false;
  }

  // ---------- 房间管理 ----------

  create(ctx) {
    loadConfig(); // 每次创建房间时刷新UI配置
    if (this._loaded) return { ok: false, msg: "房间已存在。" };
    this.creatorId = ctx.player.userId;
    this.status = "waiting";
    this.players.push(this._createPlayer(ctx.player.userId, ctx.player.name));
    this._save();
    return { ok: true, msg: "远征队创建成功！\n房间号：" + this.roomId + "\n等待其他玩家加入（2~" + EXPEDITION.MAX_PLAYERS + " 人）……\n加入后使用「" + EXPEDITION.CMD_PREFIX + "加入 " + this.roomId + "」" };
  }

  _createPlayer(userId, name) {
    return {
      userId: userId,
      name: name,
      classId: null,
      className: "",
      position: 0,
      hp: 50,
      maxHp: 50,
      attack: 5,
      defense: 3,
      items: [],
      totalDamage: 0,
      totalHeal: 0,
      alive: true,
      skipNext: false,
      skillCooldowns: {},
      _shield: 0,
      _ironWallShield: 0,
      _ironWallDuration: 0,
      _warCryBonus: 0,
      _shadowStep: 0,
      _taunting: false, _tauntDuration: 0,
      _thornsActive: false,
      _lastActionTime: 0,
      _extraSkills: [],
      _talents: [],           // 持有的特长ID列表
      _luckyBonus: 0,        // 运气检定减值
      _dodgeChance: 0,       // 闪避概率
      _moneyBonus: 0,        // 金钱加成比例
      _critBonus: 0,         // 暴击额外概率
      _survivalActive: false,// HP低时防御加成
      _warBlood: 0,          // 战血击杀数
      _cdReduction: 0,       // CD减少值
      _eliteBonus: 0,        // 精英怪伤害加成
      _warriorShieldHP: 0,   // 战士血盾HP（第二血条）
      _extraTurns: 0,        // 额外行动次数（拉条）
    };
  }

  join(ctx) {
    if (this.status !== "waiting") return { ok: false, msg: "远征已经开始或已结束，无法加入。" };
    if (this.players.length >= EXPEDITION.MAX_PLAYERS) return { ok: false, msg: "队伍已满（上限 " + EXPEDITION.MAX_PLAYERS + " 人）。" };
    if (this._findPlayer(ctx.player.userId)) return { ok: false, msg: "你已经在这个队伍中了。" };
    this.players.push(this._createPlayer(ctx.player.userId, ctx.player.name));
    this._save();
    return { ok: true, msg: ctx.player.name + " 加入了远征队！（" + this.players.length + "/" + EXPEDITION.MAX_PLAYERS + "）\n使用「" + EXPEDITION.CMD_PREFIX + "选职 战士/法师/祭司/刺客/守卫/愚者/狂战士」选择你的职业。" };
  }

  chooseClass(ctx, classId) {
    const player = this._findPlayer(ctx.player.userId);
    if (!player) return { ok: false, msg: "你不在这个远征队中。" };
    if (this.status !== "waiting") return { ok: false, msg: "只能在准备前选择职业。" };
    if (player.classId) return { ok: false, msg: "你已经选择了「" + player.className + "」，无法更换。" };

    const cls = CLASSES[classId];
    if (!cls) return { ok: false, msg: "未知职业。可选：战士、法师、祭司、刺客、守卫、愚者、狂战士" };

    player.classId = classId;
    player.className = cls.name;
    player.hp += cls.bonusHp;
    player.maxHp += cls.bonusHp;
    if (player.hp < 1) { player.hp = 1; player.maxHp = 1; }
    player.attack += cls.bonusAtk;
    player.defense += cls.bonusDef;
    player.attack = Math.max(1, player.attack);
    player.defense = Math.max(0, player.defense);

    this._save();
    let msg = "✦️ " + player.name + " 选择了「" + cls.icon + " " + cls.name + "」！\n";
    msg += "HP " + player.hp + "/" + player.maxHp + "  ⚔️" + player.attack + " 🛡️" + player.defense + "\n";
    msg += "被动天赋：【" + cls.passive.name + "】" + cls.passive.desc + "\n";
    msg += "技能：";
    for (const sk of cls.skills) {
      msg += "\n  " + sk.icon + " " + sk.name + "（冷却 " + sk.maxCd + " 轮）——" + sk.desc;
    }
    // 随机抽取3个先天特长供选择
    var shuffled = BORN_TALENT_POOL.slice();
    for (var si = shuffled.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var stmp = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = stmp;
    }
    player._bornTalentOptions = shuffled.slice(0, 3);
    this._save();

    msg += "\n\n🌟 请选择一个先天特长（发送 \"" + EXPEDITION.CMD_PREFIX + "特长 <序号>\"）：";
    for (var tti = 0; tti < player._bornTalentOptions.length; tti++) {
      var tt = TALENTS[player._bornTalentOptions[tti]];
      msg += "\n  " + (tti + 1) + ". " + tt.icon + " " + tt.name + " — " + tt.desc;
    }
    return { ok: true, msg: msg };
  }

  // 选择先天特长
  chooseTalent(ctx, talentIdx) {
    var player = this._findPlayer(ctx.player.userId);
    if (!player) return { ok: false, msg: "你不在这个远征队中。" };
    if (this.status !== "waiting") return { ok: false, msg: "只能在准备前选择特长。" };
    if (!player._bornTalentOptions || player._bornTalentOptions.length === 0) {
      return { ok: false, msg: "你还没有选择职业，或已经选择过特长了。" };
    }
    if (player._talents.length > 0) return { ok: false, msg: "你已经选择了先天特长，无法更换。" };
    if (talentIdx < 1 || talentIdx > player._bornTalentOptions.length) {
      return { ok: false, msg: "无效选择，请输入 1~" + player._bornTalentOptions.length + "。" };
    }
    var talentId = player._bornTalentOptions[talentIdx - 1];
    var talent = TALENTS[talentId];
    talent.onApply(player);
    player._talents.push(talentId);
    player._bornTalentOptions = [];
    this._save();
    return { ok: true, msg: "🌟 " + player.name + " 获得了先天特长【" + talent.icon + " " + talent.name + "】！\n" + talent.desc };
  }

  // 解锁后天特长
  _unlockTalent(player, talentId, sourceDesc) {
    if (!TALENTS[talentId]) return null;
    if (player._talents.indexOf(talentId) >= 0) return null;
    if (player._talents.length >= EXPEDITION.MAX_TALENTS) {
      return "你的特长槽已满（" + EXPEDITION.MAX_TALENTS + "/" + EXPEDITION.MAX_TALENTS + "），无法习得新特长。";
    }
    var talent = TALENTS[talentId];
    talent.onApply(player);
    player._talents.push(talentId);
    this._save();
    return "🌟 你领悟了后天特长【" + talent.icon + " " + talent.name + "】！\n" + (sourceDesc || "") + "\n" + talent.desc;
  }

  leave(ctx) {
    const idx = this._playerIndex(ctx.player.userId);
    if (idx === -1) return { ok: false, msg: "你不在这个远征队中。" };
    if (ctx.player.userId === this.creatorId) {
      this._destroy();
      return { ok: true, msg: "房主已离开，远征解散。" };
    }
    this.players.splice(idx, 1);
    if (this.players.length === 0) { this._destroy(); return { ok: true, msg: "所有玩家已离开，远征解散。" }; }
    this._save();
    return { ok: true, msg: ctx.player.name + " 离开了远征队。" };
  }

  start(ctx) {
    if (ctx.player.userId !== this.creatorId) return { ok: false, msg: "只有房主可以开始远征。" };
    if (this.status !== "waiting") return { ok: false, msg: "远征已经开始。" };
    if (this.players.length < EXPEDITION.MIN_PLAYERS) return { ok: false, msg: "人数不足（至少 " + EXPEDITION.MIN_PLAYERS + " 人，当前 " + this.players.length + " 人）。" };

    for (const p of this.players) {
      if (!p.classId) {
        const fallback = pickRandom(CLASS_LIST);
        p.classId = fallback;
        p.className = CLASSES[fallback].name;
        const cls = CLASSES[fallback];
        p.hp += cls.bonusHp;
        p.maxHp += cls.bonusHp;
        if (p.hp < 1) { p.hp = 1; p.maxHp = 1; }
        p.attack += cls.bonusAtk;
        p.defense += cls.bonusDef;
        p.attack = Math.max(1, p.attack);
        p.defense = Math.max(0, p.defense);
      }
    }

    this.status = "preparing";
    this.prepRound = 0;
    this.currentPlayerIdx = 0;
    this.phase = "prepare";
    this.bossStage = 0;

    for (const p of this.players) {
      p.position = 0;
      var _initHp = seal.ext.getIntConfig(ext, "初始HP");
      var _initAtk = seal.ext.getIntConfig(ext, "初始攻击");
      var _initDef = seal.ext.getIntConfig(ext, "初始防御");
      p.hp = _initHp + this.players.length * 10;
      p.maxHp = p.hp;
      p.attack = _initAtk; p.defense = _initDef;
      const cls = CLASSES[p.classId];
      p.hp += cls.bonusHp; p.maxHp += cls.bonusHp;
      if (p.hp < 1) { p.hp = 1; p.maxHp = 1; }
      p.attack += cls.bonusAtk; p.defense += cls.bonusDef;
      p.attack = Math.max(1, p.attack); p.defense = Math.max(0, p.defense);
      p.items = [];
      p.totalDamage = 0; p.totalHeal = 0;
      p.alive = true; p.skipNext = false;
      p.skillCooldowns = {};
      p._shield = 0; p._ironWallShield = 0; p._ironWallDuration = 0;
      p._warCryBonus = 0; p._shadowStep = 0; p._taunting = false; p._tauntDuration = 0; p._tauntAtkBuff = 0; p._foolDodge = false; p._foolCritNext = false; p._foolCurrentPassive = null;
      p._fireAffinity = false;
      p._trueDmgNext = false;
      p._blessing = 0;
      p._defBuff = 0;
      p._atkBuff = 0;
      p._dmgBoost = 0;
      p._critGuaranteed = 0;
      p._battleStacks = 0;
      p._comboTriggered = false;
      p._counterAtkTurn = 0;
      p._frozenTurns = 0;
      p._marked = null;
      p._thornsActive = false;
      p._extraSkills = [];
      p._warriorShieldHP = 0;
    }

    // 肉鸽战斗/事件追踪
    this.currentEventId = null;    // 最近处理的事件ID（用于事件连锁）
    this.eliteMonster = null;       // 当前精英/遭遇怪
    this.eliteTargetPlayer = null;  // 遭遇战的 solo 目标玩家
    this.elitePhase = "";          // "" / "elite" / "solo"
    this.chainEventQueue = [];     // 事件连锁队列

    // 水晶点亮初始buff
    var crystalCount = getCrystal(ctx);
    if (crystalCount >= 3) {
      for (const cp of this.players) {
        cp.maxHp += 5; cp.hp += 5;
        cp.attack += 1;
      }
      addCrystal(ctx, -3);
      this._crystalBuffApplied = true;
    }
    if (crystalCount >= 8) {
      for (const cp of this.players) {
        cp.maxHp += 10; cp.hp += 10;
        cp.attack += 2;
        cp.defense += 1;
      }
      addCrystal(ctx, -8);
      this._crystalBuffApplied = true;
    }

    // 自动修整：开始前全员恢复10%HP
    for (const p of this.players) {
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.1));
    }

    this._save();

    var fightRounds = EXPEDITION.ELITE_FIGHT_ROUNDS;
    let msg = "✦️ 秘境远征 · 准备阶段 ✦️\n";
    msg += "共 " + EXPEDITION.PREP_ROUNDS + " 轮行动（探索 + 战斗交替）：";
    msg += "\n\n🔧 远征开始前的修整阶段已自动完成：全员恢复10%HP";
    msg += "\n  🎲 探索轮：掷骰前进，触发肉鸽事件和检定";
    msg += "\n  ⚔️ 战斗轮：第 " + fightRounds.join("、") + " 轮触发精英怪战斗";
    msg += "\n\n掷骰子前进，收集装备和资源！途中可能触发肉鸽事件！\n\n";
    msg += "📋 队伍阵容：\n";
    for (const p of this.players) {
      const cls = CLASSES[p.classId];
      var talentStr = "";
      if (p._talents.length > 0) {
        talentStr = " 🌟" + p._talents.map(function(tid) { return TALENTS[tid].icon + TALENTS[tid].name; }).join(",");
      }
      msg += "  " + cls.icon + " " + p.name + "（" + cls.name + "）HP " + p.hp + "/" + p.maxHp + " ⚔️" + getEffectiveAttack(p) + " 🛡️" + p.defense + talentStr + "\n";
    }
    msg += "\n轮到 " + this.players[0].name + " 行动。\n发送「" + EXPEDITION.CMD_PREFIX + "行动」开始。";
    return { ok: true, msg: msg };
  }

  // ---------- 准备阶段 ----------

  roll(ctx) {
    if (this.status !== "preparing") return { ok: false, msg: "当前不在准备阶段。" };
    if (this.phase !== "prepare") return { ok: false, msg: "当前无法掷骰子。" };

    const player = this._findPlayer(ctx.player.userId);
    if (!player) return { ok: false, msg: "你不在这个远征队中。" };

    const expectedPlayer = this.players[this.currentPlayerIdx];
    if (player.userId !== expectedPlayer.userId) {
      return { ok: false, msg: "还没轮到你。当前轮到 " + expectedPlayer.name + "。" };
    }

    if (player.skipNext) {
      player.skipNext = false;
      const prevStatus = this.status;
      this._advanceTurnPrep();
      this._save();
      if (prevStatus === "preparing" && this.status === "fighting") {
        return { ok: true, msg: "你被落石砸中，这轮无法行动，自动跳过。\n\n" + this._bossIntroMsg };
      }
      return { ok: false, msg: "你被落石砸中，这轮无法行动，自动跳过。轮到 " + this.players[this.currentPlayerIdx].name + "。" };
    }

    const dice = getRandomInt(1, 6);
    const oldPos = player.position;
    player.position = (player.position + dice) % this.board.length;
    const tile = this.board[player.position];

    let result = "🎲 " + player.name + " 掷出了 " + dice + " 点！";
    result += "\n从第 " + (oldPos + 1) + " 格移动到第 " + (player.position + 1) + " 格。";
    result += "\n" + tile.icon + " " + tile.label + "：" + tile.desc;

    const eff = tile.effect;
    var effectMsg = "";
    if (eff.money) { addMoney(ctx, eff.money); effectMsg += "\n  💰 金钱 " + (eff.money > 0 ? "+" : "") + eff.money; }
    if (eff.attack) { player.attack += eff.attack; effectMsg += "\n  ⚔️ 攻击力 +" + eff.attack; }
    if (eff.defense) { player.defense += eff.defense; effectMsg += "\n  🛡️ 防御力 +" + eff.defense; }
    if (eff.maxHpBonus) {
      player.maxHp += eff.maxHpBonus;
      player.hp = Math.min(player.hp + eff.maxHpBonus, player.maxHp);
      effectMsg += "\n  ❤️ 最大HP +" + eff.maxHpBonus;
    }
    if (eff.item) {
      const existing = player.items.find(function(i) { return i.id === eff.item; });
      if (existing) existing.count += eff.count || 1;
      else player.items.push({ id: eff.item, count: eff.count || 1 });
      var itemName = ITEM_NAMES[eff.item] || eff.item;
      effectMsg += "\n  🎒 获得 " + itemName + " x" + (eff.count || 1);
    }
    if (eff.skipNext) { player.skipNext = true; effectMsg += "\n  ⏭ 下一轮将被跳过"; }
    if (eff.skillBook) {
      const book = grantRandomSkillBook(player);
      if (book) {
        effectMsg += "\n\n  📕━━━━━━━━━━━━━━━━━━";
        effectMsg += "\n  📕 获得技能书：【" + book.icon + " " + book.name + "】";
        effectMsg += "\n  📕 " + book.desc;
        effectMsg += "\n  📕 战斗中发送「" + EXPEDITION.CMD_PREFIX + "技能 " + book.name + "」使用";
        effectMsg += "\n  📕━━━━━━━━━━━━━━━━━━";
      } else {
        effectMsg += "\n  📕 你已经拥有所有技能书了，这次没有新收获。";
      }
    }
    if (effectMsg) { result += "\n\n✨️ 【效果生效】" + effectMsg; }

    // 肉鸽事件触发检测（过滤连锁专属事件和已触发事件）
    let eventTriggered = false;
    if (Math.random() < EXPEDITION.ROGUE_EVENT_CHANCE) {
      // 连锁专属事件ID，不能直接随机触发
      var chainOnlyIds = EVENT_CHAINS.map(function(c) { return c.target; });
      // 已触发过的事件ID
      var triggeredIds = this._triggeredEvents || [];
      // 过滤可用事件池
      var availableEvents = ROGUE_EVENTS.filter(function(e) {
        return chainOnlyIds.indexOf(e.id) < 0 && triggeredIds.indexOf(e.id) < 0;
      });
      if (availableEvents.length === 0) availableEvents = ROGUE_EVENTS.filter(function(e) { return chainOnlyIds.indexOf(e.id) < 0; });
      const event = pickRandom(availableEvents);
      this.currentEvent = event;
      if (!this._triggeredEvents) this._triggeredEvents = [];
      this._triggeredEvents.push(event.id);
      this.eventPlayerIdx = this._playerIndex(player.userId);
      result += "\n\n" + event.icon + " 【肉鸽事件】" + event.name;
      result += "\n" + event.desc;
      if (event.check) {
        result += "\n\n🔍 【检定】" + event.check.passDesc + " / " + event.check.failDesc;
      }
      result += "\n\n请选择：";
      for (let i = 0; i < event.choices.length; i++) {
        var c = event.choices[i];
        result += "\n  " + (i + 1) + ". " + c.text;
        if (c.condition) result += "（" + c.condition + "）";
        if (c.check && c.checkRequired !== true) {
          result += "（" + c.check.passDesc + " / " + c.check.failDesc + "）";
        }
      }
      result += "\n发送「" + EXPEDITION.CMD_PREFIX + "选择 <序号>」做出选择。";
      eventTriggered = true;
      this._save();
      return { ok: true, msg: result, event: true };
    }

    const prevStatus = this.status;
    var prevPhase = this.phase;
    this._advanceTurnPrep();
    if (prevStatus === "preparing" && this.status === "fighting") {
      result += "\n\n" + this._bossIntroMsg;
      this._save();
      return { ok: true, msg: result };
    }
    // 精英战斗触发
    if (prevPhase === "prepare" && this.phase === "eliteFight") {
      result += this._eliteIntroMsg;
      this._save();
      return { ok: true, msg: result };
    }

    if (this.players[this.currentPlayerIdx]) {
      var roundHint = "\n（第 " + (this.prepRound + 1) + "/" + EXPEDITION.PREP_ROUNDS + " 轮";
      if (EXPEDITION.ELITE_FIGHT_ROUNDS.indexOf(this.prepRound + 1) >= 0) {
        roundHint += " · 下一轮为战斗轮";
      }
      roundHint += "）";
      result += roundHint + "\n\n轮到 " + this.players[this.currentPlayerIdx].name + " 行动。";
      // 显示当前玩家持有的技能书
      var curP = this.players[this.currentPlayerIdx];
      if (curP._extraSkills && curP._extraSkills.length > 0) {
        result += "\n\n📖 已持有技能书：" + curP._extraSkills.map(function(s) { return s.icon + s.name; }).join("、");
        result += "\n  发送「" + EXPEDITION.CMD_PREFIX + "技能 <名称>」在战斗中使用";
      }
    }
    this._save();
    return { ok: true, msg: result };
  }

  // 处理肉鸽事件选择
  handleEventChoice(ctx, choiceIdx) {
    if (!this.currentEvent) return { ok: false, msg: "当前没有待处理的事件。" };
    if (this.status !== "preparing" || this.phase !== "prepare") return { ok: false, msg: "当前不在准备阶段。" };

    const event = this.currentEvent;
    if (choiceIdx < 1 || choiceIdx > event.choices.length) {
      return { ok: false, msg: "无效选择，请输入 1~" + event.choices.length + "。" };
    }

    const player = this.players[this.eventPlayerIdx];
    if (!player) return { ok: false, msg: "事件关联的玩家不存在。" };
    if (ctx.player.userId !== player.userId) {
      return { ok: false, msg: "这个事件是 " + player.name + " 遇到的，只有Ta能做选择。" };
    }

    const choice = event.choices[choiceIdx - 1];

    // 检查金钱条件（通用方式：从 condition 字符串中提取数字）
    if (choice.condition && choice.condition.indexOf("money") >= 0) {
      const match = choice.condition.match(/(\d+)/);
      if (match) {
        const need = parseInt(match[1]);
        if (getMoney(ctx) < need) return { ok: false, msg: "你的金钱不足！需要 " + need + " 金钱。" };
      }
    }

    // 检查事件标记条件（conditionFlag：需要玩家持有该标记）
    if (choice.conditionFlag) {
      var ef = player.eventFlags || {};
      if (!ef[choice.conditionFlag]) return { ok: false, msg: "该选项需要特定前置条件，当前不满足。" };
    }

    // 扣费
    if (choice.cost && choice.cost.money) {
      addMoney(ctx, -choice.cost.money);
    }

    // 检定结果判定
    let outcome;
    var activeCheck = choice.check || event.check;
    if (choice.checkRequired === true && activeCheck) {
      // ── 多层级检定（tiered）──
      if (activeCheck.tiered) {
        var statValue;
        if (activeCheck.stat === "attack") statValue = getEffectiveAttack(player);
        else if (activeCheck.stat === "defense") statValue = player.defense;
        else if (activeCheck.stat === "hpPercent") statValue = Math.floor(player.hp / player.maxHp * 100);
        else statValue = player[activeCheck.stat] || 0;
        var matchedTier = null;
        for (var ti = 0; ti < activeCheck.tiers.length; ti++) {
          var tier = activeCheck.tiers[ti];
          if (tier.min !== undefined && tier.max !== undefined) {
            if (statValue >= tier.min && statValue <= tier.max) { matchedTier = tier; break; }
          } else if (tier.min !== undefined) {
            if (statValue >= tier.min) { matchedTier = tier; break; }
          } else if (tier.max !== undefined) {
            if (statValue <= tier.max) { matchedTier = tier; break; }
          }
        }
        if (!matchedTier) matchedTier = activeCheck.tiers[activeCheck.tiers.length - 1];
        var tierKey = matchedTier.key || ("tier" + ti);
        var tierEntry = choice.outcomes.find(function(o) { return o[tierKey]; });
        if (!tierEntry) tierEntry = choice.outcomes[0];
        var tierOutcome = tierEntry[tierKey] || tierEntry;
        outcome = { result: tierOutcome.result, msg: "\n🔍 检定结果：" + activeCheck.stat + " = " + statValue + " → " + matchedTier.label + "\n" + tierOutcome.msg, effect: tierOutcome.effect, extraItem: tierOutcome.extraItem, grantSkill: tierOutcome.grantSkill };
      // ── 自定义函数检定（custom）──
      } else if (activeCheck.custom) {
        var customResult = activeCheck.custom(player, ctx);
        var customKey = customResult.key;
        var customEntry = choice.outcomes.find(function(o) { return o[customKey]; });
        if (!customEntry) customEntry = choice.outcomes[0];
        var customOutcome = customEntry[customKey] || customEntry;
        outcome = { result: customOutcome.result, msg: customResult.msg + "\n" + customOutcome.msg, effect: customOutcome.effect, extraItem: customOutcome.extraItem, grantSkill: customOutcome.grantSkill };
      // ── 原有 pass/fail 二分支检定 ──
      } else {
        var statValue2;
        if (activeCheck.stat === "attack") statValue2 = getEffectiveAttack(player);
        else if (activeCheck.stat === "defense") statValue2 = player.defense;
        else if (activeCheck.stat === "hpPercent") statValue2 = Math.floor(player.hp / player.maxHp * 100);
        else if (activeCheck.stat === "luck") statValue2 = getRandomInt(1, 6) + (player._luckyBonus || 0);
        else statValue2 = player[activeCheck.stat] || 0;
        var checkPassed2 = statValue2 >= activeCheck.threshold;
        var checkMsg2 = "";
        if (activeCheck.stat === "luck") {
          checkMsg2 = "\n🎲 命运骰子掷出了 [" + statValue2 + "] — " + (checkPassed2 ? "好运降临！" : "霉运缠身……");
        } else {
          checkMsg2 = "\n🔍 检定结果：" + activeCheck.stat + " = " + statValue2 + "，阈值 " + activeCheck.threshold + " → " + (checkPassed2 ? "通过！" : "失败……");
        }
        var passRaw2 = choice.outcomes.find(function(o) { return o.pass; });
        var failRaw2 = choice.outcomes.find(function(o) { return o.fail; });
        var passEntry2 = passRaw2 ? (passRaw2.pass || passRaw2) : undefined;
        var failEntry2 = failRaw2 ? (failRaw2.fail || failRaw2) : undefined;
        outcome = checkPassed2 ? passEntry2 : failEntry2;
        if (!outcome) outcome = passEntry2 || failEntry2 || choice.outcomes[0];
        outcome = { result: outcome.result, msg: checkMsg2 + "\n" + outcome.msg, effect: outcome.effect, extraItem: outcome.extraItem, grantSkill: outcome.grantSkill };
      }
    } else {
      // 传统模式：加权随机
      outcome = weightedRandom(choice.outcomes);
    }
    let msg = event.icon + " " + player.name + " 选择了「" + choice.text + "」\n" + outcome.msg;

    // 应用效果
    if (outcome.effect) {
      var sbResult = this._applyOutcomeEffect(ctx, player, outcome.effect);
      if (sbResult && sbResult.name) {
        msg += "\n📕 你获得了一本技能书【" + sbResult.name + "】！在战斗中可用「" + EXPEDITION.CMD_PREFIX + "技能 " + sbResult.name + "」使用。";
      } else if (sbResult && !sbResult.name) {
        msg += "\n📕 你已经拥有所有技能书了，这次没有新收获。";
      }
    }
    // 额外道具（废弃营地的搜索物资）
    if (outcome.extraItem) {
      const existing = player.items.find(function(i) { return i.id === outcome.extraItem.id; });
      if (existing) existing.count += outcome.extraItem.count;
      else player.items.push({ id: outcome.extraItem.id, count: outcome.extraItem.count });
    }
    // 检定通过授予技能书
    if (outcome.grantSkill) {
      var skillId = outcome.grantSkill;
      var book = UNIVERSAL_SKILLBOOKS.find(function(b) { return b.id === skillId; });
      if (book && !(player._extraSkills || []).find(function(s) { return s.id === skillId; })) {
        if (!player._extraSkills) player._extraSkills = [];
        player._extraSkills.push({ id: book.id, name: book.name, icon: book.icon, maxCd: book.maxCd, desc: book.desc });
        msg += "\n📕 你习得了技能【" + book.name + "】！在战斗中可用「" + EXPEDITION.CMD_PREFIX + "技能 " + book.name + "」使用。";
      } else if (book) {
        msg += "\n📕 你已经学会了【" + book.name + "】，技能书化作 10 金钱。";
        addMoney(ctx, 10);
      }
    }

    // 设置事件标记（setFlag）
    if (outcome.setFlag) {
      if (!player.eventFlags) player.eventFlags = {};
      player.eventFlags[outcome.setFlag] = true;
      msg += "\n🔖 事件标记已记录：" + outcome.setFlag;
    }
    // 也检查 choice 级别的 setFlag
    if (choice.setFlag && !outcome.setFlag) {
      if (!player.eventFlags) player.eventFlags = {};
      player.eventFlags[choice.setFlag] = true;
      msg += "\n🔖 事件标记已记录：" + choice.setFlag;
    }

    // 清除事件
    var eventId = event.id;
    var choiceId = choiceIdx;
    this.currentEvent = null;
    this.eventPlayerIdx = -1;
    this.currentEventId = eventId;

    // 特长解锁检测
    var unlockCheck = TALENT_UNLOCKS.find(function(u) {
      return u.eventId === eventId && u.choiceIdx === choiceId;
    });
    if (unlockCheck) {
      var unlockMsg = this._unlockTalent(player, unlockCheck.talentId, unlockCheck.desc);
      if (unlockMsg) msg += "\n" + unlockMsg;
    }

    // 事件连锁检测（支持 requireFlag 条件过滤）
    this.chainEventQueue = [];
    var playerFlags = player.eventFlags || {};
    for (var ci = 0; ci < EVENT_CHAINS.length; ci++) {
      var chain = EVENT_CHAINS[ci];
      if (chain.chainFrom === eventId && Math.random() < chain.chance) {
        if (chain.requireFlag && !playerFlags[chain.requireFlag]) continue;
        this.chainEventQueue.push(chain.target);
      }
    }
    // 如果有连锁事件，先触发第一个
    if (this.chainEventQueue.length > 0) {
      var chainTarget = this.chainEventQueue.shift();
      var chainEvent = ROGUE_EVENTS.find(function(e) { return e.id === chainTarget; });
      if (chainEvent) {
        this.currentEvent = chainEvent;
        this.eventPlayerIdx = this._playerIndex(player.userId);
        msg += "\n\n🔗 【事件连锁】" + chainEvent.icon + " 因为上一次遭遇，新的情况发生了……";
        msg += "\n" + chainEvent.icon + " 【肉鸽事件】" + chainEvent.name;
        msg += "\n" + chainEvent.desc;
        if (chainEvent.check) {
          msg += "\n\n🔍 【检定】" + chainEvent.check.passDesc + " / " + chainEvent.check.failDesc;
        }
        msg += "\n\n请选择：";
        for (var cci = 0; cci < chainEvent.choices.length; cci++) {
          var cc = chainEvent.choices[cci];
          msg += "\n  " + (cci + 1) + ". " + cc.text;
          if (cc.condition) msg += "（" + cc.condition + "）";
          if (cc.check && cc.checkRequired !== true) {
            msg += "（" + cc.check.passDesc + " / " + cc.check.failDesc + "）";
          }
        }
        msg += "\n发送「" + EXPEDITION.CMD_PREFIX + "选择 <序号>」做出选择。";
        this._save();
        return { ok: true, msg: msg };
      }
    }

    // 推进到下一玩家
    const prevStatus = this.status;
    const prevPhase = this.phase;
    // 记录哥布林跳过状态（由_advanceTurnPrep内部设置）
    this._advanceTurnPrep();
    // 哥布林跳过提示
    if (this._eliteSkippedForGoblin) {
      this._eliteSkippedForGoblin = false;
      msg += "\n\n🧌 远征途中遇到了哥布林劫匪团——它们认出你是恩人，主动让路并送上了 20 金钱！";
      addMoney(ctx, 20);
    }
    if (prevStatus === "preparing" && this.status === "fighting") {
      msg += "\n\n" + this._bossIntroMsg;
      this._save();
      return { ok: true, msg: msg };
    }
    // 精英战斗触发
    if (prevPhase === "prepare" && this.phase === "eliteFight") {
      msg += this._eliteIntroMsg;
      this._save();
      return { ok: true, msg: msg };
    }

    if (this.players[this.currentPlayerIdx]) {
      msg += "\n\n轮到 " + this.players[this.currentPlayerIdx].name + " 行动。";
    }
    this._save();
    return { ok: true, msg: msg };
  }

  // 应用事件效果（统一方法）
  _applyOutcomeEffect(ctx, player, eff) {
    if (eff.money) addMoney(ctx, eff.money);
    if (eff.attack) { player.attack += eff.attack; player.attack = Math.max(1, player.attack); }
    if (eff.defense) { player.defense += eff.defense; player.defense = Math.max(0, player.defense); }
    if (eff.maxHpBonus) { player.maxHp = Math.max(10, player.maxHp + eff.maxHpBonus); if (player.hp > player.maxHp) player.hp = player.maxHp; }
    if (eff.fullHeal) { player.hp = player.maxHp; }
    if (eff.heal) { player.hp = Math.min(player.maxHp, player.hp + eff.heal); }
    if (eff.healPct) {
      var healAmt = Math.floor(player.maxHp * eff.healPct);
      player.hp = Math.min(player.maxHp, player.hp + healAmt);
      if (eff.healPctAll) {
        // 全体恢复
        this.players.forEach(function(p) { if (p.alive) p.hp = Math.min(p.maxHp, p.hp + healAmt); });
      }
    }
    if (eff.hpPctCost) {
      var hpLoss = Math.floor(player.maxHp * eff.hpPctCost);
      player.hp = Math.max(1, player.hp - hpLoss);
    }
    if (eff.selfDamage) {
      player.hp -= eff.selfDamage;
      if (player.hp <= 0) player.hp = 1;
    }
    if (eff.item) {
      const existing = player.items.find(function(i) { return i.id === eff.item; });
      if (existing) existing.count += eff.count || 1;
      else player.items.push({ id: eff.item, count: eff.count || 1 });
    }
    if (eff.crystal) addCrystal(ctx, eff.crystal);
    var skillBookResult = null;
    if (eff.skillBook) {
      const book = grantRandomSkillBook(player);
      if (book) {
        skillBookResult = { name: book.name, desc: book.desc };
      } else {
        skillBookResult = { name: null, desc: null };
      }
    }
    // 特殊效果：跳过下一回合
    if (eff.skipNext) { player.skipNext = true; }
    // 扣除自身最大生命上限
    if (eff.maxHpLoss) {
      player.maxHp = Math.max(10, player.maxHp - eff.maxHpLoss);
      if (player.hp > player.maxHp) player.hp = player.maxHp;
    }
    // 随机扣除一名队友最大生命上限
    if (eff.allyMaxHpLoss) {
      var aliveAllies = this.players.filter(function(p) { return p.alive && p.userId !== player.userId; });
      if (aliveAllies.length > 0) {
        var victim = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
        victim.maxHp = Math.max(10, victim.maxHp - eff.allyMaxHpLoss);
        if (victim.hp > victim.maxHp) victim.hp = victim.maxHp;
        skillBookResult = skillBookResult || {};
        skillBookResult.allyVictim = victim.name;
      }
    }
    // 指定技能书（非随机）
    if (eff.grantSkill) {
      var targetBook = UNIVERSAL_SKILLBOOKS.find(function(b) { return b.id === eff.grantSkill; });
      if (targetBook) {
        var existing = player._extraSkills ? player._extraSkills.find(function(s) { return s.id === targetBook.id; }) : null;
        if (!existing) {
          if (!player._extraSkills) player._extraSkills = [];
          player._extraSkills.push({ id: targetBook.id, name: targetBook.name, icon: targetBook.icon, cooldown: targetBook.cooldown, maxCd: targetBook.maxCd });
          skillBookResult = { name: targetBook.name, desc: targetBook.desc };
        } else {
          skillBookResult = { name: null, desc: null };
        }
      }
    }
    // 特殊效果：跳过下一回合
    if (eff.skipNext) { player.skipNext = true; }
    // 特殊效果：跳过哥布林战斗
    if (eff.skipGoblinElite) {
      this._skipGoblinElite = true;
    }
    return skillBookResult;
  }

  _advanceTurnPrep() {
    this.currentPlayerIdx++;
    if (this.currentPlayerIdx >= this.players.length) {
      this.currentPlayerIdx = 0;
      this.prepRound++;
      if (this.prepRound >= EXPEDITION.PREP_ROUNDS) {
        this._startBossFight();
        return;
      }
      // 检查是否为战斗轮（触发精英怪）
      if (EXPEDITION.ELITE_FIGHT_ROUNDS.indexOf(this.prepRound) >= 0) {
        this._startEliteFight();
        if (this._eliteSkippedForGoblin) {
          // 不在此处重置，由调用方负责重置和输出消息
          // 跳过哥布林战斗，继续推进
          this.currentPlayerIdx++;
          if (this.currentPlayerIdx >= this.players.length) {
            this.currentPlayerIdx = 0;
            this.prepRound++;
            if (this.prepRound >= EXPEDITION.PREP_ROUNDS) { this._startBossFight(); return; }
          }
          // 找下一个存活玩家
          let gs2 = 0;
          while (gs2 < this.players.length) {
            if (this.currentPlayerIdx >= this.players.length) {
              this.currentPlayerIdx = 0;
              this.prepRound++;
              if (this.prepRound >= EXPEDITION.PREP_ROUNDS) { this._startBossFight(); return; }
              if (EXPEDITION.ELITE_FIGHT_ROUNDS.indexOf(this.prepRound) >= 0) { this._startEliteFight(); return; }
            }
            var gp = this.players[this.currentPlayerIdx];
            if (gp.alive && !gp.skipNext) break;
            if (gp.skipNext) gp.skipNext = false;
            this.currentPlayerIdx++;
            gs2++;
          }
        }
        return;
      }
    }
    // 跳过死亡和 skipNext 玩家
    let safety = 0;
    while (safety < this.players.length) {
      if (this.currentPlayerIdx >= this.players.length) {
        this.currentPlayerIdx = 0;
        this.prepRound++;
        if (this.prepRound >= EXPEDITION.PREP_ROUNDS) {
          this._startBossFight();
          return;
        }
        if (EXPEDITION.ELITE_FIGHT_ROUNDS.indexOf(this.prepRound) >= 0) {
          this._startEliteFight();
          return;
        }
      }
      const p = this.players[this.currentPlayerIdx];
      if (p.alive && !p.skipNext) break;
      if (p.skipNext) p.skipNext = false;
      this.currentPlayerIdx++;
      safety++;
    }
  }

  // ── 精英怪战斗系统（肉鸽阶段）──
  _startEliteFight() {
    var monster = pickRandom(ELITE_MONSTERS);

    // 哥布林盟友跳过战斗
    if (monster.id === "goblinAmbush" && this._skipGoblinElite) {
      this._skipGoblinElite = false;
      this._eliteSkippedForGoblin = true;
      return; // 不进入战斗，调用方检查 _eliteSkippedForGoblin
    }
    var aliveCount = this.players.filter(function(p) { return p.alive && p.hp > 0; }).length;
    // 人数缩放（削弱：每多1人+12%HP，+8%ATK）
    var hpScale = 1 + (aliveCount - 1) * 0.12;
    var atkScale = 1 + (aliveCount - 1) * 0.08;
    // 关卡自适应：第1关道中打6折，第2关打8折，第3关不打折
    var stageScale = 1;
    var currentStage = this.bossStage || 1;
    if (currentStage === 1) stageScale = 0.6;
    else if (currentStage === 2) stageScale = 0.8;
    hpScale *= stageScale;
    atkScale *= stageScale;
    // 轮次缩放：第2轮(索引1)打75折，第4轮(索引3)打85折
    var roundScale = 1;
    if (this.prepRound === 1) roundScale = 0.75;
    else if (this.prepRound === 3) roundScale = 0.85;
    hpScale *= roundScale;
    atkScale *= roundScale;

    this.eliteMonster = {
      id: monster.id, name: monster.name, icon: monster.icon,
      desc: monster.desc, type: monster.type,
      hp: Math.floor(monster.baseHp * hpScale),
      maxHp: Math.floor(monster.baseHp * hpScale),
      attack: Math.floor(monster.baseAtk * atkScale),
      reward: monster.reward,
      relicDrop: monster.relicDrop || null,
    };

    if (monster.type === "solo") {
      // 遭遇战：随机选一个存活玩家1v1
      var alivePlayers = this.players.filter(function(p) { return p.alive && p.hp > 0; });
      this.eliteTargetPlayer = pickRandom(alivePlayers);
      this.elitePhase = "solo";
    } else {
      // 精英战：全队参与
      this.eliteTargetPlayer = null;
      this.elitePhase = "elite";
    }

    this.phase = "eliteFight";
    this._save();

    this._eliteIntroMsg = "";
    this._eliteIntroMsg += "\n\n⚔️ ⚔️ ⚔️ 【第 " + (this.prepRound + 1) + " 轮 · " + (this.elitePhase === "solo" ? "遭遇战" : "精英战斗") + "】⚔️ ⚔️ ⚔️\n\n";
    this._eliteIntroMsg += this.eliteMonster.icon + " " + this.eliteMonster.name + " 出现了！\n";
    this._eliteIntroMsg += this.eliteMonster.desc + "\n\n";
    this._eliteIntroMsg += "❤️ " + this.eliteMonster.name + " HP：" + this.eliteMonster.hp + "/" + this.eliteMonster.maxHp + "  ⚔️ " + this.eliteMonster.attack + "\n";
    if (this.elitePhase === "solo") {
      this._eliteIntroMsg += "\n🎯 " + this.eliteTargetPlayer.name + " 被选中进入遭遇战！\n";
      this._eliteIntroMsg += "其他队员无法介入，只能围观。\n";
      this._eliteIntroMsg += "发送「" + EXPEDITION.CMD_PREFIX + "攻击」或「" + EXPEDITION.CMD_PREFIX + "技能」进行战斗。\n";
    } else {
      this._eliteIntroMsg += "\n📋 全员进入精英战斗！\n";
      this._eliteIntroMsg += "发送「" + EXPEDITION.CMD_PREFIX + "攻击」或「" + EXPEDITION.CMD_PREFIX + "技能」进行战斗。\n";
      this._eliteIntroMsg += "\n📋 队伍状态：\n";
      for (var ep of this.players) {
        if (!ep.alive) continue;
        var ecls = CLASSES[ep.classId];
        var talentStr = "";
        if (ep._talents && ep._talents.length > 0) {
          talentStr = " 🌟" + ep._talents.map(function(tid) { return TALENTS[tid].icon + TALENTS[tid].name; }).join(",");
        }
        this._eliteIntroMsg += "  " + ecls.icon + " " + ep.name + " HP " + ep.hp + "/" + ep.maxHp + " ⚔️" + getEffectiveAttack(ep) + " 🛡️" + ep.defense + talentStr + "\n";
      }
    }
  }

  // 精英战斗攻击
  eliteAttack(ctx) {
    if (this.phase !== "eliteFight") return { ok: false, msg: "当前不在精英战斗中。" };
    var player = this._findPlayer(ctx.player.userId);
    if (!player || !player.alive) return { ok: false, msg: "你已经倒下了。" };
    if (this.elitePhase === "solo" && this.eliteTargetPlayer.userId !== player.userId) {
      return { ok: false, msg: "这是 " + this.eliteTargetPlayer.name + " 的遭遇战，只有Ta能战斗。" };
    }

    var monster = this.eliteMonster;
    var atk = getEffectiveAttack(player);
    var dmg = Math.max(1, atk + getRandomInt(-1, 3));

    // 特长：战斗直觉暴击
    if (player._critBonus && Math.random() < player._critBonus) {
      dmg = Math.floor(dmg * 1.5);
    }
    // 特长：精英怪额外伤害
    if (player._eliteBonus && this.elitePhase === "elite") {
      dmg = Math.floor(dmg * (1 + player._eliteBonus));
    }
    // 特长：战血（击杀数加成）
    if (player._warBlood > 0) {
      dmg += player._warBlood;
    }

    monster.hp -= dmg;
    player.totalDamage += dmg;
    var msg = "⚔️ " + player.name + " 攻击了 " + monster.icon + " " + monster.name + "！造成 " + dmg + " 点伤害！";
    msg += "\n❤️ " + monster.name + " HP：" + Math.max(0, monster.hp) + "/" + monster.maxHp;

    // 怪物死亡
    if (monster.hp <= 0) {
      monster.hp = 0;
      msg += "\n\n🏆 " + monster.name + " 被击败了！";
      if (player._warBlood !== undefined) player._warBlood++;
      // 发放奖励
      var reward = monster.reward;
      var rewardMsg = "";
      if (reward.money) { addMoney(ctx, reward.money); rewardMsg += "\n💰 获得 " + reward.money + " 金钱"; }
      if (reward.attack) { player.attack += reward.attack; player.attack = Math.max(1, player.attack); rewardMsg += "\n⚔️ 攻击力 +" + reward.attack; }
      if (reward.defense) { player.defense += reward.defense; rewardMsg += "\n🛡️ 防御力 +" + reward.defense; }
      if (reward.crystal) { addCrystal(ctx, reward.crystal); rewardMsg += "\n💎 获得 " + reward.crystal + " 水晶"; }
      if (reward.item) {
        var existing = player.items.find(function(i) { return i.id === reward.item; });
        if (existing) existing.count += reward.count || 1;
        else player.items.push({ id: reward.item, count: reward.count || 1 });
        rewardMsg += "\n🧪 获得 " + reward.item + " x" + (reward.count || 1);
      }
      if (rewardMsg) msg += rewardMsg;
      // 信物掉落
      if (monster.relicDrop && !this.teamRelics) this.teamRelics = [];
      if (monster.relicDrop) {
        var relicInfo = monster.relicDrop;
        if (!this.teamRelics.find(function(r) { return r.id === relicInfo.id; })) {
          this.teamRelics.push({ id: relicInfo.id, name: relicInfo.name, icon: relicInfo.icon, desc: relicInfo.desc });
          msg += "\n\n✦️ 【信物掉落】" + relicInfo.icon + " " + relicInfo.name;
          msg += "\n  " + relicInfo.desc;
          msg += "\n  已收集信物：" + this.teamRelics.map(function(r) { return r.icon + r.name; }).join("、");
        } else {
          msg += "\n（该信物已收集过）";
        }
      }
      // 结束精英战斗，返回探索
      this.eliteMonster = null;
      this.eliteTargetPlayer = null;
      this.elitePhase = "";
      this.phase = "prepare";
      msg += "\n\n✦️ 第 " + (this.prepRound + 1) + " 轮战斗结束，继续探索！\n";
      msg += "轮到 " + (this.players[this.currentPlayerIdx] ? this.players[this.currentPlayerIdx].name : "?") + " 行动。";
      this._save();
      return { ok: true, msg: msg };
    }

    // 怪物反击
    msg += "\n\n" + monster.icon + " " + monster.name + " 的反击！";
    if (this.elitePhase === "solo") {
      var target = this.eliteTargetPlayer;
      var eDmg = Math.max(1, monster.attack + getRandomInt(-1, 2));
      // 闪避
      if (target._dodgeChance && Math.random() < target._dodgeChance) {
        msg += "\n💨 " + target.name + " 敏捷地闪避了攻击！";
      } else {
        // 防御减免
        var def = target.defense;
        if (target._survivalActive && target.hp / target.maxHp < 0.3) def += 5;
        eDmg = Math.max(1, eDmg - Math.floor(def / 3));
        target.hp -= eDmg;
        if (target.hp <= 0) { target.hp = 1; }  // 遭遇战不致死
        msg += "\n👊 " + target.name + " 受到 " + eDmg + " 点伤害！（HP " + target.hp + "/" + target.maxHp + "）";
      }
    } else {
      // 精英战：随机点名
      var aliveTargets = this.players.filter(function(p) { return p.alive && p.hp > 0; });
      var target = pickRandom(aliveTargets);
      var eDmg = Math.max(1, monster.attack + getRandomInt(-1, 2));
      if (target._dodgeChance && Math.random() < target._dodgeChance) {
        msg += "\n💨 " + target.name + " 敏捷地闪避了攻击！";
      } else {
        var def = target.defense;
        if (target._survivalActive && target.hp / target.maxHp < 0.3) def += 5;
        eDmg = Math.max(1, eDmg - Math.floor(def / 3));
        target.hp -= eDmg;
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          msg += "\n💀 " + target.name + " 被击败了！";
        } else {
          msg += "\n👊 " + target.name + " 受到 " + eDmg + " 点伤害！（HP " + target.hp + "/" + target.maxHp + "）";
        }
      }
      // 全员阵亡检查
      if (this.players.filter(function(p) { return p.alive; }).length === 0) {
        msg += "\n\n💀 全员阵亡……远征失败。";
        this.eliteMonster = null;
        this.elitePhase = "";
        this.phase = "";
        this.status = "settlement";
        this._save();
        return { ok: true, msg: msg };
      }
    }
    this._save();
    return { ok: true, msg: msg };
  }

  // 精英怪反击（供技能和道具使用后调用）
  _eliteCounterAttack(ctx) {
    var monster = this.eliteMonster;
    if (!monster || monster.hp <= 0) return null;
    var msg = "\n\n" + monster.icon + " " + monster.name + " 的反击！";
    if (this.elitePhase === "solo") {
      var target = this.eliteTargetPlayer;
      var eDmg = Math.max(1, monster.attack + getRandomInt(-1, 2));
      if (target._dodgeChance && Math.random() < target._dodgeChance) {
        msg += "\n💨 " + target.name + " 敏捷地闪避了攻击！";
      } else {
        var def = target.defense;
        if (target._survivalActive && target.hp / target.maxHp < 0.3) def += 5;
        eDmg = Math.max(1, eDmg - Math.floor(def / 3));
        target.hp -= eDmg;
        if (target.hp <= 0) { target.hp = 1; }
        msg += "\n👊 " + target.name + " 受到 " + eDmg + " 点伤害！（HP " + target.hp + "/" + target.maxHp + "）";
      }
    } else {
      var aliveTargets = this.players.filter(function(p) { return p.alive && p.hp > 0; });
      if (aliveTargets.length === 0) return msg;
      var target = pickRandom(aliveTargets);
      var eDmg = Math.max(1, monster.attack + getRandomInt(-1, 2));
      if (target._dodgeChance && Math.random() < target._dodgeChance) {
        msg += "\n💨 " + target.name + " 敏捷地闪避了攻击！";
      } else {
        var def = target.defense;
        if (target._survivalActive && target.hp / target.maxHp < 0.3) def += 5;
        eDmg = Math.max(1, eDmg - Math.floor(def / 3));
        target.hp -= eDmg;
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          msg += "\n💀 " + target.name + " 被击败了！";
        } else {
          msg += "\n👊 " + target.name + " 受到 " + eDmg + " 点伤害！（HP " + target.hp + "/" + target.maxHp + "）";
        }
      }
      if (this.players.filter(function(p) { return p.alive; }).length === 0) {
        msg += "\n\n💀 全员阵亡……远征失败。";
        this.eliteMonster = null;
        this.elitePhase = "";
        this.phase = "";
        this.status = "settlement";
        this._save();
        return msg;
      }
    }
    this._save();
    return msg;
  }

  _startBossFight() {
    this.status = "fighting";
    this.phase = "fight";
    this.bossStage++;

    const stageData = BOSS_STAGES[Math.min(this.bossStage - 1, BOSS_STAGES.length - 1)];
    const template = pickRandom(stageData.bossPool);

    const aliveCount = this.players.filter(function(p) { return p.alive; }).length;
    const hpScale = 1 + (aliveCount - 1) * 0.4 + (this.bossStage - 1) * 0.3;
    const atkScale = 1 + (aliveCount - 1) * 0.25 + (this.bossStage - 1) * 0.2;

    this.boss = {
      name: template.name,
      desc: template.desc,
      icon: template.icon || "👹",
      hp: Math.floor(template.baseHp * hpScale),
      maxHp: Math.floor(template.baseHp * hpScale),
      attack: Math.floor(template.baseAtk * atkScale),
      defense: Math.floor((template.baseDef || 0) * (1 + (this.bossStage - 1) * 0.2)),
      skills: template.skills,
    };

    // 重置战斗状态
    this.turnOrder = this.players.filter(function(p) { return p.alive; }).map(function(p) { return p.userId; });
    this.bossTurnCount = 0;
    this.playerActionsThisRound = 0;
    this.fightRound = 0;
    this.bossSkillActive = {};

    // 重置玩家战斗临时状态
    for (const p of this.players) {
      p.alive = p.hp > 0;
      p.skipNext = false;
      p.skillCooldowns = {};
      p._taunting = false;
      p._shadowStep = 0;
      p._thornsActive = false;
      p._lastStandUsed = false;
      // 重置战斗临时buff
      p._warCryBonus = 0;
      p._atkPotionBuff = false;
      p._atkBuff = 0;
      p._dmgBoost = 0;
      p._critPotionBuff = 0;
      p._ironWallShield = 0;
      p._ironWallDuration = 0;
      p._blessing = 0;
      p._defBuff = 0;
      p._vampiricTurns = 0;
      p._reverseActive = false;
      p._foolDodge = false;
      p._foolCritNext = false;
      p._extraTurns = 0;
      p._tauntAtkBuff = 0;
      // 战士战意狂潮：HP分半为血盾
      if (p.alive && p.classId === "warrior" && p.hp > 1) {
        var shieldHalf = Math.floor(p.hp / 2);
        p._warriorShieldHP = shieldHalf;
        p.hp = p.hp - shieldHalf;
      } else {
        p._warriorShieldHP = 0;
      }
    }

    this._save();

    this._bossIntroMsg = "";
    if (this.bossStage > 1) {
      this._bossIntroMsg += "✦️ 进入第 " + this.bossStage + " 关 ✦️\n\n";
    }
    this._bossIntroMsg += "╔══════════════════════════╗\n";
    this._bossIntroMsg += "║    ⚔️ 远征阶段 · BOSS 战 ⚔️    ║\n";
    this._bossIntroMsg += "╚══════════════════════════╝\n\n";
    this._bossIntroMsg += (this.boss.icon || "👹") + " " + this.boss.name + " 出现了！\n";
    this._bossIntroMsg += this.boss.desc + "\n\n";
    this._bossIntroMsg += "❤️ " + this.boss.name + " HP：" + this.boss.hp + "/" + this.boss.maxHp;
    this._bossIntroMsg += "  ⚔️ 攻击力：" + this.boss.attack + "  🛡️ 防御力：" + this.boss.defense + "\n\n";

    this._bossIntroMsg += "📋 队伍状态：\n";
    for (const p of this.players) {
      const cls = CLASSES[p.classId];
      const itemsStr = p.items.map(function(i) { return i.id + "x" + i.count; }).join(", ") || "无";
      this._bossIntroMsg += "  " + (p.alive ? cls.icon : "💀") + " " + p.name;
      if (!p.alive) { this._bossIntroMsg += "（已倒下）\n"; continue; }
      this._bossIntroMsg += " HP " + p.hp + "/" + p.maxHp;
      if (p.classId === "warrior" && p._warriorShieldHP > 0) {
        this._bossIntroMsg += " 🛡️血盾:" + p._warriorShieldHP;
      }
      this._bossIntroMsg += "  ⚔️" + getEffectiveAttack(p) + " 🛡️" + p.defense;
      this._bossIntroMsg += "  [" + cls.name + "]  道具：" + itemsStr;
      // 显示额外技能
      if (p._extraSkills && p._extraSkills.length > 0) {
        this._bossIntroMsg += "\n    额外技能：" + p._extraSkills.map(function(s) { return s.icon + s.name; }).join("、");
      }
      this._bossIntroMsg += "\n";
    }

    this._bossIntroMsg += "\n战斗开始！\n";
    this._bossIntroMsg += "指令：" + EXPEDITION.CMD_PREFIX + "攻击 / " + EXPEDITION.CMD_PREFIX + "技能 / " + EXPEDITION.CMD_PREFIX + "治疗 <名> / " + EXPEDITION.CMD_PREFIX + "使用 <道具> / " + EXPEDITION.CMD_PREFIX + "跳过\n";
    const firstAlive = this.players.find(function(p) { return p.alive; });
    this._bossIntroMsg += "轮到 " + (firstAlive ? firstAlive.name : "?") + " 行动。";
  }

  // ---------- BOSS 战核心 ----------

  // 战士血盾：BOSS战中治疗优先恢复血盾
  _healPlayer(player, amount) {
    if (!player || !player.alive || amount <= 0) return 0;
    if (player.classId === "warrior" && this.status === "fighting" && player._warriorShieldHP !== undefined && player._warriorShieldHP >= 0) {
      player._warriorShieldHP += amount;
      return amount;
    }
    var actual = Math.min(amount, player.maxHp - player.hp);
    player.hp += actual;
    return actual;
  }

  _getCurrentTurnPlayer() {
    const alive = this.players.filter(function(p) { return p.alive; });
    if (alive.length === 0) return null;

    // 优先处理_extraTurns（拉条机制）
    for (const p of alive) {
      if (p._extraTurns && p._extraTurns > 0) {
        return {
          player: p,
          skippedMsg: "📯 " + p.name + " 获得额外行动机会！"
        };
      }
    }

    let skippedNames = [];
    // 最多扫描 players.length 次，防止死循环
    for (let i = 0; i < this.players.length; i++) {
      const idx = this.bossTurnCount % this.turnOrder.length;
      const userId = this.turnOrder[idx];
      const player = this.players.find(function(p) { return p.userId === userId; });
      if (!player) { this.bossTurnCount++; continue; }

      if (!player.alive) {
        this.bossTurnCount++;
        continue;
      }

      if (player.skipNext) {
        player.skipNext = false;
        skippedNames.push(player.name);
        this.playerActionsThisRound++;
        this.bossTurnCount++;
        continue;
      }

      return {
        player: player,
        skippedMsg: skippedNames.length > 0 ? skippedNames.map(function(n) { return "💫 " + n + " 无法行动，自动跳过。"; }).join("\n") : ""
      };
    }

    // 所有存活玩家都已行动完毕 → 标记轮结束，由 _advanceBossTurn 统一处理
    // 不在这里触发 BOSS 行动，避免与 _advanceBossTurn 重复
    return { player: null, allDone: true, skippedMsg: skippedNames.length > 0 ? skippedNames.map(function(n) { return "💫 " + n + " 无法行动，自动跳过。"; }).join("\n") : "" };
    return null;
  }

  // 减少 CD 统一方法（一轮结束时全体减 1）
  _reduceCooldowns(player) {
    for (const sid of Object.keys(player.skillCooldowns)) {
      player.skillCooldowns[sid]--;
      if (player.skillCooldowns[sid] <= 0) delete player.skillCooldowns[sid];
    }
  }

  // 通用行动验证
  _validateAction(ctx, expectAlive) {
    var isElite = this.phase === "eliteFight";
    if (this.status !== "fighting" && !isElite) return { ok: false, msg: "当前不在战斗阶段。" };
    if (this.phase !== "fight" && !isElite) return { ok: false, msg: "当前无法操作。" };

    const player = this._findPlayer(ctx.player.userId);
    if (!player) return { ok: false, msg: "你不在这个远征队中。" };
    if (expectAlive && !player.alive) return { ok: false, msg: "你已经倒下了。" };

    // 精英战斗跳过回合检查（实时攻击模式）
    if (isElite) {
      return { ok: true, player: player };
    }
    const turnInfo = this._getCurrentTurnPlayer();
    if (!turnInfo || turnInfo.allDone) {
      if (this.players.filter(function(p) { return p.alive; }).length === 0) {
        this.status = "settlement";
        this.phase = "failed";
        this._save();
        return { ok: true, msg: "💀 全员阵亡……远征失败。" };
      }
      return { ok: false, msg: "当前轮次异常，请再次发送命令。" };
    }

    if (turnInfo.player.userId !== player.userId) {
      let skipMsg = turnInfo.skippedMsg ? turnInfo.skippedMsg + "\n\n" : "";
      return { ok: false, msg: skipMsg + "还没轮到你。当前轮到 " + turnInfo.player.name + " 行动。" };
    }

    const nowTime = now();
    if (player._lastActionTime && nowTime - player._lastActionTime < EXPEDITION.ACTION_COOLDOWN) {
      const wait = Math.ceil((EXPEDITION.ACTION_COOLDOWN - (nowTime - player._lastActionTime)) / 1000);
      return { ok: false, msg: "操作太频繁，请等 " + wait + " 秒。" };
    }
    player._lastActionTime = nowTime;

    return { ok: true, player: player };
  }

  // 统一结算：推进回合 + 被动 + debuff + 胜负检查
  _finishAction(msg, ctx) {
    // 防御：非BOSS战斗阶段不执行BOSS回合推进
    if (this.phase !== "fight") return msg;
    this._advanceBossTurn();

    const passiveMsg = this._triggerPassives(ctx);
    if (passiveMsg) msg += passiveMsg;
    const burnMsg = this._tickBossDebuffs();
    if (burnMsg) msg += burnMsg;
    this._tickPlayerBuffs();

    // 将本次行动消息存入buffer
    this._roundMsgBuffer.push(msg);
    // 将BOSS行动消息存入buffer
    if (this._bossActionMsg) {
      this._roundMsgBuffer.push(this._bossActionMsg);
      this._bossActionMsg = "";
    }

    if (this.players.filter(function(p) { return p.alive; }).length === 0) {
      var failMsg = "\n\n💀 全员阵亡……远征失败。\n\n💡 远征已结束，记得发送「" + EXPEDITION.CMD_PREFIX + "退出」离开房间！";
      this._roundMsgBuffer.push(failMsg);
      this.status = "settlement";
      this.phase = "failed";
      this._roundComplete = true;
      this._save();
      return msg;
    }

    if (this.boss && this.boss.hp <= 0) {
      this.boss.hp = 0;
      var killMsg = "\n\n" + this.boss.name + " 被击败了！！！";
      // 刺客夺命追击：击杀BOSS时恢复全体20%最大HP
      var player = this._findPlayer(ctx.player.userId);
      if (player && (player.classId === "assassin" || (player.classId === "fool" && player._foolCurrentPassive === "assassin"))) {
        var healMsg = "🗡️【夺命追击】" + player.name + " 完成收割！全体恢复 20% 最大HP！";
        for (const p of this.players) {
          if (p.alive) {
            var hAmt = Math.floor(p.maxHp * 0.2);
            this._healPlayer(p, hAmt);
            healMsg += "\n  " + p.name + " +" + hAmt + " HP";
          }
        }
        killMsg += "\n" + healMsg;
      }
      this._roundMsgBuffer.push(killMsg);
      this._roundMsgBuffer.push(this._advanceToNextBoss(ctx));
      this._roundComplete = true;
      this._save();
      return msg;
    }

    // 检查是否整轮结束（BOSS已行动）
    if (this.playerActionsThisRound === 0 && this._roundMsgBuffer.length > 0) {
      // 整轮结束，添加状态摘要
      var summary = "\n━━━━━━━━━━━━━━━━━━━━━━━━\n";
      summary += "📊 第" + this.fightRound + "回合结束\n";
      if (this.boss && this.boss.hp > 0) {
        summary += (this.boss.icon||"👹") + this.boss.name + " HP:" + Math.max(0,this.boss.hp) + "/" + this.boss.maxHp + "\n";
      }
      for (const p of this.players) {
        if (p.alive) {
          summary += p.name + " HP:" + p.hp + "/" + p.maxHp;
          if (p.classId === "warrior" && p._warriorShieldHP > 0) summary += " 🛡️" + p._warriorShieldHP;
          summary += "\n";
        }
      }
      summary += "━━━━━━━━━━━━━━━━━━━━━━━━";
      this._roundMsgBuffer.push(summary);
      this._roundComplete = true;
      this._save();
      return msg;
    }

    // 还有后续玩家行动
    const nextTurnInfo = this._getCurrentTurnPlayer();
    if (nextTurnInfo && nextTurnInfo.player) {
      if (nextTurnInfo.skippedMsg) this._roundMsgBuffer.push(nextTurnInfo.skippedMsg);
      msg += "\n\n⏳ 轮到 " + nextTurnInfo.player.name + " 行动。";
    }
    this._save();
    return msg;
  }

  // 合并并清空本轮消息buffer
  _flushRoundMsg() {
    if (!this._roundMsgBuffer || this._roundMsgBuffer.length === 0) return "";
    var fullMsg = this._roundMsgBuffer.join("\n\n");
    this._roundMsgBuffer = [];
    this._roundComplete = false;
    this._save();
    return fullMsg;
  }

  // 构建战斗状态图片数据
  _buildStatusImageData() {
    var data = {
      room_id: this.roomId,
      stage: this.status,
      boss_stage: this.bossStage,
      max_bosses: EXPEDITION.MAX_BOSSES,
      fight_round: this.fightRound,
      turn_player: "",
      boss: null,
      players: []
    };
    // 当前行动玩家
    var turnInfo = this._getCurrentTurnPlayer();
    if (turnInfo && turnInfo.player) data.turn_player = turnInfo.player.name;
    // BOSS信息
    if (this.boss && this.status === "fighting") {
      data.boss = {
        name: this.boss.name,
        icon: this.boss.icon || "👹",
        hp: Math.max(0, this.boss.hp),
        max_hp: this.boss.maxHp,
        attack: this.boss.attack,
        defense: this.boss.defense || 0
      };
    }
    // 玩家信息
    for (const p of this.players) {
      var cls = CLASSES[p.classId] || { icon: "?" };
      var buffs = [];
      if (p._shadowStep > 0) buffs.push("影步" + p._shadowStep);
      if (p._taunting) buffs.push("嘲讽" + p._tauntDuration);
      if (p._ironWallShield > 0) buffs.push("护盾" + p._ironWallShield);
      if (p._vampiricTurns > 0) buffs.push("吸血" + p._vampiricTurns);
      if (p._atkBuff > 0) buffs.push("强化" + p._atkBuff);
      if (p._blessing > 0) buffs.push("祝福");
      var skillsCd = [];
      if (cls.skills) {
        for (const sk of cls.skills) {
          var cd = p.skillCooldowns[sk.id] || 0;
          skillsCd.push({ name: sk.name, cd: cd });
        }
      }
      if (p._extraSkills) {
        for (const es of p._extraSkills) {
          var ecd = p.skillCooldowns[es.id] || 0;
          skillsCd.push({ name: es.name, cd: ecd });
        }
      }
      data.players.push({
        name: p.name,
        class_id: p.classId,
        class_name: p.className || "未选职",
        icon: cls.icon,
        hp: Math.max(0, p.hp),
        max_hp: p.maxHp,
        attack: getEffectiveAttack(p),
        defense: p.defense + (p._defBuff || 0),
        alive: p.alive,
        shield: p._warriorShieldHP || 0,
        buffs: buffs,
        skills_cd: skillsCd
      });
    }
    return data;
  }

  // 构建回合合并输出图片数据
  _buildRoundImageData() {
    var data = {
      room_id: this.roomId,
      fight_round: this.fightRound,
      boss_stage: this.bossStage,
      messages: this._roundMsgBuffer || [],
      boss: null,
      players: []
    };
    if (this.boss) {
      data.boss = {
        name: this.boss.name,
        icon: this.boss.icon || "👹",
        hp: Math.max(0, this.boss.hp),
        max_hp: this.boss.maxHp
      };
    }
    for (const p of this.players) {
      data.players.push({
        name: p.name,
        hp: Math.max(0, p.hp),
        max_hp: p.maxHp,
        alive: p.alive,
        shield: p._warriorShieldHP || 0
      });
    }
    return data;
  }

  // 攻击
  attack(ctx) {
    const v = this._validateAction(ctx, true);
    if (!v.ok) return { ok: false, msg: v.msg };
    const player = v.player;

    var atk = getEffectiveAttack(player);
    // 战士战意狂潮：HP每降低10点攻击力+15%
    if (player.classId === "warrior" || player._foolCurrentPassive === "warrior") {
      var hpLost = player.maxHp - player.hp;
      var warriorBonus = Math.floor(hpLost / 10) * 0.15;
      if (warriorBonus > 0) atk = Math.floor(atk * (1 + warriorBonus));
    }
    // 刺客夺命追击：BOSS HP每降低10%攻击力+8%
    if (player.classId === "assassin" || player._foolCurrentPassive === "assassin") {
      if (this.boss) {
        var bossLossRatio = 1 - (this.boss.hp / this.boss.maxHp);
        var assassinBonus = Math.floor(bossLossRatio * 10) * 0.08;
        if (assassinBonus > 0) atk = Math.floor(atk * (1 + assassinBonus));
      }
    }
    const baseDmg = atk + getRandomInt(0, 4);

    let critChance = 0.15;
    var assassinCritMult = 2;
    if (player.classId === "assassin" || player._foolCurrentPassive === "assassin") {
      assassinCritMult = 2.5;
      // BOSS HP每降低10%暴击率+5%
      if (this.boss) {
        var bossHpLoss = 1 - (this.boss.hp / this.boss.maxHp);
        critChance += Math.floor(bossHpLoss * 10) * 0.05;
      }
    }
    // 鹰眼药水加成
    if (player._critPotionBuff && player._critPotionBuff > 0) {
      critChance += 0.3;
      player._critPotionBuff--;
    }
    let isCrit = false;
    let shadowStepActive = false;
    if (player._shadowStep > 0) {
      isCrit = true;
      shadowStepActive = true;
      player._shadowStep = 0;
      assassinCritMult = 5; // 影步暴击固定5倍
    } else if (player._foolCritNext) {
      isCrit = true;
      player._foolCritNext = false;
    } else if (player._critGuaranteed > 0) {
      isCrit = true;
    } else {
      isCrit = Math.random() < critChance;
    }

    let atkForCalc = baseDmg;
    // 伤害增益倍率
    if (player._dmgBoost > 0) { atkForCalc = Math.floor(atkForCalc * 1.3); }
    let actualDmg = isCrit ? Math.floor(atkForCalc * assassinCritMult) : atkForCalc;

    // 合成兽免疫：免疫一次玩家攻击（优先于护盾和脆弱消耗）
    if (this.bossSkillActive["synthImmune"]) {
      this.bossSkillActive["synthImmune"] = false;
      let immuneMsg = "🛡️ " + this.boss.name + " 合成兽免疫了本次攻击！";
      immuneMsg += "\n❤️ " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp;
      // 免疫后仍需推进回合
      this._finishAction(immuneMsg, ctx);
      return { ok: true, msg: immuneMsg, roundComplete: this._roundComplete || false };
    }
    // 重击无视护盾但 execute 里已直接扣血，这里只处理普攻
    if (this.bossSkillActive["shield"] && this.bossSkillActive["shield"] > 0) {
      actualDmg = Math.floor(actualDmg / 2);
      this.bossSkillActive["shield"]--;
    }

    // 脆弱增伤
    if (this.boss._vulnerable) {
      actualDmg = Math.floor(actualDmg * 1.5);
      this.boss._vulnerable = false;
    }

    // 诡异吼叫减伤
    var weirdHowlMsg = "";
    if (this.bossSkillActive["weirdHowl"]) {
      actualDmg = Math.max(1, Math.floor(actualDmg / 2));
      this.bossSkillActive["weirdHowl"] = false;
      weirdHowlMsg = "\n🔊 " + this.boss.name + " 诡异吼叫减伤！攻击伤害减半！";
    }
    // BOSS防御减伤
    if (this.boss.defense > 0) {
      var defReduction = Math.min(this.boss.defense, Math.floor(actualDmg * 0.5));
      actualDmg = Math.max(1, actualDmg - defReduction);
    }
    actualDmg = Math.max(1, actualDmg);
    this.boss.hp -= actualDmg;
    player.totalDamage += actualDmg;

    let msg = "⚔️ " + player.name + " 对 " + this.boss.name + " 造成了 " + actualDmg + " 点伤害！";
    msg += weirdHowlMsg;
    if (isCrit) msg += "（暴击！）";
    msg += "\n❤️ " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp;

    // 吸血效果
    if (player._vampiricTurns > 0) {
      var vampHeal = Math.floor(actualDmg * 0.5);
      this._healPlayer(player, vampHeal);
      player._vampiricTurns--;
      msg += "\n🩸 吸血效果触发！回复 " + vampHeal + " HP（剩余 " + player._vampiricTurns + " 回合）";
    }

    // 连击被动
    if (!player._comboTriggered && (player._extraSkills || []).find(function(s) { return s.id === "bookCombo"; })) {
      if (Math.random() < 0.25) {
        const comboDmg = Math.max(1, getEffectiveAttack(player) + getRandomInt(0, 3));
        if (this.boss._vulnerable) {
          this.boss._vulnerable = false;
          var cDmg = Math.floor(comboDmg * 1.5);
        } else {
          var cDmg = comboDmg;
        }
        this.boss.hp -= cDmg;
        player.totalDamage += cDmg;
        player._comboTriggered = true;
        msg += "\n📖 【连击】触发！额外造成 " + cDmg + " 点伤害！";
        msg += "\n❤️ " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp;
      }
    }

    if (this.boss.hp <= 0) {
      this.boss.hp = 0;
      msg += "\n\n" + this.boss.name + " 被击败了！！！";
      // 刺客夺命追击：击杀BOSS时恢复全体20%最大HP
      if (player.classId === "assassin" || (player.classId === "fool" && player._foolCurrentPassive === "assassin")) {
        var aHealMsg = "🗡️【夺命追击】" + player.name + " 完成收割！全体恢复 20% 最大HP！";
        for (const p of this.players) {
          if (p.alive) {
            var hAmt = Math.floor(p.maxHp * 0.2);
            this._healPlayer(p, hAmt);
            aHealMsg += "\n  " + p.name + " +" + hAmt + " HP";
          }
        }
        msg += "\n" + aHealMsg;
      }
      this._roundMsgBuffer = this._roundMsgBuffer || [];
      this._roundMsgBuffer.push(msg);
      this._roundMsgBuffer.push(this._advanceToNextBoss(ctx));
      this._roundComplete = true;
      this._save();
      return { ok: true, msg: msg, roundComplete: true };
    }

    this._finishAction(msg, ctx);
    return { ok: true, msg: msg, roundComplete: this._roundComplete || false };
  }

  // 使用技能（职业技能 + 通用技能书）
  useSkill(ctx, skillIdOrName) {
    const v = this._validateAction(ctx, true);
    if (!v.ok) return { ok: false, msg: v.msg };
    const player = v.player;

    const cls = CLASSES[player.classId];
    let skill = null;
    let skillCooldowns = player.skillCooldowns;

    // 先在职业技能中找
    if (cls) {
      skill = cls.skills.find(function(s) { return s.id === skillIdOrName || s.name === skillIdOrName; });
      if (!skill) {
        skill = cls.skills.find(function(s) { return s.name.indexOf(skillIdOrName) >= 0 || skillIdOrName.indexOf(s.name) >= 0; });
      }
    }

    // 再在额外技能书中找
    if (!skill && player._extraSkills) {
      for (const es of player._extraSkills) {
        if (es.id === skillIdOrName || es.name === skillIdOrName || es.name.indexOf(skillIdOrName) >= 0 || skillIdOrName.indexOf(es.name) >= 0) {
          skill = UNIVERSAL_SKILLBOOKS.find(function(b) { return b.id === es.id; });
          break;
        }
      }
    }

    if (!skill) {
      let info = "未找到技能。";
      if (cls) {
        info += "职业技能：" + cls.skills.map(function(s) { return s.icon + s.name; }).join("、");
      }
      if (player._extraSkills && player._extraSkills.length > 0) {
        info += "\n技能书：" + player._extraSkills.map(function(s) { return s.icon + s.name; }).join("、");
      }
      return { ok: false, msg: info };
    }

    // 冷却检查
    const cd = player.skillCooldowns[skill.id] || 0;
    if (cd > 0) return { ok: false, msg: "【" + skill.name + "】冷却中，还需 " + cd + " 轮。" };

    // 设置冷却
    player.skillCooldowns[skill.id] = skill.maxCd;

    // 执行技能
    var skillTarget = this.phase === "eliteFight" ? this.eliteMonster : this.boss;
    const result = skill.execute(this, ctx, player, skillTarget);

    // 合成兽免疫：技能攻击也被免疫（BOSS战时）
    if (this.bossSkillActive["synthImmune"] && result.dmg && result.dmg > 0 && skillTarget === this.boss) {
      this.bossSkillActive["synthImmune"] = false;
      var immuneSkillMsg = "🛡️ " + this.boss.name + " 合成兽免疫了本次技能攻击！\n❤️ " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp;
      result.msg = immuneSkillMsg;
      result.dmg = 0;
    }

    // 祭司复苏之风：施放技能后全体额外恢复最大HP 5%
    if (player.classId === "healer" || (player.classId === "fool" && player._foolCurrentPassive === "healer")) {
      var priestHealMsg = "\n✨️【复苏之风】祭司施放技能后全体恢复 5% 最大HP！";
      for (const p of this.players) {
        if (p.alive && p.hp < p.maxHp) {
          var phAmt = Math.floor(p.maxHp * 0.05);
          var actualHeal = this._healPlayer(p, phAmt);
          if (actualHeal > 0) {
            player.totalHeal += actualHeal;
            priestHealMsg += "\n  " + p.name + " +" + actualHeal + " HP";
          }
        }
      }
      result.msg += priestHealMsg;
    }

    // 法师特性：所有技能伤害 +60%，每本技能书额外 +10%
    if ((player.classId === "mage" || (player.classId === "fool" && player._foolCurrentPassive === "mage")) && result.dmg && result.dmg > 0 && skillTarget && skillTarget.hp > 0) {
      var numBooks = (player._extraSkills || []).length;
      var mageBonusMult = 0.6 + 0.1 * numBooks;
      var bonusDmg = Math.max(1, Math.floor(result.dmg * mageBonusMult));
      skillTarget.hp -= bonusDmg;
      player.totalDamage += bonusDmg;
      result.msg += "\n🔮【奥术亲和】法师特性追加 " + bonusDmg + " 点技能伤害！（额外 " + Math.floor(60 + numBooks * 10) + "%）";
      result.msg += "\n❤️ " + skillTarget.name + " HP：" + Math.max(0, skillTarget.hp) + "/" + skillTarget.maxHp;
    }

    // BOSS防御减伤（真伤技能跳过）
    if (result.dmg && result.dmg > 0 && !result.trueDamage && skillTarget && skillTarget.hp > 0 && skillTarget.defense > 0) {
      var rawSkillDmg = result.dmg;
      var defReduce = Math.min(skillTarget.defense, Math.floor(rawSkillDmg * 0.5));
      var actualSkillDmg = Math.max(1, rawSkillDmg - defReduce);
      var dmgDiff = rawSkillDmg - actualSkillDmg;
      if (dmgDiff > 0) {
        skillTarget.hp += dmgDiff;
        if (skillTarget.hp > skillTarget.maxHp) skillTarget.hp = skillTarget.maxHp;
        player.totalDamage -= dmgDiff;
        result.msg += "\n🛡️ " + skillTarget.name + " 防御减伤 " + dmgDiff + " 点！";
      }
      result.dmg = actualSkillDmg;
    }

    // 精英战斗：技能对精英怪生效
    if (this.phase === "eliteFight" && skillTarget && skillTarget.hp <= 0) {
      return this.eliteAttack(ctx); // 触发精英怪死亡处理
    }

    if (this.boss && this.boss.hp <= 0) {
      this.boss.hp = 0;
      let msg = result.msg + "\n\n" + this.boss.name + " 被击败了！！！";
      // 刺客夺命追击：击杀BOSS时恢复全体20%最大HP
      if (player.classId === "assassin" || (player.classId === "fool" && player._foolCurrentPassive === "assassin")) {
        var sHealMsg = "🗡️【夺命追击】" + player.name + " 完成收割！全体恢复 20% 最大HP！";
        for (const p of this.players) {
          if (p.alive) {
            var hAmt = Math.floor(p.maxHp * 0.2);
            this._healPlayer(p, hAmt);
            sHealMsg += "\n  " + p.name + " +" + hAmt + " HP";
          }
        }
        msg += "\n" + sHealMsg;
      }
      this._roundMsgBuffer = this._roundMsgBuffer || [];
      this._roundMsgBuffer.push(msg);
      this._roundMsgBuffer.push(this._advanceToNextBoss(ctx));
      this._roundComplete = true;
      this._save();
      return { ok: true, msg: msg, roundComplete: true };
    }

    // 精英战斗：不执行BOSS回合推进
    if (this.phase === "eliteFight") {
      this._save();
      // 精英怪反击
      var eliteCounterMsg = this._eliteCounterAttack(ctx);
      return { ok: true, msg: result.msg + (eliteCounterMsg || "") };
    }

    this._finishAction(result.msg, ctx);
    return { ok: true, msg: result.msg, roundComplete: this._roundComplete || false };
  }

  // 跳过回合
  skip(ctx) {
    const v = this._validateAction(ctx, true);
    if (!v.ok) return { ok: false, msg: v.msg };

    let msg = "⏭ " + v.player.name + " 选择了跳过本回合。";
    // 精英战斗：不执行BOSS回合推进
    if (this.phase === "eliteFight") {
      this._save();
      var eliteCounterMsg = this._eliteCounterAttack(ctx);
      return { ok: true, msg: msg + (eliteCounterMsg || "") };
    }
    this._finishAction(msg, ctx);
    return { ok: true, msg: msg, roundComplete: this._roundComplete || false };
  }

  // 治疗
  heal(ctx, targetUserId) {
    const v = this._validateAction(ctx, true);
    if (!v.ok) return { ok: false, msg: v.msg };
    const player = v.player;

    const potion = player.items.find(function(i) { return i.id === "potion"; });
    if (!potion || potion.count < 1) return { ok: false, msg: "你没有治疗药水。" };

    const target = this._findPlayer(targetUserId);
    if (!target) return { ok: false, msg: "找不到目标玩家。" };
    if (!target.alive) return { ok: false, msg: target.name + " 已经倒下了。" };

    potion.count--;
    if (potion.count <= 0) {
      player.items = player.items.filter(function(i) { return i.count > 0; });
    }
    const healAmt = seal.ext.getIntConfig(ext, "治疗药水回复量");
    target.hp = Math.min(target.maxHp, target.hp + healAmt);
    player.totalHeal += healAmt;

    let msg = "💚 " + player.name + " 使用治疗药水，为 " + target.name + " 恢复 " + healAmt + " HP！";
    msg += "\n" + target.name + " HP：" + target.hp + "/" + target.maxHp;

    // 精英战斗：不执行BOSS回合推进
    if (this.phase === "eliteFight") {
      this._save();
      var eliteCounterMsg = this._eliteCounterAttack(ctx);
      return { ok: true, msg: msg + (eliteCounterMsg || "") };
    }
    this._finishAction(msg, ctx);
    return { ok: true, msg: msg, roundComplete: this._roundComplete || false };
  }

  // 使用道具
  useItem(ctx, itemId, targetUserId) {
    const v = this._validateAction(ctx, true);
    if (!v.ok) return { ok: false, msg: v.msg };
    const player = v.player;

    const item = player.items.find(function(i) { return i.id === itemId; });
    if (!item || item.count < 1) return { ok: false, msg: "你没有这个道具。" };

    let msg = "";
    switch (itemId) {
      case "bigPotion":
      case "potion": {
        let target = player;
        if (targetUserId) {
          const found = this._findPlayer(targetUserId);
          if (found && found.alive) target = found;
        }
        item.count--;
        if (item.count <= 0) {
          player.items = player.items.filter(function(i) { return i.count > 0; });
        }
        const _bigHeal = seal.ext.getIntConfig(ext, "大药水回复量");
        const _smHeal = seal.ext.getIntConfig(ext, "治疗药水回复量");
        const healAmt = itemId === "bigPotion" ? _bigHeal : _smHeal;
        var actualHeal = this._healPlayer(target, healAmt);
        player.totalHeal += actualHeal;
        const name = itemId === "bigPotion" ? "大治疗药水" : "治疗药水";
        msg = target.userId === player.userId
          ? "🧪 " + player.name + " 使用" + name + "，恢复 " + healAmt + " HP！"
          : "💚 " + player.name + " 对 " + target.name + " 使用" + name + "，恢复 " + healAmt + " HP！";
        break;
      }
      case "shield": {
        item.count--;
        if (item.count <= 0) {
          player.items = player.items.filter(function(i) { return i.count > 0; });
        }
        player._shield = (player._shield || 0) + 1;
        msg = "🔰 " + player.name + " 使用护盾，获得 1 层伤害减免。";
        break;
      }
      case "atkPotion": {
        item.count--;
        if (item.count <= 0) {
          player.items = player.items.filter(function(i) { return i.count > 0; });
        }
        player._atkPotionBuff = true;
        msg = "⚔️ " + player.name + " 使用猛力药水！本次BOSS战攻击力 +5！";
        break;
      }
      case "critPotion": {
        item.count--;
        if (item.count <= 0) {
          player.items = player.items.filter(function(i) { return i.count > 0; });
        }
        player._critPotionBuff = 3;
        msg = "🎯 " + player.name + " 使用鹰眼药水！接下来3次攻击暴击率+30%！";
        break;
      }
      case "dotPotion": {
        item.count--;
        if (item.count <= 0) {
          player.items = player.items.filter(function(i) { return i.count > 0; });
        }
        if (!this.boss) { return { ok: false, msg: "当前没有BOSS。" }; }
        if (!this.boss._poisonStacks) this.boss._poisonStacks = 0;
        if (!this.boss._poisonDuration) this.boss._poisonDuration = 0;
        this.boss._poisonStacks = Math.min((this.boss._poisonStacks || 0) + 2, 5);
        this.boss._poisonDuration = Math.max((this.boss._poisonDuration || 0), 3);
        msg = "☠ " + player.name + " 使用剧毒药水！BOSS中毒层数+" + this.boss._poisonStacks + "（持续3回合）！";
        break;
      }
      case "reviveScroll": {
        item.count--;
        if (item.count <= 0) {
          player.items = player.items.filter(function(i) { return i.count > 0; });
        }
        const dead = this.players.filter(function(p) { return !p.alive; });
        if (dead.length === 0) { return { ok: false, msg: "没有需要复活的队友，道具未被消耗。" }; }
        const revTarget = dead[0];
        revTarget.alive = true;
        revTarget.hp = Math.max(1, Math.floor(revTarget.maxHp * 0.3));
        msg = "🌟 " + player.name + " 使用复活卷轴！" + revTarget.name + " 被复活了！（HP " + revTarget.hp + "/" + revTarget.maxHp + "）";
        break;
      }
      case "actionHorn": {
        // 行动号角：消耗自己本回合行动权，让另一名队友额外行动一轮
        let hornTarget = null;
        if (targetUserId) {
          hornTarget = this._findPlayer(targetUserId);
        }
        if (!hornTarget || !hornTarget.alive) {
          // 没有指定目标或目标已倒下，自动选第一个其他存活队友
          const others = this.players.filter(function(p) { return p.alive && p.userId !== player.userId; });
          if (others.length === 0) { return { ok: false, msg: "没有可用的队友作为目标。" }; }
          hornTarget = others[0];
        }
        if (hornTarget.userId === player.userId) {
          return { ok: false, msg: "不能对自己使用行动号角。" };
        }
        item.count--;
        if (item.count <= 0) {
          player.items = player.items.filter(function(i) { return i.count > 0; });
        }
        // 标记目标获得额外行动（通过_extraTurn标志）
        if (!hornTarget._extraTurns) hornTarget._extraTurns = 0;
        hornTarget._extraTurns++;
        msg = "📯 " + player.name + " 吹响行动号角！" + hornTarget.name + " 获得额外行动机会！";
        break;
      }
      default:
        return { ok: false, msg: "这个道具无法在战斗中使用。" };
    }

    // 精英战斗：不执行BOSS回合推进
    if (this.phase === "eliteFight") {
      this._save();
      var eliteCounterMsg = this._eliteCounterAttack(ctx);
      return { ok: true, msg: msg + (eliteCounterMsg || "") };
    }
    this._finishAction(msg, ctx);
    return { ok: true, msg: msg, roundComplete: this._roundComplete || false };
  }

  // ---------- 被动效果处理 ----------

  _triggerPassives(ctx) {
    let passiveMsg = "";
    const healers = this.players.filter(function(p) { return p.alive && (p.classId === "healer" || (p.classId === "fool" && p._foolCurrentPassive === "healer")); });
    for (const healer of healers) {
      let healed = [];
      for (const p of this.players) {
        if (p.alive && p.hp < p.maxHp) {
          // 复苏之风：恢复已损失HP的10%
          const lost = p.maxHp - p.hp;
          const amt = Math.floor(lost * 0.10);
          if (amt > 0) {
            var actualHeal = this._healPlayer(p, amt);
            if (actualHeal > 0) {
              healer.totalHeal += actualHeal;
              healed.push(p.name + "+" + actualHeal);
            }
          }
        }
      }
      if (healed.length > 0) {
        passiveMsg += "\n✨️ " + healer.name + "【复苏之风】" + healed.join(" ");
      }
    }
    // 狂战士战斗意志：仅在自己行动时叠加一层
    if (ctx) {
      const actingBerserker = this._findPlayer(ctx.player.userId);
      if (actingBerserker && actingBerserker.alive && actingBerserker.classId === "berserker") {
        actingBerserker._battleStacks = (actingBerserker._battleStacks || 0) + 1;
        actingBerserker.hp = Math.max(1, actingBerserker.hp - 2);
        passiveMsg += "\n🗡️ " + actingBerserker.name + "【战斗意志】+1 层（当前 " + actingBerserker._battleStacks + " 层，攻击力 +" + (actingBerserker._battleStacks * 2) + "，HP -2）";
      }
    }
    // 愚者混沌共鸣：每回合开始随机获得一个其他职业的被动效果
    const fools = this.players.filter(function(p) { return p.alive && p.classId === "fool"; });
    for (const fool of fools) {
      const classPool = ["warrior", "mage", "healer", "assassin", "tank"];
      const chosen = classPool[Math.floor(Math.random() * classPool.length)];
      fool._foolCurrentPassive = chosen;
      var passiveName = "";
      if (chosen === "warrior") passiveName = "战意狂潮（HP每降低10点攻击力+15%）";
      else if (chosen === "mage") passiveName = "奥术亲和（技能伤害+60%+每本技能书+10%）";
      else if (chosen === "healer") passiveName = "复苏之风（恢复已损失HP 10%+施法后5%）";
      else if (chosen === "assassin") passiveName = "夺命追击（暴击2.5倍+BOSS越残越强+击杀回血）";
      else if (chosen === "tank") passiveName = "不动如山（常驻减伤20%+反伤50%+每回合固定反震）";
      passiveMsg += "\n🤡 " + fool.name + "【混沌共鸣】本回合获得" + passiveName + "！";
    }
    return passiveMsg;
  }

  _tickBossDebuffs() {
    if (!this.boss) return "";
    let msg = "";
    // 巨魔血统回血
    if (this.bossSkillActive["trollRegen"] && this.bossSkillActive["trollRegen"] > 0) {
      var regenAmt = Math.floor(this.boss.maxHp * 0.25);
      this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + regenAmt);
      msg += "\n🩸 巨魔血统恢复 " + regenAmt + " HP！";
      this.bossSkillActive["trollRegen"]--;
      if (this.bossSkillActive["trollRegen"] <= 0) msg += " 巨魔血统结束。";
    }
    // 逆转反击标记清除（已移至_bossAct中BOSS攻击后处理）
    // 灼烧DOT
    if (this.boss._burnStacks && this.boss._burnStacks > 0 && this.boss._burnDuration > 0) {
      const burnDmg = this.boss._burnStacks * 3;
      this.boss.hp -= burnDmg;
      this.boss._burnDuration--;
      msg += "\n☀️ 灼烧发作！" + this.boss.name + " 受到 " + burnDmg + " 点火焰伤害！（剩余 " + this.boss._burnDuration + " 回合）";
      if (this.boss._burnDuration <= 0) {
        this.boss._burnStacks = 0;
        msg += " 灼烧消散。";
      }
    }
    // 中毒DOT
    if (this.boss._poisonStacks && this.boss._poisonStacks > 0 && this.boss._poisonDuration > 0) {
      const poisonDmg = this.boss._poisonStacks * 2;
      this.boss.hp -= poisonDmg;
      this.boss._poisonDuration--;
      msg += "\n☠ 中毒发作！" + this.boss.name + " 受到 " + poisonDmg + " 点毒素伤害！（剩余 " + this.boss._poisonDuration + " 回合）";
      if (this.boss._poisonDuration <= 0) {
        this.boss._poisonStacks = 0;
        msg += " 中毒消散。";
      }
    }
    // 血肉蠕虫DOT
    if (this.bossSkillActive["bloodWorm"] && this.bossSkillActive["bloodWorm"] > 0) {
      var wormTargetId = this.bossSkillActive["bloodWormTarget"];
      var wormTarget = this._findPlayer(wormTargetId);
      if (wormTarget && wormTarget.alive) {
        var wormDmg = Math.max(1, 8 - Math.floor(wormTarget.defense / 2));
        wormTarget.hp -= wormDmg;
        msg += "\n🪱 血肉蠕虫吞噬 " + wormTarget.name + " " + wormDmg + " 点HP！";
        if (wormTarget.hp <= 0) { wormTarget.hp = 0; wormTarget.alive = false; msg += "\n💀 " + wormTarget.name + " 倒下了……"; }
      }
      this.bossSkillActive["bloodWorm"]--;
      if (this.bossSkillActive["bloodWorm"] <= 0) {
        msg += " 血肉蠕虫消散。";
        this.bossSkillActive["bloodWormTarget"] = null;
      }
    }
    // 守卫不动如山：每回合结束对BOSS造成防御力等额的固定伤害
    for (const p of this.players) {
      if (p.alive && p.classId === "tank") {
        var reflectFixed = p.defense + (p._defBuff || 0);
        if (reflectFixed > 0 && this.boss && this.boss.hp > 0) {
          this.boss.hp -= reflectFixed;
          p.totalDamage += reflectFixed;
          msg += "\n🏔️ " + p.name + "【不动如山】反震 " + reflectFixed + " 点伤害给 " + this.boss.name + "！";
        }
      }
    }
    return msg;
  }

  _tickPlayerBuffs() {
    for (const p of this.players) {
      if (!p.alive) continue;
      if (p._ironWallDuration > 0) {
        p._ironWallDuration--;
        if (p._ironWallDuration <= 0) p._ironWallShield = 0;
      }
      // 新buff回合递减
      if (p._defBuff > 0) { p._defBuff--; }
      if (p._atkBuff > 0) { p._atkBuff--; }
      if (p._dmgBoost > 0) { p._dmgBoost--; }
      if (p._critGuaranteed > 0) { p._critGuaranteed--; }
      if (p._defResetTimer > 0) { p._defResetTimer--; if (p._defResetTimer <= 0) p._defResetTimer = 0; }
      // BOSS降攻debuff恢复
      if (p._atkDebuffTurns > 0) {
        p._atkDebuffTurns--;
        if (p._atkDebuffTurns <= 0 && p._atkDebuffStacks > 0) {
          p.attack += p._atkDebuffStacks;
          p._atkDebuffStacks = 0;
        }
      }
      // BOSS降防debuff恢复
      if (p._defDebuffTurns > 0) {
        p._defDebuffTurns--;
        if (p._defDebuffTurns <= 0 && p._defDebuffStacks > 0) {
          p.defense += p._defDebuffStacks;
          p._defDebuffStacks = 0;
        }
      }

    }
  }

  // ---------- BOSS 行动 ----------

  _advanceBossTurn() {
    // 防御：BOSS不存在或已死亡时不执行
    if (!this.boss || this.boss.hp <= 0) return;

    // 检查是否有额外回合（拉条）正在消耗
    var hasExtraTurn = false;
    for (const p of this.players) {
      if (p._extraTurns && p._extraTurns > 0) {
        p._extraTurns--;
        hasExtraTurn = true;
        break;
      }
    }
    if (hasExtraTurn) return; // 额外回合不推进正常回合数

    this.playerActionsThisRound++;
    this.bossTurnCount++;
    // 重置连击标记（每轮只能触发一次）
    for (const p of this.players) { p._comboTriggered = false; }

    const aliveCount = this.players.filter(function(p) { return p.alive; }).length;
    const shouldAct = this.playerActionsThisRound >= aliveCount;
    if (shouldAct) {
      this.playerActionsThisRound = 0;
      this.fightRound++;
      // 【修复】一轮结束时统一减全体 CD
      for (const p of this.players) {
        if (p.alive) this._reduceCooldowns(p);
      }
      this._bossAct();
    }
  }

  _bossAct() {
    // 防御：BOSS不存在或已死亡时不行动
    if (!this.boss || this.boss.hp <= 0) return "";
    let msg = "\n\n" + (this.boss.icon || "👹") + " " + this.boss.name + " 的行动回合——";
    let skillUsed = false; // 标记本轮是否用了技能（区分普攻和技能攻击）

    // 封印检查：被封印时BOSS只能普攻
    if (this.boss._sealed && this.boss._sealed > 0) {
      this.boss._sealed--;
      msg += "\n🔒 " + this.boss.name + " 被封印中（剩余 " + this.boss._sealed + " 回合），只能进行普攻！";
      // 直接跳到普通攻击部分
      const alive = this.players.filter(function(p) { return p.alive; });
      if (alive.length > 0) {
        // BOSS跳过行动检查（优先于debuff消耗）
        if (this.boss._skipNext) {
          this.boss._skipNext = false;
          msg += "\n❄️ " + this.boss.name + " 被冻结，无法行动！";
        } else {
        let target = this._pickBossTarget(alive);
        let dmg = this.boss.attack + getRandomInt(-2, 3);
        if (this.boss._frostDebuff) { dmg = Math.floor(dmg / 2); this.boss._frostDebuff = false; msg += "\n🧊 冰霜减半效果生效！"; }
        // 碎甲锥减半
        if (this.boss._defReset) { dmg = Math.floor(dmg / 2); this.boss._defReset = false; msg += "\n💎 碎甲锥效果生效！伤害减半！"; }
        if (this.boss._weakDebuff) { dmg = Math.floor(dmg * 0.6); this.boss._weakDebuff = false; msg += "\n💨 虚弱效果生效！伤害降低 40%！"; }
        // 愚者小丑步法闪避
        var dodged = !!target._foolDodge || target._shadowStep > 0;
        var dodgeSource = target._foolDodge ? 'fool' : (target._shadowStep > 0 ? 'shadow' : '');
        if (dodged && dodgeSource === 'fool') { target._foolDodge = false; msg += "\n🎪 " + target.name + " 小丑步法闪避了攻击！"; }
        else if (dodged && dodgeSource === 'shadow') { target._shadowStep--; msg += "\n👤 " + target.name + " 影步闪避了攻击！（剩余 " + target._shadowStep + " 回合）"; }
        if (!dodged) {
        // 嘲讽承伤光环：非守卫目标受到攻击时，50%伤害转移给嘲讽守卫
        var taunter = null;
        for (var ti = 0; ti < this.players.length; ti++) {
          var tp = this.players[ti];
          if (tp.alive && tp._taunting && tp._tauntDuration > 0 && tp.classId === "tank") { taunter = tp; break; }
        }
        if (taunter && target.userId !== taunter.userId) {
          // 不动如山：HP低于40%时代承比例提升至70%
          var shareRatio = (taunter.hp / taunter.maxHp) < 0.4 ? 0.7 : 0.5;
          var shareDmg = Math.floor(dmg * shareRatio);
          var reducedDmg = dmg - shareDmg;
          msg += "\n😤 嘲讽光环生效！守卫 " + taunter.name + " 为 " + target.name + " 承受了 " + shareDmg + " 点伤害！";
          // 不动如山：代承伤害降低50%
          shareDmg = Math.max(1, Math.floor(shareDmg * 0.5));
          // 守卫承受分摊伤害（走防御计算）
          var taunterDmg = this._applyPlayerDefense(taunter, shareDmg);
          if (taunter.hp <= 0) { taunter.hp = 0; taunter.alive = false; msg += "\n💀 " + taunter.name + " 为保护队友倒下了……"; taunter._taunting = false; taunter._tauntDuration = 0; }
          // 不动如山：反弹50%伤害给BOSS，HP<40%时翻倍
          var reflectRatio = (taunter.hp / taunter.maxHp) < 0.4 ? 1.0 : 0.5;
          var reflectDmg = Math.max(1, Math.floor(taunterDmg * reflectRatio));
          this.boss.hp -= reflectDmg;
          msg += "\n🏔️【不动如山】反伤 " + reflectDmg + " 点给 " + this.boss.name + "！";
          dmg = reducedDmg;
        }
        if (target) {
          // 圣剑之力真实伤害模式
          if (this.boss._trueDmgMode) {
            target.hp -= dmg;
            msg += "\n⚔️ " + target.name + " 受到 " + dmg + " 点真实伤害！";
          } else {
            dmg = this._applyPlayerDefense(target, dmg, msg);
            msg += "\n👊 " + target.name + " 受到 " + dmg + " 点伤害！";
          }
          // 血肉汲取
          if (this.bossSkillActive["lifesteal"]) {
            this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + dmg);
            msg += "\n🩸 血肉汲取恢复 " + dmg + " HP！";
          }
          if (target.hp <= 0) { target.hp = 0; target.alive = false; msg += "\n💀 " + target.name + " 倒下了……"; }
          // 逆转反击
          if (target._counterAtkTurn && target.alive) {
            var counterDmg = dmg;
            this.boss.hp -= counterDmg;
            target.totalDamage += counterDmg;
            msg += "\n📖 【逆转反击】！反弹 " + counterDmg + " 点伤害给 " + this.boss.name + "！";
            msg += "\n❤️ " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp;
          }
          if (target._thornsActive && target.alive) {
            const reflectDmg = Math.floor(dmg * 0.5);
            this.boss.hp -= reflectDmg;
            target._thornsActive = false;
            msg += "\n📖 荆棘护甲反弹 " + reflectDmg + " 点伤害给 " + this.boss.name + "！";
            msg += "\n❤️ " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp;
          }
        }
        } // end skipNext
        }
      }
      // 冻结轮转 + 存活检查
      for (const p of this.players) { if (p._frozenTurns && p._frozenTurns > 0) { p.skipNext = true; p._frozenTurns--; } }
            if (this.players.filter(function(p) { return p.alive; }).length === 0) {
        msg += "\n\n💀 全员阵亡……远征失败。";
        this.status = "settlement"; this.phase = "failed"; this._bossActionMsg = msg; this._save(); return;
      }
      this._bossActionMsg = msg; this._save(); return;
    }

    // 回合触发技能
    for (const skill of this.boss.skills) {
      if (skill.trigger !== "turn") continue;
      if (this.fightRound % skill.triggerVal !== 0) continue;

      if (skill.name === "岩石护盾" || skill.name === "冰甲") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        this.bossSkillActive["shield"] = (this.bossSkillActive["shield"] || 0) + 2;
        msg += "\n" + this.boss.name + " 获得了 2 层护盾！";
      } else if (skill.name === "暗影之幕") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        // AOE 攻击力降低（临时debuff，3回合后恢复）
        for (const p of this.players) {
          if (p.alive) {
            var atkDown = skill.atkReduce || 2;
            p.attack = Math.max(1, p.attack - atkDown);
            if (!p._atkDebuffStacks) p._atkDebuffStacks = 0;
            p._atkDebuffStacks += atkDown;
            p._atkDebuffTurns = 3;
            msg += "\n" + p.name + " 攻击力 -" + atkDown + "（当前 " + p.attack + "，3回合后恢复）";
          }
        }
      } else if (skill.name === "龙威") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        for (const p of this.players) {
          if (p.alive) p.skipNext = true;
        }
        msg += "\n所有玩家被震慑，跳过下一次行动！";
      } else if (skill.name === "蛛网束缚") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        const alive = this.players.filter(function(p) { return p.alive; });
        if (alive.length > 0) {
          const target = pickRandom(alive);
          target.skipNext = true;
          msg += "\n🕸 " + target.name + " 被蛛网束缚，下轮无法行动！";
        }
      } else if (skill.swap) {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        const alive = this.players.filter(function(p) { return p.alive; });
        if (alive.length >= 2) {
          const shuffled = [...alive].sort(function() { return Math.random() - 0.5; });
          const a = shuffled[0], b = shuffled[1];
          const avgHp = Math.floor((a.hp + b.hp) / 2);
          a.hp = avgHp; b.hp = avgHp;
          msg += "\n🔄 " + a.name + " 和 " + b.name + " 的 HP 被置换为 " + avgHp + "！";
        }
      } else if (skill.damage && skill.aoe) {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        // 【修复】AOE 技能：对全体存活玩家造成固定伤害，只输出减免后伤害
        const alive = this.players.filter(function(p) { return p.alive; });
        for (const p of alive) {
          let dmg = skill.damage;
          if (skill.defReduce) {
            p.defense = Math.max(0, p.defense - skill.defReduce);
            if (!p._defDebuffStacks) p._defDebuffStacks = 0;
            p._defDebuffStacks += skill.defReduce;
            p._defDebuffTurns = 3;
          }
          // 应用防御减免（内部会附加护盾等消息）
          dmg = this._applyPlayerDefense(p, dmg, msg);
          msg += "\n" + p.name + " 受到 " + dmg + " 点伤害！";
          if (skill.poison && p.alive) {
            if (!p._poisonedByBoss) p._poisonedByBoss = true;
            msg += "\n☠ " + p.name + " 中毒了！";
          }
          if (skill.burn && p.alive) {
            var burnDmg = 3;
            p.hp -= burnDmg;
            msg += "\n☀️ " + p.name + " 被灼烧！额外受到 " + burnDmg + " 点火焰伤害！";
            if (p.hp <= 0) { p.hp = 0; p.alive = false; msg += "\n💀 " + p.name + " 倒下了……"; }
          }
          if (p.hp <= 0) { p.hp = 0; p.alive = false; msg += "\n💀 " + p.name + " 倒下了……"; }
        }
        if (skill.stunAll) {
          for (const p of this.players) {
            if (p.alive) p.skipNext = true;
          }
          msg += "\n💀 所有存活玩家被震慑，跳过下一次行动！";
        }
      } else if (skill.name === "黑白天使") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        // 对一名玩家造成伤害，并恢复另一名玩家造成伤害一半的血量
        var alive = this.players.filter(function(p) { return p.alive; });
        if (alive.length > 0) {
          var dmgTarget = this._pickBossTarget(alive);
          var rawDmg = skill.damage;
          var actualDmg2 = this._applyPlayerDefense(dmgTarget, rawDmg, msg);
          msg += "\n💥 " + dmgTarget.name + " 受到 " + actualDmg2 + " 点伤害！";
          if (dmgTarget.hp <= 0) { dmgTarget.hp = 0; dmgTarget.alive = false; msg += "\n💀 " + dmgTarget.name + " 倒下了……"; }
          // 恢复另一名玩家
          var healCandidates = this.players.filter(function(p) { return p.alive && p.userId !== dmgTarget.userId && p.hp < p.maxHp; });
          if (healCandidates.length > 0) {
            var healTarget = pickRandom(healCandidates);
            var healAmt = Math.min(Math.floor(actualDmg2 / 2), healTarget.maxHp - healTarget.hp);
            // 神圣诅咒：恢复效果变为伤害
            if (this.bossSkillActive["holyCurse"]) {
              var curseDmg = healAmt;
              var curseActual = this._applyPlayerDefense(healTarget, curseDmg, msg);
              msg += "\n☠ 神圣诅咒！恢复逆转为伤害！" + healTarget.name + " 受到 " + curseActual + " 点伤害！";
              if (healTarget.hp <= 0) { healTarget.hp = 0; healTarget.alive = false; msg += "\n💀 " + healTarget.name + " 倒下了……"; }
            } else {
              healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmt);
              msg += "\n💖 " + healTarget.name + " 被白天使之力恢复 " + healAmt + " HP！";
            }
          }
        }
      } else if (skill.name === "诡异吼叫") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        this.bossSkillActive["weirdHowl"] = true;
        msg += "\n🔊 " + this.boss.name + " 发出诡异吼叫！下一次受到的伤害减半！";
      } else if (skill.name === "血肉蠕虫") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        var wormTargets = this.players.filter(function(p) { return p.alive; });
        if (wormTargets.length > 0) {
          var wormTarget = pickRandom(wormTargets);
          this.bossSkillActive["bloodWorm"] = (this.bossSkillActive["bloodWorm"] || 0) + 3;
          this.bossSkillActive["bloodWormTarget"] = wormTarget.userId;
          msg += "\n🪱 血肉蠕虫附身于 " + wormTarget.name + "！持续 3 回合每回合 8 点伤害！";
        }
      } else if (skill.damage) {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        // 单体伤害技能：随机点名
        const alive = this.players.filter(function(p) { return p.alive; });
        if (alive.length > 0) {
          let target = this._pickBossTarget(alive);
          let dmg = skill.damage;
          dmg = this._applyPlayerDefense(target, dmg, msg);
          msg += "\n💥 " + target.name + " 受到 " + dmg + " 点伤害！";
          if (target.hp <= 0) { target.hp = 0; target.alive = false; msg += "\n💀 " + target.name + " 倒下了……"; }
        }
      }
    }

    // BOSS 新技能类型处理
    for (const skill of this.boss.skills) {
      if (skill.trigger !== "turn") continue;
      if (this.fightRound % skill.triggerVal !== 0) continue;

      // 抓取投掷：随机一名玩家跳过一回合
      if (skill.name === "抓取投掷") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        const alive = this.players.filter(function(p) { return p.alive; });
        if (alive.length > 0) {
          var t = pickRandom(alive);
          t.skipNext = true;
          msg += "\n🖐 " + t.name + " 被抓起抛出！下回合无法行动！";
        }
      }
      // 战吼：攻击力提升50%持续3回合
      if (skill.name === "战吼") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        this.boss._warCryTurns = 3;
        this.boss.attack = Math.floor(this.boss.attack * 1.5);
        msg += "\n📢 " + this.boss.name + " 发出战吼！攻击力提升至 " + this.boss.attack + "！（3 回合）";
      }
      // 黑暗祝福：造成20伤害并跳过2回合（神圣诅咒激活时伤害翻倍）
      if (skill.name === "黑暗祝福") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        var darkTargets = this.players.filter(function(p) { return p.alive; });
        if (darkTargets.length > 0) {
          var dt = pickRandom(darkTargets);
          var darkDmg = this.bossSkillActive["holyCurse"] ? 40 : 20;
          darkDmg = this._applyPlayerDefense(dt, darkDmg, msg);
          dt.skipNext = true;
          if (!dt._frozenTurns) dt._frozenTurns = 0;
          dt._frozenTurns += 2;
          msg += "\n🌑 " + dt.name + " 被黑暗祝福侵蚀！受到 " + darkDmg + " 点伤害并跳过 2 回合！";
          if (dt.hp <= 0) { dt.hp = 0; dt.alive = false; msg += "\n💀 " + dt.name + " 倒下了……"; }
        }
      }
      // 弱点洞悉：标记一名玩家，持续3回合降低防御为0并集中攻击
      if (skill.name === "弱点洞悉") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        var _alive = this.players.filter(function(p) { return p.alive; });
        if (_alive.length > 0) {
          var mk = pickRandom(_alive);
          this.boss._marked = mk.userId;
          this.boss._markTurns = 3;
          this.boss._markedDefSave = mk.defense;
          mk.defense = 0;
          msg += "\n👁 " + mk.name + " 被标记！防御归零！BOSS 将集中攻击 " + mk.name + "（3 回合）";
        }
      }
      // 圣剑之力：攻击力+60%并只造成真实伤害
      if (skill.name === "圣剑之力") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        this.boss._trueDmgMode = true;
        this.boss.attack = Math.floor(this.boss.attack * 1.6);
        msg += "\n⚔️ " + this.boss.name + " 圣剑之力觉醒！攻击力提升至 " + this.boss.attack + "，攻击变为真实伤害！";
      }
      // 深渊凝视：随机一人跳过回合
      if (skill.name === "深渊凝视") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        var _alive = this.players.filter(function(p) { return p.alive; });
        if (_alive.length > 0) {
          var t = pickRandom(_alive);
          t.skipNext = true;
          msg += "\n👁 " + t.name + " 被深渊凝视！下回合无法行动！";
        }
      }
      // 哥布林战术：偷取一名玩家5攻击力
      if (skill.name === "哥布林战术") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        var stealAlive = this.players.filter(function(p) { return p.alive; });
        if (stealAlive.length > 0) {
          var stealTarget = pickRandom(stealAlive);
          var stealAmt = skill.atkSteal || 5;
          stealTarget.attack = Math.max(1, stealTarget.attack - stealAmt);
          this.boss.attack += stealAmt;
          msg += "\n🗡️ " + stealTarget.name + " 被偷取 " + stealAmt + " 点攻击力！BOSS攻击力提升至 " + this.boss.attack + "！";
        }
      }
      // 暗影穿刺：两名玩家受30真实伤害+跳过2回合
      if (skill.name === "暗影穿刺") {
        skillUsed = true;
        msg += "\n⚠️ 技能发动：【" + skill.name + "】" + skill.desc;
        var _alive = this.players.filter(function(p) { return p.alive; });
        var shuffled = [..._alive].sort(function() { return Math.random() - 0.5; });
        for (var si = 0; si < Math.min(2, shuffled.length); si++) {
          var st = shuffled[si];
          st.hp -= 30;
          if (st.hp <= 0) { st.hp = 0; st.alive = false; msg += "\n💀 " + st.name + " 倒下了……"; }
          st.skipNext = true;
          if (!st._frozenTurns) st._frozenTurns = 0;
          st._frozenTurns += 2;
          msg += "\n🗡️ " + st.name + " 被暗影穿刺！受到 30 点真实伤害，跳过 2 回合！";
        }
      }
    }

    // BOSS标记回合递减
    if (this.boss._markTurns > 0) {
      this.boss._markTurns--;
      if (this.boss._markTurns <= 0) {
        var savedMarkedId = this.boss._marked;
        this.boss._marked = null;
        // 恢复防御（_markedDefSave存在boss上）
        if (this.boss._markedDefSave !== undefined && savedMarkedId) {
          for (const p of this.players) {
            if (p.userId === savedMarkedId) {
              p.defense = this.boss._markedDefSave;
              break;
            }
          }
          delete this.boss._markedDefSave;
        }
        msg += "\n标记效果消失了。";
      }
    }

    // BOSS战吼递减
    if (this.boss._warCryTurns > 0) {
      this.boss._warCryTurns--;
      if (this.boss._warCryTurns <= 0) {
        this.boss.attack = Math.floor(this.boss.attack / 1.5);
        msg += "\n📢 " + this.boss.name + " 战吼效果结束，攻击力恢复。";
      }
    }

    // HP 阈值技能
    if (this.boss.hp > 0) {
      const hpRatio = this.boss.hp / this.boss.maxHp;
      for (const skill of this.boss.skills) {
        if (skill.trigger !== "hp" || hpRatio > skill.triggerVal) continue;
        if (this.bossSkillActive["hp_" + skill.name]) continue;
        this.bossSkillActive["hp_" + skill.name] = true;
        msg += "\n\n⚠️ " + this.boss.name + "：【" + skill.name + "】" + skill.desc;

        if (skill.name === "愤怒爆发" || skill.name === "狂暴产卵") {
          const mult = skill.name === "愤怒爆发" ? 2 : 1.5;
          this.boss.attack = Math.floor(this.boss.attack * mult);
          msg += "\n攻击力提升至 " + this.boss.attack + "！";
        }
        if (skill.name === "死亡低语" || skill.name === "湮灭") {
          this.bossSkillActive["whisper"] = true;
          this.bossSkillActive["whisperDmg"] = skill.damage || 5;
          msg += "\n暗蚀开始蔓延……";
        }
        if (skill.name === "狂暴") {
          this.bossSkillActive["berserk"] = true;
          msg += "\n" + this.boss.name + " 进入狂暴状态！";
        }
        // 巨魔血统：血量<20%每回合恢复25%最大HP，持续2回合
        if (skill.name === "巨魔血统") {
          this.bossSkillActive["trollRegen"] = 2;
          msg += "\n🩸 " + this.boss.name + " 巨魔血统觉醒！开始快速恢复！";
        }
        // 合成兽：血量<50%每回合免疫一次攻击
        if (skill.name === "合成兽") {
          this.bossSkillActive["synthImmune"] = true;
          msg += "\n🛡️ " + this.boss.name + " 合成兽觉醒！每回合免疫一次攻击！";
        }
        // 血肉汲取：血量<100%每次攻击恢复等量HP
        if (skill.name === "血肉汲取") {
          this.bossSkillActive["lifesteal"] = true;
          msg += "\n🩸 " + this.boss.name + " 血肉汲取觉醒！攻击将恢复等量 HP！";
        }
        // 神圣诅咒：血量<30%恢复效果变为伤害
        if (skill.name === "神圣诅咒") {
          this.bossSkillActive["holyCurse"] = true;
          msg += "\n☠ " + this.boss.name + " 神圣诅咒觉醒！恢复效果变为伤害！";
        }
        // 最终一击：攻击力+100%，防御力归零
        if (skill.name === "最终一击") {
          this.boss.attack = Math.floor(this.boss.attack * 2);
          this.boss._origDef = this.boss.defense;
          this.boss.defense = 0;
          msg += "\n⚔️ " + this.boss.name + " 最终一击！攻击力翻倍至 " + this.boss.attack + "，但防御力归零！";
        }
        if (skill.name === "绝对零度") {
          const alive = this.players.filter(function(p) { return p.alive; });
          if (alive.length > 0) {
            const target = pickRandom(alive);
            if (!target._frozenTurns) target._frozenTurns = 0;
            target._frozenTurns += 2;
            target.skipNext = true;
            msg += "\n❄️ " + target.name + " 被绝对零度冻结，将跳过 2 轮！";
          }
        }
      }
    }

    // DOT：死亡低语/湮灭
    if (this.bossSkillActive["whisper"]) {
      const dotDmg = this.bossSkillActive["whisperDmg"] || 5;
      msg += "\n💀 暗蚀扩散……";
      const alive = this.players.filter(function(p) { return p.alive; });
      for (const p of alive) {
        let actual = Math.max(1, dotDmg - Math.floor(p.defense / 2));
        if (p._ironWallShield > 0) {
          const absorbed = Math.min(p._ironWallShield, actual);
          p._ironWallShield -= absorbed;
          actual -= absorbed;
          if (absorbed > 0) msg += "\n🏔 " + p.name + " 铁壁吸收了 " + absorbed + " 点！";
        }
        if (p._shield > 0) {
          actual = Math.floor(actual / 2);
          p._shield--;
          msg += "\n🔰 " + p.name + " 护盾减免！";
        }
        p.hp -= actual;
        msg += "\n" + p.name + " 受到 " + actual + " 点侵蚀伤害！";
        if (p.hp <= 0) { p.hp = 0; p.alive = false; msg += "\n💀 " + p.name + " 倒下了……"; }
      }
    }

    // 狂暴额外攻击（单体）
    if (this.bossSkillActive["berserk"]) {
      const alive = this.players.filter(function(p) { return p.alive; });
      if (alive.length > 0) {
        let target = this._pickBossTarget(alive);
        let dmg = this.boss.attack + getRandomInt(-2, 3);
        // 闪避检查
        var bDodged = !!target._foolDodge || target._shadowStep > 0;
        var bDodgeSource = target._foolDodge ? 'fool' : (target._shadowStep > 0 ? 'shadow' : '');
        if (bDodged && bDodgeSource === 'fool') { target._foolDodge = false; msg += "\n🎪 " + target.name + " 小丑步法闪避了狂暴追击！"; }
        else if (bDodged && bDodgeSource === 'shadow') { target._shadowStep--; msg += "\n👤 " + target.name + " 影步闪避了狂暴追击！（剩余 " + target._shadowStep + " 回合）"; }
        if (!bDodged) {
        // 嘲讽承伤光环
        var taunter = null;
        for (var ti = 0; ti < this.players.length; ti++) {
          var tp = this.players[ti];
          if (tp.alive && tp._taunting && tp._tauntDuration > 0 && tp.classId === "tank") { taunter = tp; break; }
        }
        if (taunter && target.userId !== taunter.userId) {
          // 不动如山：HP低于40%时代承比例提升至70%
          var shareRatio = (taunter.hp / taunter.maxHp) < 0.4 ? 0.7 : 0.5;
          var shareDmg = Math.floor(dmg * shareRatio);
          var reducedDmg = dmg - shareDmg;
          msg += "\n😤 嘲讽光环生效！守卫 " + taunter.name + " 为 " + target.name + " 承受了 " + shareDmg + " 点伤害！";
          shareDmg = Math.max(1, Math.floor(shareDmg * 0.5));
          var taunterDmg = this._applyPlayerDefense(taunter, shareDmg);
          if (taunter.hp <= 0) { taunter.hp = 0; taunter.alive = false; msg += "\n💀 " + taunter.name + " 为保护队友倒下了……"; taunter._taunting = false; taunter._tauntDuration = 0; }
          var reflectRatio3 = (taunter.hp / taunter.maxHp) < 0.4 ? 1.0 : 0.5;
          var reflectDmg = Math.max(1, Math.floor(taunterDmg * reflectRatio3));
          this.boss.hp -= reflectDmg;
          msg += "\n🏔️【不动如山】反伤 " + reflectDmg + " 点给 " + this.boss.name + "！";
          dmg = reducedDmg;
        }
        // 圣剑之力真实伤害模式
        if (this.boss._trueDmgMode) {
          target.hp -= dmg;
          msg += "\n🔥 狂暴追击——" + target.name + " 受到 " + dmg + " 点真实伤害！";
        } else {
          dmg = this._applyPlayerDefense(target, dmg, msg);
          msg += "\n🔥 狂暴追击——" + target.name + " 受到 " + dmg + " 点伤害！";
        }
        // 血肉汲取
        if (this.bossSkillActive["lifesteal"]) {
          this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + dmg);
          msg += "\n🩸 血肉汲取恢复 " + dmg + " HP！";
        }
        if (target.hp <= 0) { target.hp = 0; target.alive = false; msg += "\n💀 " + target.name + " 倒下了……"; }
        } // end if(!bDodged)
      }
    }

    // 普通攻击（没有技能触发时）
    if (!skillUsed) {
      // BOSS跳过行动检查
      if (this.boss._skipNext) {
        this.boss._skipNext = false;
        msg += "\n❄️ " + this.boss.name + " 被冻结，无法行动！";
      } else {
      const alive = this.players.filter(function(p) { return p.alive; });
      if (alive.length > 0) {
        let target = this._pickBossTarget(alive);
        let dmg = this.boss.attack + getRandomInt(-2, 3);
        // 愚者小丑步法闪避
        var dodged = !!target._foolDodge || target._shadowStep > 0;
        var dodgeSource = target._foolDodge ? 'fool' : (target._shadowStep > 0 ? 'shadow' : '');
        if (dodged && dodgeSource === 'fool') { target._foolDodge = false; msg += "\n🎪 " + target.name + " 小丑步法闪避了攻击！"; }
        else if (dodged && dodgeSource === 'shadow') { target._shadowStep--; msg += "\n👤 " + target.name + " 影步闪避了攻击！（剩余 " + target._shadowStep + " 回合）"; }
        if (!dodged) {

        // 冰霜减伤
        if (this.boss._frostDebuff) {
          dmg = Math.floor(dmg / 2);
          this.boss._frostDebuff = false;
          msg += "\n🧊 冰霜减半效果生效！";
        }
        // 碎甲锥减半
        if (this.boss._defReset) {
          dmg = Math.floor(dmg / 2);
          this.boss._defReset = false;
          msg += "\n💎 碎甲锥效果生效！伤害减半！";
        }
        // 虚弱减伤
        if (this.boss._weakDebuff) { dmg = Math.floor(dmg * 0.6); this.boss._weakDebuff = false; msg += "\n💨 虚弱效果生效！伤害降低 40%！"; }

        // 嘲讽承伤光环
        var taunter = null;
        for (var ti = 0; ti < this.players.length; ti++) {
          var tp = this.players[ti];
          if (tp.alive && tp._taunting && tp._tauntDuration > 0 && tp.classId === "tank") { taunter = tp; break; }
        }
        if (taunter && target.userId !== taunter.userId) {
          // 不动如山：HP低于40%时代承比例提升至70%
          var shareRatio = (taunter.hp / taunter.maxHp) < 0.4 ? 0.7 : 0.5;
          var shareDmg = Math.floor(dmg * shareRatio);
          var reducedDmg = dmg - shareDmg;
          msg += "\n😤 嘲讽光环生效！守卫 " + taunter.name + " 为 " + target.name + " 承受了 " + shareDmg + " 点伤害！";
          // 不动如山：代承伤害降低50%
          shareDmg = Math.max(1, Math.floor(shareDmg * 0.5));
          var taunterDmg = this._applyPlayerDefense(taunter, shareDmg);
          if (taunter.hp <= 0) { taunter.hp = 0; taunter.alive = false; msg += "\n💀 " + taunter.name + " 为保护队友倒下了……"; taunter._taunting = false; taunter._tauntDuration = 0; }
          // 不动如山：反弹50%伤害给BOSS，HP<40%时翻倍
          var reflectRatio = (taunter.hp / taunter.maxHp) < 0.4 ? 1.0 : 0.5;
          var reflectDmg = Math.max(1, Math.floor(taunterDmg * reflectRatio));
          this.boss.hp -= reflectDmg;
          msg += "\n🏔️【不动如山】反伤 " + reflectDmg + " 点给 " + this.boss.name + "！";
          dmg = reducedDmg;
        }

        if (target) {
          // 圣剑之力真实伤害模式：无视防御和护盾
          if (this.boss._trueDmgMode) {
            target.hp -= dmg;
            msg += "\n⚔️ " + target.name + " 受到 " + dmg + " 点真实伤害！";
          } else {
            dmg = this._applyPlayerDefense(target, dmg, msg);
            msg += "\n👊 " + target.name + " 受到 " + dmg + " 点伤害！";
          }
          // 血肉汲取
          if (this.bossSkillActive["lifesteal"]) {
            this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + dmg);
            msg += "\n🩸 血肉汲取恢复 " + dmg + " HP！";
          }
          if (target.hp <= 0) { target.hp = 0; target.alive = false; msg += "\n💀 " + target.name + " 倒下了……"; }

          // 逆转反击
          if (target._counterAtkTurn && target.alive) {
            var counterDmg = dmg;
            this.boss.hp -= counterDmg;
            target.totalDamage += counterDmg;
            msg += "\n📖 【逆转反击】！反弹 " + counterDmg + " 点伤害给 " + this.boss.name + "！";
            msg += "\n❤️ " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp;
          }

          // 荆棘反弹
          if (target._thornsActive && target.alive) {
            const reflectDmg = Math.floor(dmg * 0.5);
            this.boss.hp -= reflectDmg;
            target._thornsActive = false;
            msg += "\n📖 荆棘护甲反弹 " + reflectDmg + " 点伤害给 " + this.boss.name + "！";
            msg += "\n❤️ " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp;
          }
        }
        } // end if(!dodged)
      }
      }
    }

    // 逆转反击标记清除（BOSS攻击结束后）
    for (const p of this.players) { if (p._counterAtkTurn) p._counterAtkTurn = false; }

    // 嘲讽光环持续时间递减（统一处理）
    for (var ci = 0; ci < this.players.length; ci++) {
      var cp = this.players[ci];
      if (cp._taunting && cp._tauntDuration > 0) {
        cp._tauntDuration--;
        if (cp._tauntDuration <= 0) {
          cp._taunting = false;
          cp._tauntDuration = 0;
          cp._tauntAtkBuff = 0;
          msg += "\n😤 " + cp.name + " 的嘲讽光环消失了。";
        }
      }
    }

    // 冻结轮转
    for (const p of this.players) {
      if (p._frozenTurns && p._frozenTurns > 0) {
        p.skipNext = true;
        p._frozenTurns--;
      }
    }

    // 清理嘲讽
    
    // 全员阵亡检查
    if (this.players.filter(function(p) { return p.alive; }).length === 0) {
      msg += "\n\n💀 全员阵亡……远征失败。";
      this.status = "settlement";
      this.phase = "failed";
      this._bossActionMsg = msg;
      this._save();
      return;
    }

    this._bossActionMsg = msg;
    this._save();
  }

  // 【修复】_applyPlayerDefense：独立方法，接收 target 和 dmg，返回实际伤害
  _applyPlayerDefense(target, dmg, msg) {
    // 愚者混沌共鸣 - 守卫被动：额外防御 +2
    var foolExtraDef = 0;
    if (target.classId === "fool" && target._foolCurrentPassive === "tank") {
      foolExtraDef = 2;
    }
    // 庇佑术：抵挡所有伤害
    if (target._blessing > 0) {
      target._blessing--;
      if (msg) msg += "\n🌟 " + target.name + "【庇佑】抵挡了全部伤害！（剩余 " + target._blessing + " 层）";
      target.hp -= 0; // 不扣血
      return 0;
    }
    // 战士血盾：伤害优先扣除血盾
    if (target.classId === "warrior" && target._warriorShieldHP > 0) {
      var shieldAbsorb = Math.min(target._warriorShieldHP, dmg);
      target._warriorShieldHP -= shieldAbsorb;
      dmg -= shieldAbsorb;
      if (msg) msg += "\n🛡️ " + target.name + "【血盾】吸收了 " + shieldAbsorb + " 点伤害！（血盾剩余 " + target._warriorShieldHP + "）";
      if (dmg <= 0) return 0;
    }
    // 防御增益buff
    if (target._defBuff > 0) { dmg = Math.floor(dmg / 1.2); }
    if (target._ironWallShield > 0) {
      const absorbed = Math.min(target._ironWallShield, dmg);
      target._ironWallShield -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0 && msg) msg += "\n🏔 铁壁吸收了 " + absorbed + " 点伤害！";
    }
    if (target._shield > 0) {
      dmg = Math.floor(dmg / 2);
      target._shield--;
      if (msg) msg += "\n🔰 " + target.name + " 的护盾减免了伤害！";
    }
    // 守卫不动如山：常驻减伤20%
    if (target.classId === "tank") {
      dmg = Math.floor(dmg * 0.8);
    }
    // 守卫特性：承伤光环已在外层处理，此处仅做防御减免
    dmg = Math.max(1, dmg - target.defense - foolExtraDef);
    target.hp -= dmg;
    return dmg;
  }

  // BOSS 选目标（嘲讽光环不再强制BOSS打守卫，BOSS正常选目标）
  _pickBossTarget(alivePlayers) {
    // 优先攻击标记目标（弱点洞悉）
    if (this.boss && this.boss._marked) {
      const marked = alivePlayers.find(function(p) { return p.userId === this.boss._marked; }.bind(this));
      if (marked) return marked;
    }
    const tanks = alivePlayers.filter(function(p) { return p.classId === "tank"; });
    if (tanks.length > 0 && Math.random() < 0.4) return pickRandom(tanks);
    return pickRandom(alivePlayers);
  }

  getBossActionMsg() {
    const msg = this._bossActionMsg || "";
    this._bossActionMsg = "";
    return msg;
  }

  // ---------- 多关推进 ----------

  _advanceToNextBoss(ctx) {
    this.boss.hp = 0;

    // 隐藏关卡BOSS被击败：走完整结算
    if (this.hiddenBossStage && this.hiddenEndingData) {
      // 先走完整结算流程
      this._settlement(ctx);
      var hData = this.hiddenEndingData;
      var bonus = hData.victoryBonus || {};
      // 发放隐藏关卡额外奖励
      if (bonus.money) addMoney(ctx, bonus.money);
      if (bonus.crystal) addCrystal(ctx, bonus.crystal);
      if (bonus.attack) {
        for (const p of this.players) { if (p.alive) { p.attack += bonus.attack; } }
      }
      if (bonus.defense) {
        for (const p of this.players) { if (p.alive) { p.defense += bonus.defense; } }
      }
      if (bonus.item) {
        for (const p of this.players) {
          if (p.alive) {
            var ex = p.items.find(function(i) { return i.id === bonus.item; });
            if (ex) ex.count += bonus.count || 1;
            else p.items.push({ id: bonus.item, count: bonus.count || 1 });
          }
        }
      }
      this.status = "settlement";
      this.phase = "victory";
      var hEndMsg = "\n\n" + this.boss.name + " 被击败了！！！";
      hEndMsg += "\n\n" + "🌟".repeat(20);
      hEndMsg += "\n\n🏆🏆🏆 【隐藏关卡通关】🏆🏆🏆\n";
      hEndMsg += "\n" + hData.name + " — 远征的终极秘密已被揭开！\n";
      hEndMsg += "\n" + this._buildSettlementMsg();
      // 水晶点亮提示
      if (this._crystalBuffApplied) {
        hEndMsg += "\n\n💎 水晶祝福已生效：全员获得额外HP和属性加成！";
      }
      if (bonus.money) hEndMsg += "\n\n💰 隐藏关卡额外奖励：" + bonus.money + " 金钱";
      if (bonus.crystal) hEndMsg += "\n💎 隐藏关卡额外奖励：" + bonus.crystal + " 水晶";
      hEndMsg += "\n\n🌟 恭喜！你完成了远征的隐藏结局！🌟";
      hEndMsg += "\n\n💡 远征已结束，记得发送「" + EXPEDITION.CMD_PREFIX + "退出」离开房间！";
      this._save();
      return hEndMsg;
    }

    this._settlement(ctx);

    if (this.bossStage >= EXPEDITION.MAX_BOSSES) {
      // 检查信物是否触发隐藏关卡
      var hiddenEnding = null;
      var relics = this.teamRelics || [];
      var relicIds = relics.map(function(r) { return r.id; });
      for (var ei = 0; ei < RELIC_ENDINGS.length; ei++) {
        var ending = RELIC_ENDINGS[ei];
        var allMet = true;
        for (var ri = 0; ri < ending.relicIds.length; ri++) {
          if (relicIds.indexOf(ending.relicIds[ri]) < 0) { allMet = false; break; }
        }
        if (allMet) { hiddenEnding = ending; break; }
      }
      if (hiddenEnding) {
        // 触发隐藏关卡！
        this.status = "fighting";
        this.phase = "fight";
        this.hiddenBossStage = true;
        var template = pickRandom(hiddenEnding.bossPool);
        var aliveCount = this.players.filter(function(p) { return p.alive; }).length;
        var hpScale = 1 + (aliveCount - 1) * 0.3;
        var atkScale = 1 + (aliveCount - 1) * 0.2;
        this.boss = {
          name: template.name,
          desc: template.desc,
          icon: template.icon || "🌟",
          hp: Math.floor(template.baseHp * hpScale),
          maxHp: Math.floor(template.baseHp * hpScale),
          attack: Math.floor(template.baseAtk * atkScale),
          skills: template.skills,
        };
        this.hiddenEndingData = hiddenEnding;
        // 重置战斗状态
        this.turnOrder = this.players.filter(function(p) { return p.alive; }).map(function(p) { return p.userId; });
        this.bossTurnCount = 0;
        this.playerActionsThisRound = 0;
        this.fightRound = 0;
        this.bossSkillActive = {};
        for (const p of this.players) {
          p.alive = p.hp > 0;
          p.skipNext = false;
          p.skillCooldowns = {};
          p._taunting = false;
          p._shadowStep = 0;
          p._thornsActive = false;
          // 重置战斗临时buff
          p._warCryBonus = 0;
          p._atkPotionBuff = false;
          p._atkBuff = 0;
          p._dmgBoost = 0;
          p._critPotionBuff = 0;
          p._ironWallShield = 0;
          p._ironWallDuration = 0;
          p._blessing = 0;
          p._defBuff = 0;
          p._vampiricTurns = 0;
          p._reverseActive = false;
          p._foolDodge = false;
          p._foolCritNext = false;
          p._extraTurns = 0;
          p._tauntAtkBuff = 0;
          // 战士战意狂潮：HP分半为血盾
          if (p.alive && p.classId === "warrior" && p.hp > 1) {
            var shieldHalf = Math.floor(p.hp / 2);
            p._warriorShieldHP = shieldHalf;
            p.hp = p.hp - shieldHalf;
          } else {
            p._warriorShieldHP = 0;
          }
        }
        this._save();
        var hmsg = "\n\n" + "✦️".repeat(20) + "\n";
        hmsg += "\n🌟🌟🌟 【隐藏关卡触发】🌟🌟🌟\n";
        hmsg += "\n" + hiddenEnding.name + "\n";
        hmsg += "\n" + hiddenEnding.desc + "\n";
        hmsg += "\n你收集的信物激活了远征的隐藏路线！\n";
        hmsg += "\n信物：" + relics.map(function(r) { return r.icon + r.name; }).join("、") + "\n";
        hmsg += "\n--- 【隐藏BOSS】---\n";
        hmsg += this.boss.name + "（" + this.boss.desc + "）\n";
        hmsg += "❤️ HP：" + this.boss.hp + "  ⚔️ 攻击力：" + this.boss.attack + "\n";
        hmsg += "\n全员准备迎战！发送「" + EXPEDITION.CMD_PREFIX + "攻击」或「" + EXPEDITION.CMD_PREFIX + "技能」进行战斗。\n";
        hmsg += "\n" + "✦️".repeat(20);
        return hmsg;
      }
      // 无隐藏关卡，普通通关
      this.status = "settlement";
      this.phase = "victory";
      this._save();
      var endMsg = "\n\n" + this._buildSettlementMsg();
      endMsg += "\n\n🏆 恭喜通关！所有关卡的 BOSS 已被击败！";
      endMsg += "\n\n📖 " + DEFAULT_ENDING.name + "\n" + DEFAULT_ENDING.desc;
      if (this._crystalBuffApplied) {
        endMsg += "\n\n💎 水晶祝福已生效：全员获得额外HP和属性加成！";
      }
      if (relics.length > 0) {
        endMsg += "\n\n收集的信物：" + relics.map(function(r) { return r.icon + r.name + "（" + r.desc + "）"; }).join("\n  ");
      }
      endMsg += "\n\n💡 远征已结束，记得发送「" + EXPEDITION.CMD_PREFIX + "退出」离开房间！";
      return endMsg;
    }

    this.status = "preparing";
    this.phase = "prepare";
    this.prepRound = 0;
    this.currentPlayerIdx = 0;
    this.board = this._generateBoard();
    this.boss = null;
    this.turnOrder = [];
    this.bossTurnCount = 0;
    this.playerActionsThisRound = 0;
    this.fightRound = 0;
    this.bossSkillActive = {};
    this._bossActionMsg = "";

    // 战士战意狂潮：战斗结束，合并血盾并加权提升最大HP
    for (const p of this.players) {
      if (p.alive && p.classId === "warrior" && p._warriorShieldHP !== undefined && p._warriorShieldHP > 0) {
        var shieldHP = p._warriorShieldHP;
        var origHP = p.hp;
        // 合并血量
        p.hp = Math.min(p.maxHp, origHP + shieldHP);
        // 加权平均提升最大HP上限：权重 shield 0.6 / orig 0.4，取 20% 作为加成
        var weightedAvg = Math.floor(shieldHP * 0.6 + origHP * 0.4);
        var maxHpBonus = Math.floor(weightedAvg * 0.2);
        if (maxHpBonus > 0) {
          p.maxHp += maxHpBonus;
          p.hp = Math.min(p.maxHp, p.hp + maxHpBonus);
        }
        p._warriorShieldHP = 0;
      } else {
        p._warriorShieldHP = 0;
      }
      // 重置战斗临时buff（攻击力回退）
      p._warCryBonus = 0;
      p._atkPotionBuff = false;
      p._atkBuff = 0;
      p._dmgBoost = 0;
      p._critPotionBuff = 0;
      p._ironWallShield = 0;
      p._ironWallDuration = 0;
      p._blessing = 0;
      p._defBuff = 0;
      p._vampiricTurns = 0;
      p._reverseActive = false;
      p._foolDodge = false;
      p._foolCritNext = false;
      p._battleStacks = 0;
      p._extraTurns = 0;
      p._tauntAtkBuff = 0;
      // 恢复BOSS降攻降防debuff
      if (p._atkDebuffStacks > 0) { p.attack += p._atkDebuffStacks; p._atkDebuffStacks = 0; p._atkDebuffTurns = 0; }
      if (p._defDebuffStacks > 0) { p.defense += p._defDebuffStacks; p._defDebuffStacks = 0; p._defDebuffTurns = 0; }
      p.attack = Math.max(1, p.attack);
      p.defense = Math.max(0, p.defense);
    }

    for (const p of this.players) {
      if (p.alive) {
        const _recoverPct = seal.ext.getIntConfig(ext, "关卡间恢复/%") / 100;
        const recoverAmt = Math.floor(p.maxHp * _recoverPct);
        p.hp = Math.min(p.maxHp, p.hp + recoverAmt);
      }
    }

    // 确保 currentPlayerIdx 指向第一个存活玩家
    this.currentPlayerIdx = 0;
    let found = false;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].alive) {
        this.currentPlayerIdx = i;
        found = true;
        break;
      }
    }

    this._save();

    let nextName = found ? this.players[this.currentPlayerIdx].name : "（无存活玩家）";
    let msg = "\n\n✦️ 第 " + this.bossStage + " 关 BOSS 已击败！✦️\n";
    var _recoverPct2 = seal.ext.getIntConfig(ext, "关卡间恢复/%") / 100;
    msg += "队伍获得短暂休整，存活角色恢复 " + Math.floor(_recoverPct2 * 100) + "% HP。\n";
    msg += "新的棋盘已生成，准备迎接下一关的挑战！\n\n";
    msg += "轮到 " + nextName + " 行动。发送「" + EXPEDITION.CMD_PREFIX + "行动」开始。";
    return msg;
  }

  // ---------- 结算 ----------

  _settlement(ctx) {
    this.status = "settlement";
    const _baseR = seal.ext.getIntConfig(ext, "基础奖励金钱");
    const _roundR = seal.ext.getIntConfig(ext, "每轮额外金钱");
    const _stageR = seal.ext.getIntConfig(ext, "每关额外金钱");
    const _rankR = seal.ext.getIntConfig(ext, "排名差值金钱");
    const _c1 = seal.ext.getIntConfig(ext, "冠军水晶");
    const _c2 = seal.ext.getIntConfig(ext, "亚军水晶");
    const baseReward = _baseR + this.fightRound * _roundR + this.bossStage * _stageR;
    // 赏金加成：击败隐藏关卡或高贡献额外奖励
    var bountyBonus = 0;
    if (this.hiddenBossStage) bountyBonus += 50;
    // 存活玩家额外赏金
    var aliveCount = this.players.filter(function(p) { return p.alive; }).length;
    bountyBonus += aliveCount * 10;
    const sorted = [...this.players].sort(function(a, b) { return (b.totalDamage + b.totalHeal) - (a.totalDamage + a.totalHeal); });

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const rank = i + 1;
      const reward = baseReward + (this.players.length - rank) * _rankR + bountyBonus;
      addMoney(ctx, reward);
      if (rank === 1) addCrystal(ctx, _c1);
      else if (rank === 2) addCrystal(ctx, _c2);
    }
    this._bountyBonus = bountyBonus;
    this._save();
  }

  _buildSettlementMsg() {
    const sorted = [...this.players].sort(function(a, b) { return (b.totalDamage + b.totalHeal) - (a.totalDamage + a.totalHeal); });
    let msg = "\n\n══════ 第 " + this.bossStage + " 关结算 ══════\n";
    if (this._bountyBonus) msg += "💰 赏金加成：+" + this._bountyBonus + " 金钱（全员）\n";
    msg += "🏆 贡献排名：\n";
    const medals = ["🥇", "🥈", "🥉", "4.", "5.", "6."];
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const cls = CLASSES[p.classId];
      msg += (medals[i] || (i + 1) + ".") + " " + cls.icon + " " + p.name;
      msg += "  输出：" + p.totalDamage + "  治疗：" + p.totalHeal;
      msg += "  贡献：" + (p.totalDamage + p.totalHeal) + "\n";
    }
    msg += "\n🎁 奖励已发放！（金钱 + 水晶）";
    return msg;
  }

  // ---------- 状态查看 ----------

  // 极简状态栏（单行制表）
  _buildCompactStatus() {
    var lines = [];
    lines.push("📋 " + this.roomId + " | " + this.status + (this.bossStage > 0 ? " | 关卡" + this.bossStage + "/" + EXPEDITION.MAX_BOSSES : ""));
    if (this.boss && this.status === "fighting") {
      var bossHpBar = this._hpBar(this.boss.hp, this.boss.maxHp, 10);
      lines.push((this.boss.icon || "👹") + this.boss.name + " " + bossHpBar + " " + Math.max(0,this.boss.hp) + "/" + this.boss.maxHp);
    }
    for (const p of this.players) {
      var cls = CLASSES[p.classId] || { icon: "?" };
      var hpBar = this._hpBar(p.hp, p.maxHp, 8);
      var alive = p.alive ? "" : "💀";
      var line = cls.icon + p.name + alive + " " + hpBar + " " + p.hp + "/" + p.maxHp;
      if (this.status === "fighting") {
        line += " |⚔️" + getEffectiveAttack(p) + "🛡️" + (p.defense + (p._defBuff||0));
        if (p.classId === "warrior" && p._warriorShieldHP > 0) line += "🛡️" + p._warriorShieldHP;
      }
      if (p._shadowStep > 0) line += " 👤影步" + p._shadowStep;
      if (p._taunting) line += " 😤嘲讽" + p._tauntDuration;
      lines.push(line);
    }
    return lines.join("\n");
  }

  // HP血条生成
  _hpBar(cur, max, width) {
    var ratio = Math.max(0, Math.min(1, cur / max));
    var filled = Math.round(ratio * width);
    var empty = width - filled;
    return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
  }

  statusView(ctx) {
    if (this._checkTimeout()) return { ok: true, msg: "房间已超时解散。" };

    // 使用极简状态栏
    var compactMsg = this._buildCompactStatus();

    // 详细信息仍可通过加参数查看
    let msg = compactMsg + "\n\n";

    msg += "👥 成员（" + this.players.length + "/" + EXPEDITION.MAX_PLAYERS + "）：\n";
    for (const p of this.players) {
      const cls = CLASSES[p.classId] || { icon: "?" };
      const isCreator = p.userId === this.creatorId ? "👑" : "";
      const alive = p.alive ? "" : " 💀";
      msg += "  " + isCreator + cls.icon + " " + p.name + "（" + (p.className || "未选职") + "）" + alive;
      if (this.status === "preparing") {
        msg += "  位置：" + (p.position + 1);
        msg += "  HP：" + p.hp + "/" + p.maxHp + "  ⚔️" + getEffectiveAttack(p) + " 🛡️" + p.defense;
        if (p.items && p.items.length > 0) {
          var itemNames = p.items.filter(function(i) { return i.count > 0; }).map(function(i) {
            var label = i.id;
            if (i.id === "potion") label = "治疗药水";
            else if (i.id === "bigPotion") label = "大治疗药水";
            else if (i.id === "shield") label = "护盾";
            return label + "x" + i.count;
          }).join(" ");
          if (itemNames) msg += "  [" + itemNames + "]";
        }
        // 显示技能书
        if (p._extraSkills && p._extraSkills.length > 0) {
          msg += "\n    技能书：" + p._extraSkills.map(function(s) { return s.icon + s.name; }).join("、");
        }
        // 显示职业技能
        if (cls.skills && cls.skills.length > 0) {
          msg += "\n    职业技能：" + cls.skills.map(function(s) { return s.icon + s.name; }).join("、");
        }
        // 显示特长
        if (p.talents && p.talents.length > 0) {
          msg += "\n    特长：" + p.talents.join("、");
        }
      }
      if (this.status === "fighting") {
        msg += "  HP：" + p.hp + "/" + p.maxHp;
        if (p.classId === "warrior" && p._warriorShieldHP > 0) msg += " 🛡️血盾:" + p._warriorShieldHP;
        msg += "  ⚔️" + getEffectiveAttack(p) + " 🛡️" + p.defense;
        const cdInfo = Object.keys(p.skillCooldowns).map(function(sid) {
          const sk = cls.skills ? cls.skills.find(function(s) { return s.id === sid; }) : null;
          return (sk ? sk.name : sid) + "CD:" + p.skillCooldowns[sid];
        }).join(" ");
        if (cdInfo) msg += "  [" + cdInfo + "]";
        if (p._extraSkills && p._extraSkills.length > 0) {
          const extraCd = p._extraSkills.map(function(s) {
            const cd = p.skillCooldowns[s.id] || 0;
            return s.icon + s.name + (cd > 0 ? "(CD:" + cd + ")" : "(就绪)");
          }).join(" ");
          msg += "\n    技能书：" + extraCd;
        }
      }
      msg += "\n";
    }

    if (this.boss && this.status === "fighting") {
      msg += "\n👹 " + this.boss.name + " HP：" + Math.max(0, this.boss.hp) + "/" + this.boss.maxHp + "\n";
    }

    // 信物收集
    if (this.teamRelics && this.teamRelics.length > 0) {
      msg += "\n\n🏺 团队信物：";
      for (var ri = 0; ri < this.teamRelics.length; ri++) {
        var r = this.teamRelics[ri];
        msg += "\n  " + r.icon + " " + r.name + " — " + r.desc;
      }
      // 检查可触发的结局
      var relicIds = this.teamRelics.map(function(r) { return r.id; });
      for (var rei = 0; rei < RELIC_ENDINGS.length; rei++) {
        var rend = RELIC_ENDINGS[rei];
        var allMet = true;
        for (var rri = 0; rri < rend.relicIds.length; rri++) {
          if (relicIds.indexOf(rend.relicIds[rri]) < 0) { allMet = false; break; }
        }
        if (allMet) {
          msg += "\n\n  ⭐ 满足条件可触发隐藏结局：「" + rend.name + "」";
        }
      }
    }
    // 事件标记（仅显示当前玩家）
    if (this.status === "preparing" && this.players[this.currentPlayerIdx]) {
      var cp = this.players[this.currentPlayerIdx];
      if (cp.eventFlags && Object.keys(cp.eventFlags).length > 0) {
        msg += "\n\n🔖 " + cp.name + " 的事件标记：";
        var flagKeys = Object.keys(cp.eventFlags);
        for (var fi = 0; fi < flagKeys.length; fi++) {
          msg += "\n  ✓️ " + flagKeys[fi];
        }
      }
    }

    if (this.status === "preparing") {
      msg += "\n\n轮次：" + (this.prepRound + 1) + "/" + EXPEDITION.PREP_ROUNDS;
      msg += "  当前：" + (this.players[this.currentPlayerIdx] ? this.players[this.currentPlayerIdx].name : "?");
    }
    if (this.status === "fighting") {
      // 【修复】不调用 _getCurrentTurnPlayer() 避免推进回合/触发BOSS行动
      if (this.turnOrder.length > 0) {
        let peekIdx = this.bossTurnCount % this.turnOrder.length;
        let currentUid = this.turnOrder[peekIdx];
        let currentP = this.players.find(function(p) { return p.userId === currentUid; });
        if (currentP && currentP.alive) {
          msg += "\n当前行动：" + currentP.name;
        } else {
          msg += "\n当前行动：轮次进行中";
        }
      }
    }

    return { ok: true, msg: msg };
  }

  getSkillList(userId) {
    const player = this._findPlayer(userId);
    if (!player || !player.classId) return null;
    return CLASSES[player.classId];
  }
}

// ================================================================
//  九、扩展注册与命令处理
// ================================================================

let ext = seal.ext.find("Expedition");
if (!ext) {
  ext = seal.ext.new("Expedition", "kakakumous", "2.1.0");
  seal.ext.register(ext);
}

// ================================================================
//  插件 UI 配置（在骰子设置界面中可调）
// ================================================================

// --- 基础设置 ---
seal.ext.registerStringConfig(ext, "命令前缀", EXPEDITION.CMD_PREFIX, "所有远征命令必须以此前缀开头，防止日常对话误触发");
seal.ext.registerIntConfig(ext, "最少玩家数", EXPEDITION.MIN_PLAYERS, "允许开始远征的最少玩家数");
seal.ext.registerIntConfig(ext, "最多玩家数", EXPEDITION.MAX_PLAYERS, "一个远征队最多容纳的玩家数");
seal.ext.registerIntConfig(ext, "棋盘格数", EXPEDITION.BOARD_SIZE, "准备阶段棋盘总格数");
seal.ext.registerIntConfig(ext, "准备轮数", EXPEDITION.PREP_ROUNDS, "准备阶段每人行动轮数");
seal.ext.registerIntConfig(ext, "最大BOSS关卡", EXPEDITION.MAX_BOSSES, "总共需要挑战的BOSS关卡数");
seal.ext.registerIntConfig(ext, "BOSS行动间隔", EXPEDITION.BOSS_ACT_INTERVAL, "BOSS每隔几轮自动行动一次");
seal.ext.registerIntConfig(ext, "行动冷却/ms", EXPEDITION.ACTION_COOLDOWN, "玩家两次操作之间的最小间隔（毫秒）");
seal.ext.registerIntConfig(ext, "房间超时/ms", EXPEDITION.ROOM_TIMEOUT, "房间无操作后自动解散的时间（毫秒，900000=15分钟）");

// --- 概率设置 ---
seal.ext.registerFloatConfig(ext, "肉鸽事件概率", EXPEDITION.ROGUE_EVENT_CHANCE, "掷骰子后触发肉鸽事件的概率（0~1，0.35=35%）");
seal.ext.registerStringConfig(ext, "精英战斗轮次", EXPEDITION.ELITE_FIGHT_ROUNDS.join(","), "哪些轮次触发精英战斗（逗号分隔的轮次号，从0开始）");
seal.ext.registerIntConfig(ext, "最大特长数", EXPEDITION.MAX_TALENTS, "每个玩家最多持有的特长数量");

// --- 战斗数值 ---
seal.ext.registerIntConfig(ext, "初始HP", 50, "角色初始生命值（不含职业加成）");
seal.ext.registerIntConfig(ext, "初始攻击", 5, "角色初始攻击力（不含职业加成）");
seal.ext.registerIntConfig(ext, "初始防御", 3, "角色初始防御力（不含职业加成）");
seal.ext.registerIntConfig(ext, "治疗药水回复量", 20, "普通治疗药水的回复HP数值");
seal.ext.registerIntConfig(ext, "大药水回复量", 50, "大治疗药水的回复HP数值");
seal.ext.registerIntConfig(ext, "复活恢复比例/%", 30, "复活术恢复目标最大HP的百分比");

// --- 奖励设置 ---
seal.ext.registerIntConfig(ext, "基础奖励金钱", 30, "结算时的基础金钱奖励");
seal.ext.registerIntConfig(ext, "每轮额外金钱", 10, "结算时每战斗轮次额外增加的金钱");
seal.ext.registerIntConfig(ext, "每关额外金钱", 20, "结算时每BOSS关卡额外增加的金钱");
seal.ext.registerIntConfig(ext, "排名差值金钱", 10, "结算时每低一名额外增加的金钱");
seal.ext.registerIntConfig(ext, "冠军水晶", 10, "结算时第一名获得的水晶数");
seal.ext.registerIntConfig(ext, "亚军水晶", 5, "结算时第二名获得的水晶数");

// --- 关卡间恢复 ---
seal.ext.registerIntConfig(ext, "关卡间恢复/%", 20, "击败BOSS后进入下一关时存活角色恢复最大HP的百分比");

// --- 图片后端 ---
seal.ext.registerStringConfig(ext, "图片后端地址", EXPEDITION.IMAGE_BACKEND, "图片生成后端地址（需运行expedition_image_backend.py）");

// --- 辅助函数：从UI读取配置并覆盖EXPEDITION ---
function loadConfig() {
  EXPEDITION.CMD_PREFIX = seal.ext.getStringConfig(ext, "命令前缀") || EXPEDITION.CMD_PREFIX;
  EXPEDITION.MIN_PLAYERS = seal.ext.getIntConfig(ext, "最少玩家数");
  EXPEDITION.MAX_PLAYERS = seal.ext.getIntConfig(ext, "最多玩家数");
  EXPEDITION.BOARD_SIZE = seal.ext.getIntConfig(ext, "棋盘格数");
  EXPEDITION.PREP_ROUNDS = seal.ext.getIntConfig(ext, "准备轮数");
  EXPEDITION.MAX_BOSSES = seal.ext.getIntConfig(ext, "最大BOSS关卡");
  EXPEDITION.BOSS_ACT_INTERVAL = seal.ext.getIntConfig(ext, "BOSS行动间隔");
  EXPEDITION.ACTION_COOLDOWN = seal.ext.getIntConfig(ext, "行动冷却/ms");
  EXPEDITION.ROOM_TIMEOUT = seal.ext.getIntConfig(ext, "房间超时/ms");
  EXPEDITION.ROGUE_EVENT_CHANCE = seal.ext.getFloatConfig(ext, "肉鸽事件概率");
  var fightRoundsCfg = seal.ext.getStringConfig(ext, "精英战斗轮次");
  if (fightRoundsCfg) {
    EXPEDITION.ELITE_FIGHT_ROUNDS = fightRoundsCfg.split(",").map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); });
  }
  EXPEDITION.MAX_TALENTS = seal.ext.getIntConfig(ext, "最大特长数");
  var imgBackend = seal.ext.getStringConfig(ext, "图片后端地址");
  if (imgBackend) EXPEDITION.IMAGE_BACKEND = imgBackend.trim();
}

// 启动时加载一次配置
loadConfig();

function getUserRoom(ctx) {
  return seal.vars.strGet(ctx, "$m远征房间")[0] || "";
}

function setUserRoom(ctx, roomId) {
  seal.vars.strSet(ctx, "$m远征房间", roomId);
}

function loadGame(ctx) {
  const roomId = getUserRoom(ctx);
  if (!roomId) return null;
  const raw = ext.storageGet("exped_" + roomId);
  if (!raw) { setUserRoom(ctx, ""); return null; }
  return new ExpeditionGame(roomId);
}

// 调用图片后端生成图片，返回CQ码或fallback文本
function fetchExpeditionImage(apiPath, payload, fallbackText) {
  if (!EXPEDITION.IMAGE_ENABLED) return Promise.resolve(fallbackText);
  return fetch(EXPEDITION.IMAGE_BACKEND + apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(function(res) {
    return res.text();
  }).then(function(text) {
    var data = JSON.parse(text);
    if (data.ok && data.image_url) {
      return "[CQ:image,file=" + data.image_url + "]";
    }
    return fallbackText;
  }).catch(function(e) {
    return fallbackText;
  });
}

// 解析命令：所有远征命令必须以 CMD_PREFIX 开头
function parseCmd(rawCmd) {
  const prefix = EXPEDITION.CMD_PREFIX;
  if (rawCmd.indexOf(prefix) !== 0) return null;
  const body = rawCmd.substring(prefix.length).trim();
  if (!body) return null;
  const parts = body.split(/\s+/);
  return { main: parts[0], parts: parts, body: body };
}

ext.onNotCommandReceived = function(ctx, msg) {
  const rawCmd = msg.message.trim();
  const parsed = parseCmd(rawCmd);
  if (!parsed) return seal.ext.newCmdExecuteResult(false); // 不匹配，放行给其他扩展

  const mainCmd = parsed.main;
  const parts = parsed.parts;

  // ========== 创建远征 ==========
  if (mainCmd === "创建" || mainCmd === "开房") {
    const existing = getUserRoom(ctx);
    if (existing && ext.storageGet("exped_" + existing)) {
      seal.replyToSender(ctx, msg, "你已经在一个远征队中（房间号：" + existing + "）。使用「" + EXPEDITION.CMD_PREFIX + "退出」离开。");
      return seal.ext.newCmdExecuteResult(true);
    }
    const game = new ExpeditionGame(generateRoomId());
    const result = game.create(ctx);
    if (result.ok) setUserRoom(ctx, game.roomId);
    seal.replyToSender(ctx, msg, result.msg);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 加入远征 ==========
  if (mainCmd === "加入") {
    if (parts.length < 2) { seal.replyToSender(ctx, msg, "用法：" + EXPEDITION.CMD_PREFIX + "加入 <房间号>"); return seal.ext.newCmdExecuteResult(true); }
    const roomId = parts[1].toUpperCase();
    if (!ext.storageGet("exped_" + roomId)) { seal.replyToSender(ctx, msg, "房间号不存在或已过期。"); return seal.ext.newCmdExecuteResult(true); }
    const game = new ExpeditionGame(roomId);
    const result = game.join(ctx);
    if (result.ok) setUserRoom(ctx, roomId);
    seal.replyToSender(ctx, msg, result.msg);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 选择特长 ==========
  if (mainCmd === "特长") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    if (parts.length < 2) { seal.replyToSender(ctx, msg, "用法：" + EXPEDITION.CMD_PREFIX + "特长 <序号>"); return seal.ext.newCmdExecuteResult(true); }
    const talentIdx = parseInt(parts[1]);
    if (isNaN(talentIdx)) { seal.replyToSender(ctx, msg, "请输入数字序号。"); return seal.ext.newCmdExecuteResult(true); }
    const result = game.chooseTalent(ctx, talentIdx);
    seal.replyToSender(ctx, msg, result.msg);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 选择职业 ==========
  if (mainCmd === "选职" || mainCmd === "职业") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    if (parts.length < 2) {
      seal.replyToSender(ctx, msg, "用法：" + EXPEDITION.CMD_PREFIX + "选职 <职业名>\n可选：战士 / 法师 / 祭司 / 刺客 / 守卫 / 愚者 / 狂战士");
      return seal.ext.newCmdExecuteResult(true);
    }
    const className = parts[1];
    const classId = CLASS_LIST.find(function(id) { return CLASSES[id].name === className || id === className; });
    if (!classId) { seal.replyToSender(ctx, msg, "未知职业。可选：战士 / 法师 / 祭司 / 刺客 / 守卫 / 愚者 / 狂战士"); return seal.ext.newCmdExecuteResult(true); }
    const result = game.chooseClass(ctx, classId);
    seal.replyToSender(ctx, msg, result.msg);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 退出远征 ==========
  if (mainCmd === "退出" || mainCmd === "离开") {
    const roomId = getUserRoom(ctx);
    if (!roomId) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    if (!ext.storageGet("exped_" + roomId)) { setUserRoom(ctx, ""); seal.replyToSender(ctx, msg, "房间已不存在。"); return seal.ext.newCmdExecuteResult(true); }
    const game = new ExpeditionGame(roomId);
    seal.replyToSender(ctx, msg, game.leave(ctx).msg);
    setUserRoom(ctx, "");
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 开始远征 ==========
  if (mainCmd === "开始" || mainCmd === "出发") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    seal.replyToSender(ctx, msg, game.start(ctx).msg);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 掷骰子 ==========
  if (mainCmd === "行动" || mainCmd === "掷骰子" || mainCmd === "roll") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    seal.replyToSender(ctx, msg, game.roll(ctx).msg);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 事件选择 ==========
  if (mainCmd === "选择" || mainCmd === "选") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    if (parts.length < 2) { seal.replyToSender(ctx, msg, "用法：" + EXPEDITION.CMD_PREFIX + "选择 <序号>"); return seal.ext.newCmdExecuteResult(true); }
    const choiceIdx = parseInt(parts[1]);
    if (isNaN(choiceIdx)) { seal.replyToSender(ctx, msg, "请输入数字序号。"); return seal.ext.newCmdExecuteResult(true); }
    const result = game.handleEventChoice(ctx, choiceIdx);
    seal.replyToSender(ctx, msg, result.msg);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 攻击（含精英战斗分发）==========
  if (mainCmd === "攻击" || mainCmd === "打") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    // 精英战斗时走 eliteAttack
    if (game.phase === "eliteFight") {
      const result = game.eliteAttack(ctx);
      seal.replyToSender(ctx, msg, result.msg);
      return seal.ext.newCmdExecuteResult(true);
    }
    const result = game.attack(ctx);
    if (result.roundComplete) {
      var flushMsg = game._flushRoundMsg();
      if (EXPEDITION.IMAGE_ENABLED) {
        var imgData = game._buildRoundImageData();
        seal.replyToSender(ctx, msg, "⏳ 正在生成战斗结果图片……");
        fetchExpeditionImage("/api/round_summary", imgData, flushMsg).then(function(cqMsg) {
          seal.replyToSender(ctx, msg, cqMsg);
        }).catch(function(e) {
          seal.replyToSender(ctx, msg, flushMsg);
        });
      } else {
        seal.replyToSender(ctx, msg, flushMsg);
      }
    } else {
      seal.replyToSender(ctx, msg, result.msg);
    }
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 技能 ==========
  if (mainCmd === "技能" || mainCmd === "释放") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }

    if (parts.length < 2) {
      // 查看技能列表
      const cls = game.getSkillList(ctx.player.userId);
      if (!cls) { seal.replyToSender(ctx, msg, "你还没有选择职业。"); return seal.ext.newCmdExecuteResult(true); }
      const player = game._findPlayer(ctx.player.userId);
      let info = "📜 " + cls.icon + " " + cls.name + " 技能列表：\n";
      info += "被动：【" + cls.passive.name + "】" + cls.passive.desc + "\n";
      for (const sk of cls.skills) {
        const cd = (player && player.skillCooldowns[sk.id]) || 0;
        info += "  " + sk.icon + " " + sk.name;
        info += cd > 0 ? "（冷却中：" + cd + " 轮）" : "（就绪）";
        info += " — " + sk.desc + "\n";
      }
      if (player._extraSkills && player._extraSkills.length > 0) {
        info += "\n📖 技能书：\n";
        for (const es of player._extraSkills) {
          const cd = player.skillCooldowns[es.id] || 0;
          info += "  " + es.icon + " " + es.name;
          info += cd > 0 ? "（冷却中：" + cd + " 轮）" : "（就绪）";
          info += " — " + es.desc + "\n";
        }
      }
      info += "\n用法：" + EXPEDITION.CMD_PREFIX + "技能 <技能名>";
      seal.replyToSender(ctx, msg, info);
      return seal.ext.newCmdExecuteResult(true);
    }

    const skillName = parts.slice(1).join("");
    const result = game.useSkill(ctx, skillName);
    if (result.roundComplete) {
      var flushMsg = game._flushRoundMsg();
      if (EXPEDITION.IMAGE_ENABLED) {
        var imgData = game._buildRoundImageData();
        seal.replyToSender(ctx, msg, "⏳ 正在生成战斗结果图片……");
        fetchExpeditionImage("/api/round_summary", imgData, flushMsg).then(function(cqMsg) {
          seal.replyToSender(ctx, msg, cqMsg);
        }).catch(function(e) {
          seal.replyToSender(ctx, msg, flushMsg);
        });
      } else {
        seal.replyToSender(ctx, msg, flushMsg);
      }
    } else {
      seal.replyToSender(ctx, msg, result.msg);
    }
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 治疗 ==========
  if (mainCmd === "治疗") {
    if (parts.length < 2) { seal.replyToSender(ctx, msg, "用法：" + EXPEDITION.CMD_PREFIX + "治疗 <玩家名>"); return seal.ext.newCmdExecuteResult(true); }
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    // 支持CQ:at格式和纯文本@昵称
    var healTargetName = parts.slice(1).join(" ").replace(/^@/, "").trim();
    var cqAtMatch = healTargetName.match(/\[CQ:at[^\]]*qq=(\d+)[^\]]*\]/);
    if (cqAtMatch) {
      var atUserId = cqAtMatch[1];
      var atPlayer = game.players.find(function(p) { return p.userId === atUserId; });
      if (atPlayer) healTargetName = atPlayer.name;
      else healTargetName = healTargetName.replace(/\[CQ:at[^\]]*\]/g, "").trim();
    } else {
      healTargetName = healTargetName.replace(/\[CQ:at[^\]]*\]/g, "").trim();
    }
    let target = game.players.find(function(p) { return p.name === healTargetName; });
    if (!target) target = game.players.find(function(p) { return p.name.indexOf(healTargetName) >= 0; });
    if (!target) { seal.replyToSender(ctx, msg, "找不到玩家「" + healTargetName + "」。"); return seal.ext.newCmdExecuteResult(true); }
    const result = game.heal(ctx, target.userId);
    if (result.roundComplete) {
      var flushMsg = game._flushRoundMsg();
      if (EXPEDITION.IMAGE_ENABLED) {
        var imgData = game._buildRoundImageData();
        seal.replyToSender(ctx, msg, "⏳ 正在生成战斗结果图片……");
        fetchExpeditionImage("/api/round_summary", imgData, flushMsg).then(function(cqMsg) {
          seal.replyToSender(ctx, msg, cqMsg);
        }).catch(function(e) {
          seal.replyToSender(ctx, msg, flushMsg);
        });
      } else {
        seal.replyToSender(ctx, msg, flushMsg);
      }
    } else {
      seal.replyToSender(ctx, msg, result.msg);
    }
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 使用道具 ==========
  if (mainCmd === "使用") {
    if (parts.length < 2) { seal.replyToSender(ctx, msg, "用法：" + EXPEDITION.CMD_PREFIX + "使用 <道具名> [@目标]"); return seal.ext.newCmdExecuteResult(true); }
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }

    let itemName = parts[1];
    let targetUserId = null;
    // 支持CQ:at格式和纯文本@昵称
    var cqAtItemMatch = parsed.body.match(/\[CQ:at[^\]]*qq=(\d+)[^\]]*\]/);
    if (cqAtItemMatch) {
      var atItemUserId = cqAtItemMatch[1];
      var atItemPlayer = game.players.find(function(p) { return p.userId === atItemUserId; });
      if (atItemPlayer) targetUserId = atItemPlayer.userId;
      // 道具名 = 去掉CQ:at后的部分
      var cleanBody = parsed.body.replace(/\[CQ:at[^\]]*\]/g, "").trim();
      var cleanParts = cleanBody.split(/\s+/);
      itemName = cleanParts[1] || parts[1];
    } else {
      const atIndex = parsed.body.indexOf("@");
      if (atIndex > 0) {
        const targetRaw = parsed.body.slice(atIndex + 1).trim();
        if (targetRaw) {
          let t = game.players.find(function(p) { return p.name === targetRaw; });
          if (!t) t = game.players.find(function(p) { return p.name.indexOf(targetRaw) >= 0; });
          if (t) targetUserId = t.userId;
          itemName = parsed.body.slice(0, atIndex).trim().split(/\s+/).slice(1)[0] || parts[1];
        }
      }
    }

    const itemMap = {
      "potion": "potion", "治疗药水": "potion",
      "bigPotion": "bigPotion", "大药水": "bigPotion", "大治疗药水": "bigPotion",
      "shield": "shield", "护盾": "shield",
      "atkPotion": "atkPotion", "猛力药水": "atkPotion", "攻击药水": "atkPotion",
      "critPotion": "critPotion", "鹰眼药水": "critPotion", "暴击药水": "critPotion",
      "dotPotion": "dotPotion", "剧毒药水": "dotPotion", "毒药": "dotPotion",
      "reviveScroll": "reviveScroll", "复活卷轴": "reviveScroll", "复活药": "reviveScroll",
      "actionHorn": "actionHorn", "行动号角": "actionHorn", "号角": "actionHorn", "拉条": "actionHorn",
    };
    const itemId = itemMap[itemName];
    if (!itemId) { seal.replyToSender(ctx, msg, "未知道具。可用：治疗药水 / 大药水 / 护盾"); return seal.ext.newCmdExecuteResult(true); }

    const result = game.useItem(ctx, itemId, targetUserId);
    if (result.roundComplete) {
      var flushMsg = game._flushRoundMsg();
      if (EXPEDITION.IMAGE_ENABLED) {
        var imgData = game._buildRoundImageData();
        seal.replyToSender(ctx, msg, "⏳ 正在生成战斗结果图片……");
        fetchExpeditionImage("/api/round_summary", imgData, flushMsg).then(function(cqMsg) {
          seal.replyToSender(ctx, msg, cqMsg);
        }).catch(function(e) {
          seal.replyToSender(ctx, msg, flushMsg);
        });
      } else {
        seal.replyToSender(ctx, msg, flushMsg);
      }
    } else {
      seal.replyToSender(ctx, msg, result.msg);
    }
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 跳过回合 ==========
  if (mainCmd === "跳过" || mainCmd === "过") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    const result = game.skip(ctx);
    if (result.roundComplete) {
      var flushMsg = game._flushRoundMsg();
      if (EXPEDITION.IMAGE_ENABLED) {
        var imgData = game._buildRoundImageData();
        seal.replyToSender(ctx, msg, "⏳ 正在生成战斗结果图片……");
        fetchExpeditionImage("/api/round_summary", imgData, flushMsg).then(function(cqMsg) {
          seal.replyToSender(ctx, msg, cqMsg);
        }).catch(function(e) {
          seal.replyToSender(ctx, msg, flushMsg);
        });
      } else {
        seal.replyToSender(ctx, msg, flushMsg);
      }
    } else {
      seal.replyToSender(ctx, msg, result.msg);
    }
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看状态 ==========
  if (mainCmd === "状态" || mainCmd === "查看") {
    const game = loadGame(ctx);
    if (!game) { seal.replyToSender(ctx, msg, "你不在任何远征队中。"); return seal.ext.newCmdExecuteResult(true); }
    if (EXPEDITION.IMAGE_ENABLED && game.status === "fighting") {
      var statusData = game._buildStatusImageData();
      seal.replyToSender(ctx, msg, "⏳ 正在生成状态图片……");
      fetchExpeditionImage("/api/battle_status", statusData, game.statusView(ctx).msg).then(function(cqMsg) {
        seal.replyToSender(ctx, msg, cqMsg);
      }).catch(function(e) {
        seal.replyToSender(ctx, msg, game.statusView(ctx).msg);
      });
    } else {
      seal.replyToSender(ctx, msg, game.statusView(ctx).msg);
    }
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 帮助 ==========
  // ========== BOSS表 ==========
  if (mainCmd === "BOSS表" || mainCmd === "boss表") {
    var table = "\n  👹 秘境远征 BOSS 一览表\n";
    table += "━".repeat(36) + "\n";
    for (var si = 0; si < BOSS_STAGES.length; si++) {
      var stage = BOSS_STAGES[si];
      table += "\n  🏰 第 " + stage.stage + " 关\n";
      for (var bi = 0; bi < stage.bossPool.length; bi++) {
        var b = stage.bossPool[bi];
        table += "\n  「" + b.name + "」（" + b.desc.substring(0, 20) + "…）\n";
        table += "    ❤️ HP：" + b.baseHp + "  ⚔️ ATK：" + b.baseAtk + "\n";
        table += "    技能：";
        for (var ski = 0; ski < b.skills.length; ski++) {
          var sk = b.skills[ski];
          table += "\n    ";
          table += (ski + 1) + ". " + sk.name;
          if (sk.damage) table += "（伤害" + sk.damage + "）";
          if (sk.aoe) table += " [AOE]";
          if (sk.poison) table += " [中毒]";
          if (sk.bind) table += " [束缚]";
          if (sk.atkReduce) table += " [降攻" + sk.atkReduce + "]";
          if (sk.defReduce) table += " [降防" + sk.defReduce + "]";
          if (sk.drain) table += " [吸血]";
          if (sk.swap) table += " [交换HP]";
          if (sk.silence) table += " [沉默]";
          if (sk.atkSteal) table += " [偷攻" + sk.atkSteal + "]";
          if (sk.doubleHit) table += " [连击]";
          if (sk.stunAll) table += " [眩晕全体]";
          table += " " + sk.desc;
        }
        table += "\n";
      }
    }
    // 隐藏关卡BOSS
    if (RELIC_ENDINGS && RELIC_ENDINGS.length > 0) {
      table += "\n\n  🌟 隐藏结局 BOSS\n";
      for (var ei = 0; ei < RELIC_ENDINGS.length; ei++) {
        var ending = RELIC_ENDINGS[ei];
        table += "\n  「" + ending.name + "」\n";
        table += "    信物需求：" + ending.relicIds.join(" + ") + "\n";
        for (var hbi = 0; hbi < ending.bossPool.length; hbi++) {
          var hb = ending.bossPool[hbi];
          table += "    " + hb.name + "  ❤️ HP：" + hb.baseHp + "  ⚔️ ATK：" + hb.baseAtk + "\n";
          table += "    " + hb.desc + "\n";
          for (var hsi = 0; hsi < hb.skills.length; hsi++) {
            var hsk = hb.skills[hsi];
            table += "    " + (hsi + 1) + ". " + hsk.name + " — " + hsk.desc + "\n";
          }
        }
        if (ending.victoryBonus) {
          var bonus = ending.victoryBonus;
          var bonusStr = [];
          if (bonus.money) bonusStr.push("金钱" + bonus.money);
          if (bonus.crystal) bonusStr.push("水晶" + bonus.crystal);
          if (bonus.attack) bonusStr.push("攻击" + bonus.attack);
          if (bonus.defense) bonusStr.push("防御" + bonus.defense);
          table += "    额外奖励：" + bonusStr.join("、") + "\n";
        }
      }
    }
    // 精英怪
    table += "\n\n  🗡️ 精英怪一览\n";
    table += "━".repeat(36) + "\n";
    for (var ei = 0; ei < ELITE_MONSTERS.length; ei++) {
      var em = ELITE_MONSTERS[ei];
      table += "\n  " + em.icon + " " + em.name + "（" + (em.type === "solo" ? "遭遇战" : "群战") + "）\n";
      table += "    ❤️ HP：" + em.baseHp + "  ⚔️ ATK：" + em.baseAtk + "\n";
      table += "    " + em.desc + "\n";
      if (em.relicDrop) table += "    信物掉落：" + em.relicDrop.icon + " " + em.relicDrop.name + "\n";
      var emReward = em.reward || {};
      var emRewardStr = [];
      if (emReward.money) emRewardStr.push("金钱" + emReward.money);
      if (emReward.attack) emRewardStr.push("攻击" + emReward.attack);
      if (emReward.defense) emRewardStr.push("防御" + emReward.defense);
      if (emReward.crystal) emRewardStr.push("水晶" + emReward.crystal);
      if (emRewardStr.length > 0) table += "    击杀奖励：" + emRewardStr.join("、") + "\n";
    }
    // 信物结局组合
    table += "\n\n  🏆 信物结局一览\n";
    table += "━".repeat(36) + "\n";
    table += "  收集特定信物组合，击败第3关BOSS后触发隐藏结局\n";
    table += "  不满足条件进入默认结局「" + DEFAULT_ENDING.name + "」\n";
    for (var rei = 0; rei < RELIC_ENDINGS.length; rei++) {
      var re = RELIC_ENDINGS[rei];
      var relicNames = re.relicIds.map(function(rid) {
        var found = ELITE_MONSTERS.find(function(m) { return m.relicDrop && m.relicDrop.id === rid; });
        return found ? found.relicDrop.icon + found.relicDrop.name : rid;
      });
      table += "\n  「" + re.name + "」→ 需：" + relicNames.join(" + ") + "\n";
    }
    table += "\n";
    seal.replyToSender(ctx, msg, table);
    return seal.ext.newCmdExecuteResult(true);
  }

  if (mainCmd === "帮助" || mainCmd === "help") {
    var helpTxt = "\n\n  秘境远征 v3.0 — 多人合作肉鸽\n";
    helpTxt += "所有指令以「" + EXPEDITION.CMD_PREFIX + "」开头\n\n";
    helpTxt += "一、房间：创建 / 加入 / 选职 / 特长 / 退出 / 状态\n";
    helpTxt += "二、准备：" + EXPEDITION.PREP_ROUNDS + "轮探索+战斗交替 | 行动 / 选择\n";
    helpTxt += "三、战斗：攻击 / 技能 / 治疗 / 使用 / 跳过\n";
    helpTxt += "  ◎ 拉条：使用「行动号角」可消耗自己回合让队友额外行动一轮\n";
    helpTxt += "四、职业：⚔️战士 🔮法师 ✨️祭司 🗡️刺客 🛡️守卫 🤡愚者 🗡️狂战士\n";
    helpTxt += "五、特长：选职三选一先天 + 事件解锁后天（最多" + EXPEDITION.MAX_TALENTS + "个）\n";
    helpTxt += "六、肉鸽：检定 / 事件连锁 / 精英战斗 / 特长解锁 / 信物收集 / 隐藏结局";
    seal.replyToSender(ctx, msg, helpTxt);
    return seal.ext.newCmdExecuteResult(true);
  }
};
