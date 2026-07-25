// ==UserScript==
// @name 好感度系统（通用多目标版）
// @author L.Y.
// @version 3.0.0
// @description 通用好感度系统：支持多目标 + 可配置称呼 + 随机增减 + 自由送礼
// @license CC-BY-NC-SA 4.0
// ==/UserScript>>

// ============================================================
//  一、常量与配置（用户可自定义）
// ============================================================

// ★ 请根据你的情况修改以下配置：

// 默认目标对象的称呼（可改为任意名字，如"助手""洛洛""阿米娅"等）
let BOT_NAME = "骰娘";

// 目标对象的身份标签（用于帮助文本等，如"助手小姐""大小姐""导师"）
let BOT_TITLE = "骰娘";

// 目标对象的人称代词：他/她/祂
let BOT_PRONOUN = "她";

// 好感度存储 key 前缀（不同目标用不同前缀，避免数据冲突）
const BOT_STORAGE_PREFIX = "fav_";

// --- 系统配置 ---

let FAV_MAX_DAILY_INTERACT = 15;     // 每日互动次数上限
let FAV_DECAY_PER_DAY = 2;           // 每日不互动衰减
let FAV_DECAY_THRESHOLD = 15;        // 低于此值不衰减
let FAV_GIFT_COOLDOWN = 10;          // 送礼冷却（秒）
let FAV_RANK_SHOW = 10;              // 排行榜人数
let FAV_GIFT_MIN_COST = 5;           // 送礼最低消费

// ============================================================
//  二、关系等级（中性向）
// ============================================================

const FAV_LEVELS = [
  { id: 0,  name: "陌生人",      min: -999, max: 20,   icon: "👤",  desc: "谁啊？不认识。" },
  { id: 1,  name: "眼熟",        min: 21,   max: 60,   icon: "👀",  desc: "好像在哪见过……算了，无所谓。" },
  { id: 2,  name: "常客",        min: 61,   max: 120,  icon: "☕",  desc: "来得挺勤，随便坐吧。" },
  { id: 3,  name: "脸熟了",      min: 121,  max: 200,  icon: "😐",  desc: "勉强记住你了，别得意。" },
  { id: 4,  name: "老相识",      min: 201,  max: 300,  icon: "🤝",  desc: "啧，又是你。行吧，不算讨厌。" },
  { id: 5,  name: "靠得住",      min: 301,  max: 450,  icon: "🛡️",  desc: "你这个人，勉强可以信任。" },
  { id: 6,  name: "自己人",      min: 451,  max: 600,  icon: "🏠",  desc: "哼，进来了就别想跑。" },
  { id: 7,  name: "伙伴",        min: 601,  max: 800,  icon: "⚔️",  desc: "一起走过的路，我不会忘。" },
  { id: 8,  name: "家人",        min: 801,  max: 9999, icon: "👑",  desc: "你是我选择的人。" },
];

// ============================================================
//  三、对话文本（使用 BOT_NAME 变量）
// ============================================================

// 注意：由于 seal 框架对 $ 有特殊解析，这里手动拼接 BOT_NAME
// 所有 {bot} 占位符在运行时替换

const FAV_TALK = {
  morning_good: [
    "早。今天心情不错，别给我搞砸了。",
    "哟，起得挺早嘛。",
    "早安。咖啡在桌上，自己倒。",
    "今天天气还行，算你运气好。",
  ],
  morning_bad: [
    "……早。别烦我。",
    "一大早的就来吵我？",
    "你最好是有正事。",
    "早什么早，我还没睡醒。",
  ],
  evening_good: [
    "还不睡？……随你吧。",
    "晚安，明天别迟到。",
    "行吧，今天辛苦你了。",
    "嗯，今天就这样。",
  ],
  evening_bad: [
    "还不滚去睡？",
    "别熬夜，明天一脸倦容别给我看。",
    "终于消停了。",
    "晚安……啧，我什么也没说。",
  ],
  greet_good: [
    "哼，你来了啊。",
    "又见面了。……我没有在等你。",
    "干嘛？没事就一边待着。",
    "嗯。我在。",
    "你今天看起来……算了，没什么。",
  ],
  greet_bad: [
    "……你又来干嘛？",
    "别烦我。",
    "今天不想理你。",
    "你话太多了。",
    "啧，怎么又是你。",
  ],
  greet_neutral: [
    "哦。",
    "说完了？",
    "所以呢？",
    "……还有事吗？",
    "嗯哼？",
  ],
  gift_good: [
    "……给我的？哼，算你有心。",
    "这什么东西……（收下了）",
    "你居然会送东西？太阳打西边出来了。",
    "……谢谢。我就说这一次。",
    "还可以吧，不算太糟。",
  ],
  gift_bad: [
    "就这？你打发叫花子呢？",
    "……你是不是在敷衍我？",
    "不需要。拿走。",
    "这种东西你自己留着吧。",
    "（看了一眼，没接）……下一个。",
  ],
  gift_neutral: [
    "嗯。放那儿吧。",
    "行吧，我收下了。",
    "随便你。",
    "哦。",
  ],
  fav_up: [
    "……哼，算你识相。",
    "好像……也没那么讨厌你。",
    "继续努力，别得意。",
    "啧，别以为这样我就会对你好。",
  ],
  fav_down: [
    "你最好注意一下自己的言行。",
    "……我收回之前对你的评价。",
    "你是不是觉得我脾气很好？",
    "完了，你现在在我这的印象分大打折扣。",
  ],
  level_up: [
    "哼……勉强认可你吧。",
    "没想到你居然能走到这一步。",
    "……别太感动，我只是实话实说。",
    "啧，你该不会在偷笑吧？",
  ],
  value_high: "这东西……不便宜吧？",
  value_low: "……就这点诚意？",
  value_normal: "嗯，还行。",
  special_attention: [
    "你今天吃错药了？",
    "突然这么积极，心里有鬼？",
    "……你该不会有什么事瞒着我吧？",
    "不对劲，你很不正常。",
  ],
};

// ============================================================
//  四、特殊事件
// ============================================================

const FAV_EVENTS = [
  { id: "first_interact",  name: "第一次搭话",     desc: "你鼓起勇气和我说话了。",       trigger: { type: "totalInteract", value: 1 },    reward: { fav: 10 } },
  { id: "first_gift",      name: "第一次送礼",     desc: "你送出了第一份礼物。",         trigger: { type: "totalGifts", value: 1 },      reward: { fav: 15 } },
  { id: "level_regular",   name: "混个脸熟",       desc: "达到「常客」等级。",           trigger: { type: "level", value: 2 },           reward: { fav: 20 } },
  { id: "level_old",       name: "老相识了",       desc: "达到「老相识」等级。",         trigger: { type: "level", value: 4 },           reward: { fav: 30 } },
  { id: "level_trust",     name: "勉强信任",       desc: "达到「靠得住」等级。",         trigger: { type: "level", value: 5 },           reward: { fav: 40, crystal: 10 } },
  { id: "level_own",       name: "自己人",         desc: "达到「自己人」等级。",         trigger: { type: "level", value: 6 },           reward: { fav: 50, crystal: 15 } },
  { id: "level_partner",   name: "一路同行",       desc: "达到「伙伴」等级。",           trigger: { type: "level", value: 7 },           reward: { fav: 80, crystal: 25 } },
  { id: "level_family",    name: "认定的你",       desc: "达到「家人」等级。",           trigger: { type: "level", value: 8 },           reward: { fav: 100, crystal: 50 } },
  { id: "gift_50",         name: "心意累积",       desc: "累计送出 50 份礼物。",         trigger: { type: "totalGifts", value: 50 },     reward: { fav: 50, crystal: 20 } },
  { id: "interact_500",    name: "第五百次",       desc: "累计互动 500 次。",            trigger: { type: "totalInteract", value: 500 }, reward: { fav: 60, crystal: 30 } },
  { id: "interact_1000",   name: "千次交集",       desc: "累计互动 1000 次。",           trigger: { type: "totalInteract", value: 1000 },reward: { fav: 100, crystal: 50 } },
  { id: "fav_500",         name: "五百之约",       desc: "好感度达到 500。",             trigger: { type: "fav", value: 500 },           reward: { fav: 50, crystal: 20 } },
  { id: "fav_800",         name: "八百里程碑",     desc: "好感度达到 800。",             trigger: { type: "fav", value: 800 },           reward: { fav: 80, crystal: 40 } },
];

// ============================================================
//  五、辅助函数
// ============================================================

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

function getFavLevel(fav) {
  let result = FAV_LEVELS[0];
  for (const level of FAV_LEVELS) {
    if (fav >= level.min && fav <= level.max) { result = level; break; }
    if (fav > level.max) result = level;
  }
  return result;
}

function descValueSort(arr) {
  if (arr.length <= 1) return arr;
  for (let i = 0; i < arr.length - 1; i++) {
    for (let j = 0; j < arr.length - 1 - i; j++) {
      if (arr[j][0] < arr[j + 1][0]) {
        const t = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = t;
      }
    }
  }
  return arr;
}

function getGiftValueLabel(cost) {
  if (cost >= 500) return "extreme";
  if (cost >= 200) return "high";
  if (cost >= 80)  return "premium";
  if (cost >= 30)  return "normal";
  if (cost >= 10)  return "cheap";
  return "trash";
}

// 将文本中的 {bot} 占位符替换为 BOT_NAME
function t(str) {
  if (typeof str === "string") {
    return str.replace(/\{bot\}/g, BOT_NAME);
  }
  return str;
}

// 从数组中随机选一条，替换 {bot}
function pickT(arr) {
  return t(pickRandom(arr));
}

// ============================================================
//  六、好感度主类
// ============================================================

class Favorability {
  // targetId: 好感度针对的目标对象标识（不同目标好感度独立计算）
  // targetName: 目标对象的显示名（如不传则用 BOT_NAME）
  constructor(ctx, targetId, targetName) {
    this.ctx = ctx;
    this.userId = ctx.player.userId;
    this.userName = ctx.player.name;

    this.targetId = targetId || "default";
    this.targetName = targetName || BOT_NAME;

    // 存储 key = 前缀 + 用户ID + ":" + 目标ID
    const storageKey = BOT_STORAGE_PREFIX + this.userId + ":" + this.targetId;
    const allData = JSON.parse(ext.storageGet(storageKey) || "{}");

    this.fav = allData.fav || 0;
    this.level = allData.level || 0;
    this.totalInteract = allData.totalInteract || 0;
    this.totalGifts = allData.totalGifts || 0;
    this.lastInteractDay = allData.lastInteractDay || 0;

    this.todayInteracts = allData.todayInteracts || 0;
    this.todayGifts = allData.todayGifts || 0;
    this.lastGiftTime = allData.lastGiftTime || 0;

    this.triggeredEvents = allData.triggeredEvents || {};
    this.favHistory = allData.favHistory || [];

    this._storageKey = storageKey;
    this._allData = allData;
  }

  _save() {
    ext.storageSet(this._storageKey, JSON.stringify({
      name: this.userName,
      targetName: this.targetName,
      platform: this.ctx.endPoint.platform,

      fav: this.fav,
      level: this.level,
      totalInteract: this.totalInteract,
      totalGifts: this.totalGifts,
      lastInteractDay: this.lastInteractDay,

      todayInteracts: this.todayInteracts,
      todayGifts: this.todayGifts,
      lastGiftTime: this.lastGiftTime,

      triggeredEvents: this.triggeredEvents,
      favHistory: this.favHistory,
    }));
  }

  // ---------- 等级 ----------

  _recalcLevel() {
    const newLevel = getFavLevel(this.fav);
    let leveledUp = false;
    if (newLevel.id > this.level) leveledUp = true;
    this.level = newLevel.id;
    return { level: newLevel, leveledUp };
  }

  // ---------- 每日衰减 ----------

  _applyDecay() {
    const today = getTodayDay();
    if (this.fav <= FAV_DECAY_THRESHOLD) return 0;
    if (this.lastInteractDay === 0) return 0;

    const daysSinceLast = today - this.lastInteractDay;
    if (daysSinceLast <= 1) return 0;

    const decayDays = Math.min(daysSinceLast - 1, 7);
    const decay = decayDays * FAV_DECAY_PER_DAY;
    this.fav = Math.max(FAV_DECAY_THRESHOLD, this.fav - decay);
    this.lastInteractDay = today;

    if (decay > 0) {
      this.favHistory.push({
        type: "decay", value: -decay, time: Date.now(),
        reason: daysSinceLast + " 天未互动",
      });
    }
    return decay;
  }

  // ---------- 心情 ----------

  _getMood() {
    const jrrp = seal.vars.intGet(this.ctx, "$t人品")[0] || 50;
    const favFactor = Math.max(-20, Math.min(20, Math.floor(this.fav / 25)));
    const moodRoll = getRandomInt(1, 100) + favFactor;

    if (moodRoll <= 20)  return { mood: "bad",  weight: -2, label: "心情很差" };
    if (moodRoll <= 50)  return { mood: "bad",  weight: -1, label: "不太爽" };
    if (moodRoll <= 70)  return { mood: "neutral", weight: 0,  label: "一般般" };
    if (moodRoll <= 90)  return { mood: "good", weight: 1,  label: "还行" };
    return { mood: "good", weight: 2,  label: "不错" };
  }

  // ---------- 随机好感变化 ----------

  _randomFavChange(moodWeight, baseRange) {
    const min = baseRange[0] + moodWeight;
    const max = baseRange[1] + moodWeight;
    const jrrp = seal.vars.intGet(this.ctx, "$t人品")[0] || 50;
    let luckBonus = 0;
    if (jrrp >= 90) luckBonus = 2;
    else if (jrrp >= 70) luckBonus = 1;
    else if (jrrp <= 10) luckBonus = -2;
    else if (jrrp <= 30) luckBonus = -1;

    const change = getRandomInt(min + luckBonus, max + luckBonus);
    return Math.max(-8, Math.min(10, change));
  }

  // ---------- 检查特殊事件 ----------

  _checkEvents() {
    const triggered = [];
    for (const evt of FAV_EVENTS) {
      if (this.triggeredEvents[evt.id]) continue;
      let met = false;
      const t = evt.trigger;
      switch (t.type) {
        case "totalInteract": met = this.totalInteract >= t.value; break;
        case "totalGifts":    met = this.totalGifts >= t.value;    break;
        case "level":         met = this.level >= t.value;         break;
        case "fav":           met = this.fav >= t.value;           break;
      }
      if (met) {
        this.triggeredEvents[evt.id] = true;
        triggered.push(evt);
        if (evt.reward.fav) this.fav += evt.reward.fav;
        if (evt.reward.crystal) {
          const cur = seal.vars.intGet(this.ctx, "$m水晶")[0] || 0;
          seal.vars.intSet(this.ctx, "$m水晶", cur + evt.reward.crystal);
        }
        if (evt.reward.money) {
          const cur = seal.vars.intGet(this.ctx, "$m金钱")[0] || 0;
          seal.vars.intSet(this.ctx, "$m金钱", cur + evt.reward.money);
        }
      }
    }
    return triggered;
  }

  // ============================================================
  //  核心：互动
  // ============================================================

  interact(type) {
    const today = getTodayDay();

    if (this.todayInteracts >= FAV_MAX_DAILY_INTERACT) {
      return "你今天已经找过" + this.targetName + " " + FAV_MAX_DAILY_INTERACT + " 次了……够了够了，明天再来。";
    }

    const decay = this._applyDecay();
    const mood = this._getMood();
    const favChange = this._randomFavChange(mood.weight, [-4, 5]);

    this.fav += favChange;
    this.todayInteracts++;
    this.totalInteract++;
    this.lastInteractDay = today;

    if (favChange <= -5) {
      this.favHistory.push({
        type: "crash", value: favChange, time: Date.now(),
        reason: "互动（" + type + "）惹" + this.targetName + "生气了",
      });
    }

    let talk = "";
    if (type === "morning") {
      talk = mood.mood === "good" ? pickT(FAV_TALK.morning_good) : pickT(FAV_TALK.morning_bad);
    } else if (type === "evening") {
      talk = mood.mood === "good" ? pickT(FAV_TALK.evening_good) : pickT(FAV_TALK.evening_bad);
    } else {
      if (mood.mood === "good") talk = pickT(FAV_TALK.greet_good);
      else if (mood.mood === "bad") talk = pickT(FAV_TALK.greet_bad);
      else talk = pickT(FAV_TALK.greet_neutral);
    }

    let result = talk;

    if (decay > 0) {
      result += "\n（" + decay + " 天没来，好感度自动减了 " + decay + "）";
    }

    if (favChange > 0) {
      result += "\n" + pickT(FAV_TALK.fav_up) + "  好感度 +" + favChange;
    } else if (favChange === 0) {
      result += "\n（好感度不变）";
    } else {
      result += "\n" + pickT(FAV_TALK.fav_down) + "  好感度 " + favChange;
    }
    result += "  [" + mood.label + "]";

    const { level, leveledUp } = this._recalcLevel();
    if (leveledUp) {
      result += "\n\n" + pickT(FAV_TALK.level_up);
      result += "  关系升级：「" + level.name + "」" + level.icon;
      result += "\n" + level.desc;
    }

    const events = this._checkEvents();
    for (const evt of events) {
      result += "\n\n◆ 触发事件：" + evt.name;
      result += "\n" + evt.desc;
      if (evt.reward.fav) result += "  好感度 +" + evt.reward.fav;
      if (evt.reward.crystal) result += "  水晶 +" + evt.reward.crystal;
    }

    this._saveWithRank();
    return result;
  }

  // ============================================================
  //  核心：自由送礼
  // ============================================================

  giveGift(giftName, cost) {
    const now = Date.now();

    if (now - this.lastGiftTime < FAV_GIFT_COOLDOWN * 1000) {
      const wait = FAV_GIFT_COOLDOWN - Math.floor((now - this.lastGiftTime) / 1000);
      return "等等……才刚送过，让" + BOT_PRONOUN + "缓 " + wait + " 秒。";
    }

    let amount = FAV_GIFT_MIN_COST;
    if (cost !== undefined && !isNaN(cost)) {
      amount = Math.max(FAV_GIFT_MIN_COST, parseInt(cost));
    } else {
      const match = giftName.match(/(\d+)$/);
      if (match) {
        amount = Math.max(FAV_GIFT_MIN_COST, parseInt(match[1]));
        giftName = giftName.replace(/\d+$/, "").trim();
      }
    }

    const money = seal.vars.intGet(this.ctx, "$m金钱")[0] || 0;
    if (money < amount) {
      return "你摸了摸口袋……连 " + amount + " 金钱都没有？穷鬼退散。";
    }
    seal.vars.intSet(this.ctx, "$m金钱", money - amount);

    const today = getTodayDay();
    const decay = this._applyDecay();
    const mood = this._getMood();

    const valueLabel = getGiftValueLabel(amount);
    const favMap = {
      trash:   { min: -5, max: 1 },
      cheap:   { min: -3, max: 3 },
      normal:  { min: 0,  max: 5 },
      premium: { min: 1,  max: 8 },
      high:    { min: 2,  max: 12 },
      extreme: { min: 5,  max: 15 },
    };
    const range = favMap[valueLabel] || favMap.normal;
    let baseFav = getRandomInt(range.min, range.max);
    baseFav += mood.weight;
    const finalChange = baseFav + getRandomInt(-2, 2);

    this.fav += finalChange;
    this.totalGifts++;
    this.totalInteract++;
    this.todayGifts++;
    this.lastInteractDay = today;
    this.lastGiftTime = now;

    if (finalChange <= -4) {
      this.favHistory.push({
        type: "gift_fail", value: finalChange, time: Date.now(),
        reason: "送了 " + giftName + "（" + amount + " 金钱）把" + this.targetName + "惹毛了",
      });
    }

    let talk = "";
    if (finalChange > 3) talk = pickT(FAV_TALK.gift_good);
    else if (finalChange < 0) talk = pickT(FAV_TALK.gift_bad);
    else talk = pickT(FAV_TALK.gift_neutral);

    let valueComment = "";
    if (valueLabel === "high" || valueLabel === "extreme") {
      valueComment = "\n" + t("这东西……不便宜吧？");
    } else if (valueLabel === "cheap" || valueLabel === "trash") {
      valueComment = "\n" + t("……就这点诚意？");
    }

    let result = "你送了「" + giftName + "」（价值 " + amount + " 金钱）。";
    result += "\n" + talk;
    if (valueComment) result += valueComment;

    if (decay > 0) {
      result += "\n（" + decay + " 天没来，好感度自动减了 " + decay + "）";
    }

    if (finalChange > 0) {
      result += "\n" + pickT(FAV_TALK.fav_up) + "  好感度 +" + finalChange;
    } else if (finalChange === 0) {
      result += "\n（好感度不变……白送了？）";
    } else {
      result += "\n" + pickT(FAV_TALK.fav_down) + "  好感度 " + finalChange;
    }
    result += "  [" + mood.label + "]";

    const { level, leveledUp } = this._recalcLevel();
    if (leveledUp) {
      result += "\n\n" + pickT(FAV_TALK.level_up);
      result += "  关系升级：「" + level.name + "」" + level.icon;
      result += "\n" + level.desc;
    }

    const events = this._checkEvents();
    for (const evt of events) {
      result += "\n\n◆ 触发事件：" + evt.name;
      result += "\n" + evt.desc;
      if (evt.reward.fav) result += "  好感度 +" + evt.reward.fav;
      if (evt.reward.crystal) result += "  水晶 +" + evt.reward.crystal;
    }

    this._saveWithRank();
    return result;
  }

  // ============================================================
  //  查询（支持查别人对某目标的好感度）
  // ============================================================

  query(targetUserId, targetId) {
    const qUserId = targetUserId || this.userId;
    const qTargetId = targetId || this.targetId;
    const storageKey = BOT_STORAGE_PREFIX + qUserId + ":" + qTargetId;
    const allData = JSON.parse(ext.storageGet(storageKey) || "{}");

    if (!allData.fav && allData.fav !== 0) {
      const name = allData.name || qUserId;
      return "「" + name + "」和「" + (allData.targetName || qTargetId) + "」？还没建立过关系呢。";
    }

    const fav = allData.fav;
    const level = getFavLevel(fav);
    const targetShow = allData.targetName || qTargetId;

    let res = "📊 「" + (allData.name || qUserId) + "」→「" + targetShow + "」的好感度数据：";
    res += "\n\n💕 好感度：" + fav;
    res += "\n" + level.icon + " 关系等级：" + level.name;
    res += "\n" + level.desc;
    res += "\n\n📝 累计互动：" + (allData.totalInteract || 0) + " 次";
    res += "\n🎁 送出礼物：" + (allData.totalGifts || 0) + " 次";

    const today = getTodayDay();
    const daysGone = today - (allData.lastInteractDay || 0);
    if (daysGone <= 1) {
      res += "\n📅 最近来过：就是今天/昨天";
    } else {
      res += "\n📅 已经 " + daysGone + " 天没来了……";
    }

    const nextLevel = FAV_LEVELS.find(l => l.id === level.id + 1);
    if (nextLevel) {
      const need = Math.max(1, nextLevel.min - fav);
      res += "\n\n📈 下一级（" + nextLevel.name + "）还需好感：" + need;
    } else {
      res += "\n\n👑 已达最高等级。";
    }

    const crashes = (allData.favHistory || []).filter(h => h.type === "crash" || h.type === "gift_fail");
    if (crashes.length > 0) {
      const lastCrash = crashes[crashes.length - 1];
      res += "\n\n💢 黑历史：" + (lastCrash.reason || "不明事件") + "（好感 " + lastCrash.value + "）";
    }

    return res;
  }

  // ============================================================
  //  排行榜（按目标分组）
  // ============================================================

  static getRank(ctx, targetId) {
    const tId = targetId || "default";
    const prefix = BOT_STORAGE_PREFIX;
    const allStorage = {};  // 无法遍历 ext.storageGet，需要通过已知用户列表

    // 从所有可能的 key 中读取
    // 这里通过遍历 Favorability 已知数据的方式比较困难
    // 改用按目标汇总的方式：从每个用户的存储读取
    // 由于无法遍历所有 key，改为通过已知用户手动查询
    // 实际上更简单的方式：直接返回按当前群/平台汇总

    // 由于 ext.storage 没有遍历 API，这里通过运行时缓存来收集
    // 实际部署时，排行榜依赖各用户主动查询时积累的数据
    // 这里提供一种简化方案：仅返回本群已互动的用户排名

    // 使用一个辅助存储来收集排名数据
    const rankData = JSON.parse(ext.storageGet(BOT_STORAGE_PREFIX + "_rankcache_" + tId) || "{}");
    const arr = [];
    for (const [uid, data] of Object.entries(rankData)) {
      if (data.platform === ctx.endPoint.platform) {
        arr.push([data.fav || 0, data.name || uid]);
      }
    }

    if (arr.length === 0) {
      return "目前还没有人和「" + (tId === "default" ? BOT_NAME : tId) + "」建立关系……你是第一个吗？";
    }

    descValueSort(arr);
    const targetShow = tId === "default" ? BOT_NAME : tId;

    let res = "📊 好感度排行榜 —— 谁和「" + targetShow + "」最有交集：\n";
    for (let i = 0; i < Math.min(arr.length, FAV_RANK_SHOW); i++) {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + ".";
      const level = getFavLevel(arr[i][0]);
      res += "\n" + medal + " " + arr[i][1] + " —— " + arr[i][0] + "  [" + level.icon + level.name + "]";
    }

    if (arr.length >= 3) {
      const last = arr[arr.length - 1];
      res += "\n\n💢 垫底的「" + last[1] + "」——你反省一下自己。";
    }

    return res;
  }

  // 更新排行榜缓存（每次保存时调用）
  _updateRankCache() {
    const tId = this.targetId;
    const rankData = JSON.parse(ext.storageGet(BOT_STORAGE_PREFIX + "_rankcache_" + tId) || "{}");
    rankData[this.userId] = {
      name: this.userName,
      platform: this.ctx.endPoint.platform,
      fav: this.fav,
    };
    ext.storageSet(BOT_STORAGE_PREFIX + "_rankcache_" + tId, JSON.stringify(rankData));
  }

  // 改写 _save 以包含排行榜缓存
  _saveWithRank() {
    this._save();
    this._updateRankCache();
  }

  // ============================================================
  //  等级列表
  // ============================================================

  static listLevels() {
    let res = "📊 关系等级一览：\n\n";
    for (const level of FAV_LEVELS) {
      const range = level.max >= 9999 ? level.min + "+" : level.min + " ~ " + level.max;
      res += level.icon + " " + level.name + "（" + range + "）\n";
      res += "  " + level.desc + "\n\n";
    }
    return res;
  }

  // ============================================================
  //  黑历史
  // ============================================================

  getHistory() {
    if (this.favHistory.length === 0) {
      return "目前还没有什么值得一提的事迹。";
    }
    let res = "📜 " + this.userName + " 的「光辉事迹」（关于 " + this.targetName + "）：\n";
    const recent = this.favHistory.slice(-10).reverse();
    for (const h of recent) {
      const date = new Date(h.time).toLocaleDateString();
      if (h.type === "crash" || h.type === "gift_fail") {
        res += "\n💢 " + date + " " + (h.reason || "不明原因") + "（" + h.value + "）";
      } else if (h.type === "decay") {
        res += "\n💤 " + date + " " + (h.reason || "长期失踪") + "（" + h.value + "）";
      }
    }
    return res;
  }
}

// ============================================================
//  七、扩展注册与命令处理
// ============================================================

let ext = seal.ext.find("Favorability3");
if (!ext) {
  ext = seal.ext.new("Favorability3", "kakakumous", "3.0.0");
  seal.ext.register(ext);
}

// ============================================================
//  插件 UI 配置（在骰子设置界面中可调）
// ============================================================

seal.ext.registerStringConfig(ext, "命令前缀", "◆好感◆", "所有好感度命令必须以此前缀开头，防止日常对话误触发");
seal.ext.registerStringConfig(ext, "目标称呼", BOT_NAME, "默认目标对象的称呼（可改为任意名字）");
seal.ext.registerStringConfig(ext, "身份标签", BOT_TITLE, "目标对象的身份标签");
seal.ext.registerStringConfig(ext, "人称代词", BOT_PRONOUN, "目标对象的人称代词：他/她/祂");
seal.ext.registerIntConfig(ext, "每日互动上限", FAV_MAX_DAILY_INTERACT, "每日与目标互动的最大次数");
seal.ext.registerIntConfig(ext, "每日衰减值", FAV_DECAY_PER_DAY, "每日不互动时好感度衰减的点数");
seal.ext.registerIntConfig(ext, "衰减阈值", FAV_DECAY_THRESHOLD, "好感度低于此值时不再衰减");
seal.ext.registerIntConfig(ext, "送礼冷却/秒", FAV_GIFT_COOLDOWN, "两次送礼之间的最小间隔秒数");
seal.ext.registerIntConfig(ext, "排行榜人数", FAV_RANK_SHOW, "好感度排行榜最多显示的人数");
seal.ext.registerIntConfig(ext, "送礼最低消费", FAV_GIFT_MIN_COST, "送礼最低消耗的金钱数量");

function loadFavConfig() {
  BOT_NAME = seal.ext.getStringConfig(ext, "目标称呼") || BOT_NAME;
  BOT_TITLE = seal.ext.getStringConfig(ext, "身份标签") || BOT_TITLE;
  BOT_PRONOUN = seal.ext.getStringConfig(ext, "人称代词") || BOT_PRONOUN;
  FAV_MAX_DAILY_INTERACT = seal.ext.getIntConfig(ext, "每日互动上限");
  FAV_DECAY_PER_DAY = seal.ext.getIntConfig(ext, "每日衰减值");
  FAV_DECAY_THRESHOLD = seal.ext.getIntConfig(ext, "衰减阈值");
  FAV_GIFT_COOLDOWN = seal.ext.getIntConfig(ext, "送礼冷却/秒");
  FAV_RANK_SHOW = seal.ext.getIntConfig(ext, "排行榜人数");
  FAV_GIFT_MIN_COST = seal.ext.getIntConfig(ext, "送礼最低消费");
}

loadFavConfig();

// 解析命令中的目标对象标识
// 格式：命令 <目标>，如"早安 助手"、"送 花 50 助手"
// 目标可以是配置的 BOT_NAME 或其他自定义名称
function parseTarget(cmd, parts, startIndex) {
  // 默认目标
  let targetId = "default";
  let targetName = BOT_NAME;
  let cmdRest = cmd;

  // 检查最后一部分是否为目标标识
  if (parts.length > startIndex) {
    const last = parts[parts.length - 1];
    // 如果最后一部分不是纯数字（金额），则视为目标
    if (isNaN(last)) {
      targetId = last;
      targetName = last;
      // 从命令中移除目标部分
      cmdRest = parts.slice(0, -1).join(" ");
    }
  }

  return { targetId, targetName, cmdRest };
}

function favCmdPrefix() { return seal.ext.getStringConfig(ext, "命令前缀") || "◆好感◆"; }

ext.onNotCommandReceived = (ctx, msg) => {
  const raw = msg.message.trim();
  const prefix = favCmdPrefix();
  // 非前缀命令 → 放行给其他扩展
  if (!raw.startsWith(prefix)) return seal.ext.newCmdExecuteResult(false);
  const cmd = raw.slice(prefix.length).trim();
  const parts = cmd.split(/\s+/);
  loadFavConfig(); // 刷新最新配置

  // ========== 打招呼（支持指定目标） ==========
  // 早安 [目标]  早安 助手
  if (parts[0] === "早安" || parts[0] === "早上好") {
    const { targetId, targetName } = parseTarget(cmd, parts, 1);
    const f = new Favorability(ctx, targetId, targetName);
    seal.replyToSender(ctx, msg, f.interact("morning"));
    return seal.ext.newCmdExecuteResult(true);
  }

  if (parts[0] === "晚安" || parts[0] === "晚上好") {
    const { targetId, targetName } = parseTarget(cmd, parts, 1);
    const f = new Favorability(ctx, targetId, targetName);
    seal.replyToSender(ctx, msg, f.interact("evening"));
    return seal.ext.newCmdExecuteResult(true);
  }

  if (parts[0] === "你好" || parts[0] === "嗨" || parts[0] === "hi" || parts[0] === "hello" || parts[0] === "在吗") {
    const { targetId, targetName } = parseTarget(cmd, parts, 1);
    const f = new Favorability(ctx, targetId, targetName);
    seal.replyToSender(ctx, msg, f.interact("general"));
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看好感度 ==========
  // 好感度 [目标]  好感度 助手
  if (cmd === "查看好感度" || cmd === "好感度" || cmd === "查好感" || parts[0] === "好感度" || parts[0] === "查好感") {
    let targetId = "default";
    let targetName = BOT_NAME;
    if (parts.length > 1) {
      targetId = parts[1];
      targetName = parts[1];
    }
    const f = new Favorability(ctx, targetId, targetName);
    seal.replyToSender(ctx, msg, f.query());
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 等级列表 ==========
  if (cmd === "好感度等级" || cmd === "关系等级" || cmd === "等级列表") {
    seal.replyToSender(ctx, msg, Favorability.listLevels());
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 排行榜 ==========
  // 好感度排行榜 [目标]  好感度排行榜 助手
  if (cmd === "好感度排行榜" || cmd === "好感排行" || parts[0] === "好感度排行榜" || parts[0] === "好感排行") {
    let targetId = "default";
    if (parts.length > 1) targetId = parts[1];
    seal.replyToSender(ctx, msg, Favorability.getRank(ctx, targetId));
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 黑历史 ==========
  if (cmd === "黑历史" || cmd === "光辉事迹") {
    const f = new Favorability(ctx);
    seal.replyToSender(ctx, msg, f.getHistory());
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 自由送礼 ==========
  // 送 <物品> [金额] [目标]
  // 给 <物品> [金额] [目标]
  // 送礼 <物品> [金额] [目标]
  // 送给骰娘 <物品> [金额]（兼容旧版）
  if (cmd.startsWith("送给骰娘 ") || cmd.startsWith("送 ") || cmd.startsWith("给 ") || cmd.startsWith("送礼 ")) {
    const prefix = cmd.startsWith("送给骰娘 ") ? "送给骰娘 " :
                   cmd.startsWith("送礼 ") ? "送礼 " :
                   cmd.startsWith("给 ") ? "给 " : "送 ";
    let rest = cmd.slice(prefix.length).trim();
    if (!rest) {
      seal.replyToSender(ctx, msg, "想送什么？直接说「送 <物品名> [金额] [目标]」。\n比如：送 玫瑰花 50  或  送 蛋糕 100 助手");
      return seal.ext.newCmdExecuteResult(true);
    }

    const restParts = rest.split(/\s+/);

    // 判断最后一部分是否为目标（非数字）
    let targetId = "default";
    let targetName = BOT_NAME;
    let giftName = rest;
    let amount = undefined;

    if (restParts.length >= 2) {
      const last = restParts[restParts.length - 1];
      const secondLast = restParts[restParts.length - 2];

      if (isNaN(last)) {
        // 最后一部分是目标名称
        targetId = last;
        targetName = last;
        rest = restParts.slice(0, -1).join(" ");
      }
    }

    // 从剩余部分提取金额
    const amountMatch = rest.match(/(\d+)$/);
    if (amountMatch) {
      amount = parseInt(amountMatch[1]);
      giftName = rest.slice(0, rest.lastIndexOf(amountMatch[1])).trim();
    } else {
      giftName = rest;
    }

    const f = new Favorability(ctx, targetId, targetName);
    seal.replyToSender(ctx, msg, f.giveGift(giftName, amount));
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 帮助 ==========
  if (cmd === "好感度帮助" || cmd === "好感帮助") {
    seal.replyToSender(ctx, msg, "\
💬 好感度系统使用指南\n\n\
日常互动（好感随机增减）：\n\
  早安 / 早上好          早上打招呼（-4 ~ +5）\n\
  晚安 / 晚上好          晚上道晚安（-4 ~ +5）\n\
  你好 / 嗨 / hi         日常互动（-4 ~ +5）\n\
  ※ 每日互动上限：" + FAV_MAX_DAILY_INTERACT + " 次\n\
  ※ " + BOT_NAME + "的心情和人品值会影响结果\n\
  ※ 可指定目标：早安 助手  晚安 洛洛\n\n\
自由送礼：\n\
  送 <物品名> [金额] [目标]     送出任意礼物\n\
  给 <物品名> [金额] [目标]\n\
  送礼 <物品名> [金额] [目标]\n\
  ※ 例：送 玫瑰花 50  给 蛋糕 100 助手\n\
  ※ 金额不写则默认最低消费 " + FAV_GIFT_MIN_COST + "\n\
  ※ 礼物价值越高，好感可能加得越多\n\
  ※ 送太便宜的东西……" + BOT_NAME + "会不高兴\n\n\
查询：\n\
  好感度 [目标]         查看好感度数据\n\
  好感度等级 / 关系等级  查看所有等级\n\
  好感度排行榜 [目标]   看谁好感度最高\n\
  黑历史 / 光辉事迹     看看你干过什么好事\n\n\
多目标支持：\n\
  本系统支持对多个对象建立好感度。\n\
  在命令末尾加上目标名称即可切换目标。\n\
  例：早安 助手  送 蛋糕 100 洛洛  查好感 导师\n\n\
自定义配置：\n\
  修改代码顶部常量可改变称呼：\n\
  BOT_NAME = \"骰娘\"   → 目标默认名称\n\
  BOT_TITLE = \"骰娘\"  → 身份标签\n\
  BOT_PRONOUN = \"她\"  → 人称代词");
    return seal.ext.newCmdExecuteResult(true);
  }
};
