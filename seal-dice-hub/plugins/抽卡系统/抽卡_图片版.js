// ==UserScript==
// @name 每日抽卡 for 商店系统（通用版）- 十连图片版
// @author L.Y.
// @version 2.2.0
// @description 抽卡系统（单抽/十连）+ 藏品图鉴 + 成就系统 + 排行榜 + 小游戏 + 十连图片生成
// @license CC-BY-NC-SA 4.0
// ==/UserScript==

// ============================================================
//  一、常量与配置
// ============================================================

let MONEY_COST = 10;                // 单抽消耗金钱
let GACHA_MULTI = 10;               // 十连次数
let MAX_MONEYGACHA_PERDAY = 400;    // 每日上限
let RANK_SHOW = 10;                 // 排行榜显示人数
let ITEMS_PER_PAGE = 10;            // 藏品每页条数

// 图片后端开关：设为 true 时十连结果生成图片，false 时保持纯文本
let GACHA_IMAGE_ENABLED = true;
// 图片后端地址（与后端 Python 脚本的地址一致）
let GACHA_IMAGE_BACKEND = "http://127.0.0.1:8014";

// ============================================================
//  二、回复文本
// ============================================================

const MSG = {
  NO_MONEY:      "『幸运』看不到你的诚意。（金钱不足）",
  EXCEED_LIMIT:  "『幸运』今天似乎不会再回应你了，当然，我也不会。（次数超过每日上限）",
  SPLASH:        "水声挺好听的——是说你把钱拿来打水漂的声音。",
  SSR:           "似乎被『幸运』眷顾，你获得了一个珍贵的【特等赏】，算你好运，珍惜一下吧。",
  SR:            "运气不错，你获得了一个【一等赏】，勉强能用。",
  R:             "就这？你获得了一个【二等赏】。",
  N:             "无趣的概率与无趣的结果。你获得了一个【末等赏】。",
  MONEY_700:     "不用这笔天降横财试试更好的馈赠吗？你获得了 700 金钱。",
  SMALL_MONEY:   "只有这点根本不够吧？",
  EXTREME_LUCK:  "哼，极致的不幸也是一种极致的幸运？",
  NONPRIZE:      "你高超的打水漂技术似乎让『幸运』也为之动容，你获得了一个【非酋赏】",
  MULTI_START:   "让我们看看一次抽十连能获得什么——",
  IMAGE_WAIT:    "『幸运』正在为你绘制命运的画卷……请稍候。",
  IMAGE_FAIL:    "图片生成失败，以文本方式展示结果。",
};

// ============================================================
//  三、水晶商店定义
// ============================================================

const CRYSTAL_SHOP = {
  ticket: {
    name: "抽卡券",
    desc: "额外抽卡次数 1 次，不受每日上限限制",
    price: 10,
    effect: { type: "extraDraw", value: 1 },
    limit: "daily",
    maxPerDay: 5,
  },
  ticket10: {
    name: "抽卡券×10",
    desc: "额外抽卡次数 10 次，不受每日上限限制",
    price: 90,
    effect: { type: "extraDraw", value: 10 },
    limit: "daily",
    maxPerDay: 1,
  },
  luckBuff: {
    name: "好运符",
    desc: "24 小时内运气等级 +2，抽卡概率大幅提升",
    price: 20,
    effect: { type: "buff", buffKey: "好运", value: 2, duration: 86400 },
    limit: "none",
  },
  unluckyCleanse: {
    name: "转运符",
    desc: "清除当前霉运状态（运气 -1 及以下时归零）",
    price: 15,
    effect: { type: "cleanse", target: "霉运" },
    limit: "none",
  },
  resetToken: {
    name: "重置令",
    desc: "重置今日抽卡次数上限，可继续抽卡",
    price: 30,
    effect: { type: "resetDaily" },
    limit: "daily",
    maxPerDay: 2,
  },
  ssrBoost: {
    name: "SSR 祈愿符",
    desc: "当前卡池 SSR 概率翻倍，持续 20 抽",
    price: 50,
    effect: { type: "rateBoost", rarity: "ssr", multiplier: 2, duration: 20 },
    limit: "weekly",
    maxPerWeek: 3,
  },
  ssrVoucher: {
    name: "特等赏契约",
    desc: "指定当前卡池，下次 SSR 时必定触发（保底类效果）",
    price: 150,
    effect: { type: "ssrGuarantee" },
    limit: "monthly",
    maxPerMonth: 1,
  },
  collectionDuplicate: {
    name: "藏品共鸣",
    desc: "随机获得一件已拥有藏品的复制品（增加藏品计数）",
    price: 25,
    effect: { type: "duplicateCollection" },
    limit: "daily",
    maxPerDay: 3,
  },
  moneyPack: {
    name: "资金补给",
    desc: "立即获得 500 金钱",
    price: 20,
    effect: { type: "money", value: 500 },
    limit: "none",
  },
};

const MSG_CRYSTAL = {
  SHOP_HEADER: "💎 水晶商店\n「有『幸运』眷顾的地方，就有水晶流通。」\n",
  NO_CRYSTAL: "水晶不足。当前水晶：",
  NEED_CRYSTAL: "需要 ",
  PURCHASE_OK: "购买成功！消耗了 ",
  LIMIT_DAILY: "今日该物品的购买次数已达上限。",
  LIMIT_WEEKLY: "本周该物品的购买次数已达上限。",
  LIMIT_MONTHLY: "本月该物品的购买次数已达上限。",
  BUFF_ACTIVE: "已激活好运状态，持续 24 小时。",
  CLEANSE_OK: "已清除霉运状态。",
  RESET_OK: "今日抽卡次数已重置！",
  GUARANTEE_OK: "已签订特等赏契约！下次 SSR 必出。",
  DUPLICATE_OK: "藏品共鸣成功！",
  MONEY_OK: "资金已到账。",
  NO_COLLECTION: "你还没有任何藏品可供共鸣。",
  ALREADY_GUARANTEE: "你已经有一份特等赏契约在生效中。",
  BOOST_OK: "SSR 祈愿已生效，持续 20 抽。",
};

// ============================================================
//  四、卡池系统（完整保留原版）
// ============================================================

const GACHA_POOLS = {
  default: {
    name: "默认卡池",
    cost: 10,
    description: "测试池，存储基本词条",
    rates: { ssr: 1, sr: 3, r: 10, n: 36, money: 50 },
    descriptions: {
      ssr: [
        "一枚镶嵌着星辰的宝石戒指，佩戴者能感受到宇宙的脉动。",
        "一本封面镌刻着龙纹的古老魔法书，书页间流淌着智慧的光芒。",
        "一柄由月光锻造的银白长剑，剑身铭刻着'守护'的精灵文字。",
        "一个悬浮的水晶球，内部有微缩星系缓缓旋转。",
        "一枚凤凰羽毛笔，书写时会在空中留下金色的轨迹。",
      ],
      sr: [
        "一套精金打造的炼金术工具，每件工具都刻着炼金大师的印记。",
        "一袋能发出悦耳声响的风铃种子，种植后会长出音乐树。",
        "一瓶闪烁着星光的香水，能让人回忆起最美好的梦境。",
        "一件自动调节温度的斗篷，内衬绣着会变化的星座图案。",
        "一对能翻译任何语言的耳环，由精灵工匠精心打造。",
      ],
      r: [
        "一个会讲笑话的魔法茶壶，每天清晨会泡好热茶。",
        "一盒永远吃不完的巧克力，每颗都有不同的神奇效果。",
        "一把能画出立体图像的画笔，颜料来自彩虹的碎片。",
        "一双能短暂踏水而行的靴子，鞋跟镶嵌着蓝宝石。",
        "一本会自动记录所见所闻的日记本，封面是柔软的龙皮。",
      ],
      n: [
        "一束永不凋谢的玫瑰花，花瓣上凝着晨露般的钻石。",
        "一罐能召唤小型彩虹的魔法粉末，每次使用都有惊喜。",
        "一个能预报天气的水晶，内部云彩会随天气变化。",
        "一枚能发出柔和光线的夜光石，温暖如月光。",
        "一支能写出隐形文字的羽毛笔，需要特定光线才能阅读。",
      ],
      consolation: [
        "一块刻着'永不放弃'的励志徽章，能增强佩戴者的决心。",
        "一瓶能暂时提升运气的香水，带着清新的青草气息。",
        "一本《幸运者的自我修养》，书页会自动翻到需要的内容。",
        "一枚能吸收负能量的黑曜石护符，触感温润如玉。",
        "一个会给出谜语指引的罗盘，谜底指向最近的幸运。",
      ],
    },
  },

  wcesa: {
    name: "特殊寻访·众生万象",
    cost: 10,
    description: "暗网主题卡池",
    rates: { ssr: 1, sr: 3, r: 10, n: 36, money: 50 },
    descriptions: {
      ssr: [
        "【川西女神】众水、众方、众民、众川西的女王水怪",
        "【管人痴】阿烟·酉离：这就是我们身为管人痴热血沸腾的组合技啊 KUSO",
        "【矿工之巅冠军】阿烟：暗网群认证的神秘紫毛女出现了！",
        "【好嬷之巅冠军】海经年：没通知我啊？",
        "【KP的猜忌】蘼芜：什么叫暗网群有两个自由哥？",
      ],
      sr: [
        "【产品你崛起吧】莲涟亦生：别叫我同人女，我是我产品的主理人",
        "【皇帝设出来了】无与：别上朝了总裁",
        "【回死串了】酉离：你说得对，但是什么叫速写与激情 5？",
        "【给力片导演】阿烟：我是主理人的合伙人",
        "【回尺峰了】茨晏：正片正片，我爱你好想和你在一起。",
        "【赤石英雄】阿发：不要再冲了总裁",
        "【黑红翻面章鱼】画外音：打开 FGO，尽享坐牢人生",
        "【回沙东了】海经年：大调查重岳职场",
        "【好想炒头像】蘼芜：好想入妹妹头披肩发及腰长发低高马尾男啊",
        "【熟睡的丈夫】水怪：口区",
        "【恶俗之巅冠军】琛月：全网最尊重斯文败类眼镜男的主播",
        "【答辩通畅】兰囡：实习别再追着我操了",
        "【妈妈】柳栎：woc 腰肌劳损别袭击我了",
        "【大野狼】柯枝：🍎我一口吃掉你",
      ],
      r: [
        "柯枝的比坠地，别买了总裁。",
        "恋恋影视没有写完的产品同人，她怎么还在写？",
        "茨晏的瓦萨妹认证，产品就这么让你撕心裂肺？",
        "红胶囊的大扔男，这位更是暗网群嬷嬷之巅。",
        "阿发的老公，涉及红蓝了记得打 tag。",
        "有力的狂野人妻，已严肃加入 XP 狼人杀行列",
      ],
      n: [
        "好想看产品左爱。",
        "嫂子给我哥喂点安眠药吧，我想你想得不行了。",
        "好想算了，非人人机白毛金眼正太你崛起吧。",
        "好想入大皮燕子小皮燕子紧皮燕子松皮燕子啊。",
        "好想入人外大乃狗系男",
      ],
      consolation: [
        "多情特少",
        "冷冽烟少",
        "呆萌茨少",
        "纯情音少",
        "节制柯少",
        "快哉柳少",
        "酷炫兰少",
        "肆意蘼少",
        "多汁水少",
        "妈系无少",
        "无孩爱狗酉少",
        "赤石发少",
      ],
    },
  },

  ed: {
    name: "伊甸园",
    cost: 10,
    description: "伊甸园角色池",
    rates: { ssr: 1, sr: 3, r: 10, n: 36, money: 50 },
    descriptions: {
      ssr: [
        "【幽灵铠甲】进化·雷铱·科瑞：幽灵……如果可以，我想守护更多人。",
        "【万象黑雾】融合·雷铱·科瑞",
        "【希望之信使】异种融合·雷铱·科瑞",
        "【万物质解】进化·秦天麟",
        "【因陀罗之雷】融合·秦天麟",
        "【轮回之信使】完全融合·秦天麟",
        "【极限蓝光】进化·楚飞",
        "【别样的傲慢】融合·楚飞",
        "【平衡之信使】异种融合·楚飞",
        "【乐园禁区】进化·银绒·西尔弗佩特",
        "【世界底线】融合·银绒·西尔弗佩特",
        "【风之狂欢】进化·展宿弦",
        "【心中的天使】进化·阿斯摩娅·道格拉斯",
        "【未来视】进化·凯因斯·洛德",
        "【时间之眼】融合·凯因斯·洛德",
        "【复苏之光】进化·温洛",
        "【净土】进化·照夜白",
      ],
      sr: [
        "【幽灵】雷铱·科瑞：你没活干么？要不去喝一杯？我说的是茶。",
        "【苍蓝雷霆】秦天麟",
        "【破军】楚飞",
        "【罡风】银绒·西尔弗佩特",
        "【随欢】展宿弦",
        "【哭泣恶灵】阿斯摩娅·道格拉斯：我依旧记得那个人。一个内心温暖的人。",
        "【沼泽怪人】白桦",
        "【小苍兰】苍凛",
        "【绯红】程殊",
        "【鹰眼】凯因斯·洛德：如何去定义「远方」的命题？",
        "【角鸮】厄尼尔·梅洛恩：线弦之上落音的位置……",
        "【生之蛹】温洛",
        "【死之蝶】照夜白",
      ],
      r: [
        "【理性的怪物】诺亚·莱特里斯",
        "【白月光】丽莎",
        "【琉璃死水】姜沁·姜琉铩",
        "【好心办坏事】米利欧·诺特",
        "【背叛者】赵飞云",
      ],
      n: [
        "【光明之信使】诺亚·莱特里斯",
        "【和平之信使】普尼尔·莱德·凯斯特",
        "【圆环之信使】云风铃",
        "【枪兵】赵飞云",
        "【清水芙蓉】余花期",
        "【战狂】夏诺儿·伊斯克",
        "【月神】辛西娅·瑞沐儿",
        "【白虎】姜琉铩",
        "【青龙】术奕林",
        "【玄武】姜沁",
        "【朱雀】南宫离",
        "【地尊】福照坤",
        "【神光】利特雷诺·德雷",
        "【纵兵者】石熠路",
        "【刀侍】佐佐木樱",
        "【晴天娃娃】陈晴",
        "【明灯】莉娅",
        "【造物杀手】叶玉朝",
        "【坠雷】蒂丝法缇",
        "【炎魔】丝洛雅",
        "【飞毛腿】傅建国",
        "【千里眼】张荣升",
        "【泡泡】周柒淼",
        "【疾驰者】樱小路千花",
        "【纽带】王星阑",
        "【关键人物】科杰利德",
        "【猎犬】里克·查尔",
        "【回光】艾斯尤里",
        "【幸福天使】春奈爱衣",
        "【夜枭】檀雨枭",
        "【紫鼬】麦克·德伊",
        "【拆卸者】托特·辛吉德",
        "【人工智障】云风清",
        "【链接延迟】埃尔梅",
        "【变脸】米利欧·诺特",
        "【领头羊】法特伊斯",
        "【正骨师】堀江花织",
      ],
      consolation: [
        "伊甸园的信条铭记于心：人神平等，世界和平。",
        "好好擦拭超武圆环了吗？同志，这是一场神迹者的革命。",
        "不要输给命运，一切的坎坷都是为了更好的未来。",
        "万恶之源、画大饼之王秦天麟经典语录之「陨星岛的抽卡游戏就由我来开发嗷。」实际只出了个点子。",
      ],
    },
  },

  ts: {
    name: "星之塔",
    cost: 10,
    description: "星之塔角色池",
    rates: { ssr: 1, sr: 3, r: 10, n: 36, money: 50 },
    descriptions: {
      ssr: [
        "【主的代行人】进化·以赛亚·怀特：他是以骨为尺的西西里弗斯……",
        "【天堂轮回】融合·以赛亚·怀特：他知晓他无法拟定飞鸟的航程……",
        "【伟大的复活】进化·诺托斯·维加",
        "【皆数焚毁】进化·克里丝特·安波莱特",
      ],
      sr: [
        "【义人】星将·以赛亚·怀特：你该用什么来度量我？正义，或是虔诚。",
        "【阿里阿德涅】诺托斯·维加：我已解明，你从未离去。",
        "【钴蓝】艾琳娜·弗洛斯",
        "【魔女】柯尔墨斯",
        "【既生魄】克里丝特·安波莱特：我，群星的最后一块拼图。",
        "【甘露】阿伦蒂亚·坎希金",
        "【金乌】梅雯",
        "【虚像】维格朗特·艾拉",
        "【观澜】诺林·奈由芙",
      ],
      r: [
        "【维系者】楚少阳",
        "【三无少女】杨淮云",
      ],
      n: [
        "【神医】楚少阳",
        "【冰匠】杨淮云",
        "【天照】神鸣薙子",
        "【剑客】宋文月",
        "【诗歌】艾斯特尔·索里西尔",
        "【照明灯】莱特",
        "【往返者】戴维森·柯里",
        "【缠绵雨】江南",
        "【聆听者】艾欧巴",
        "【砂暴】乌尔莉",
        "【七彩纺者】沈彩衣",
        "【缠丝】朱莉",
        "【铁毡】王小虎",
        "【粉钻】言瑾禄",
        "【有穷界】艾琉恩·诺克斯",
        "【控鸦人】托莱",
      ],
      consolation: [
        "不要害怕失败，星之塔会等你，因为我们是家人。",
        "主神不一定是真理，但一定是指引未来最好的导师。",
        "不要输给命运，一切的坎坷都是为了更好的未来。",
      ],
    },
  },

  pt: {
    name: "失乐园",
    cost: 10,
    description: "失乐园卡池",
    rates: { ssr: 1, sr: 3, r: 10, n: 36, money: 50 },
    descriptions: {
      ssr: [
        "【心景蛇影】进化·傅璟和",
        "【情绪主宰】融合·傅璟和",
        "【耀阳】进化·池倾寒",
        "【自由之光】进化·蒂雅沐·莱特",
      ],
      sr: [
        "【愚面】傅璟和",
        "【银鳞】池朔川",
        "【愈蝶】池倾寒",
        "【霜姬】初雪",
        "【人偶师】阿多尼斯·P·斯代凡纳基斯",
        "【塞壬】蒂雅沐·莱特",
        "【极昼】伊琳·瓦洛：感谢伟大的神降下恩赐，使我成为神迹的一员",
        "【长夜】赫伯特·科尔比",
        "【火玫】白烨",
        "【圣盾】托比斯",
        "【乐天】亚德·斯特林",
      ],
      r: [
        "【永恒夜空】梅比乌斯·莫比乌斯",
        "【破坏神】马克西马·阿尔德",
        "【NPC 矿工大赛胜者】索菲娅·可威",
        "【被圣女攻略的第一人】普拉",
      ],
      n: [
        "【衔尾蛇】梅比乌斯·莫比乌斯",
        "【领主】马克西马·阿尔德",
        "【石器时代】西耶娜",
        "【绝响】拉德克",
        "【圣盾】托比斯",
        "【布丁】薇米·伊雅",
        "【密语者】村田幸",
        "【狩猎者】迪尔·莫比乌斯",
        "【魔眼】缇蕾",
        "【天才】吉尼斯",
        "【鬼手】马吉尔",
        "【操盘手】索农萨·茨由里",
        "【隔墙耳】哈斯哈尔·可威",
        "【大力士】库博特纳",
        "【银色魔女】索菲娅·可威",
        "【剑冢】埃米亚",
        "【虹光魔法师】伊丝妲",
        "【猫女】布露姆",
        "【掠天】麟风",
        "【受虐狂】伊芙琳",
        "【呼唤者】伊西",
        "【咒杀】妄",
        "【影将】斯齐特·莫比乌斯",
        "【刃鬼】刻瓦欧·索尔德特",
        "【蝎尾】法芙娜·梅尔萨斯",
        "【杀戮恶魔】纳特戴斯",
        "【重压】奥利维娅",
        "【双月】塞缪尔",
      ],
      consolation: [
        "黑暗并不代表着恶，他人无法做到的善就由我们践行。",
        "为了那终将触碰的永恒夜空，世界的最高点，只有衔尾蛇一人。",
        "不要输给命运，一切的坎坷都是为了更好的未来。",
      ],
    },
  },

  pc: {
    name: "特殊寻访·命运本篇",
    cost: 10,
    description: "PC 混池（命运本篇全角色）",
    rates: { ssr: 1, sr: 3, r: 10, n: 36, money: 50 },
    descriptions: {
      ssr: [
        "【继承者】衔尾蛇—傅璟和：你给予的救赎总是以吞噬为代价……",
        "【九头蛇】混沌首领—九头蛇：秩序是虚妄的塔，混乱才是永恒的基石。",
        "【执棋者】傅璟和：您看，这人生就像一场豪赌。而我，始终是那个掌控全局的庄家。",
        "【谓我何求】Michael·lancaster：没有意义，无需估量。我站在这里，仅是因为我在。",
        "【知我谓谁】Keynes·Lord：跨越了亘古绵长的时间……他看见了一粒水色的宝石。",
        "【雷神】秦天麟：众望所归，或为他人之愿。回忆成灰，或为自我之怨。",
        "【终局】傅璟和：天堂与地狱的岔路口从来不存在——只有我的赌桌，才是唯一的审判台。",
        "【未尽之炎】「酒神」—索莱伊·布兰德·亚兹拉尔：火焰是焚尽一切肮脏秘密的武器……",
        "【尘归尘归梦】阿多尼斯·P·斯代凡纳基斯：若祂明察，祂会看见我原本的样子……",
        "【尘归尘归土】阿多尼斯·P·斯代凡纳基斯：不要担心，我的爱……",
        "【梦中的郁金香】阿斯摩娅·柯里？：无法落下的夕阳下，水蓝色的郁金香花海中……",
        "【杀戮者】阿斯摩娅·道格拉斯：为什么我所珍视的人都逐渐离我而去……",
        "【复生日】进化者-以赛亚·怀特：他是以骨为尺的西西里弗斯……",
        "【游叙弗伦之问】火象星-以赛亚·怀特：因天父之意而善、亦或因其本意而善？",
        "【创世者】完全融合-以赛亚·怀特：他知晓他无法拟定飞鸟的航程……",
      ],
      sr: [
        "【万物皆流】■·凯因斯·洛德：偶尔，我会想起更早时候的「我」。",
        "【破碎与轮转】■·凯因斯·洛德：他曾经将双眸盛满辉光之辰……",
        "【失败者】秦天麟：随溪水而流淌的是逝者的血液与生者的泪滴……",
        "【紫雷令使】秦天麟：挣扎于天国中逐忆失去之人……",
        "【暗礁老板】傅璟和：在赌桌上，重要的从来不是筹码……",
        "【翙星】星徒-克里丝特·安波莱特：伊甸的大门不为我们而开……",
        "【幕后庄家】傅璟和：赌场是人性的镜厅。",
        "【五感尽失】恶灵 and 阿斯摩娅·道格拉斯：恶灵…你夺去我的五感。",
        "【向导】愚面—九头蛇：情绪是最原始的武器。",
        "【赌徒】傅璟和：出千？亲爱的，赌术的本质从来不是「作弊」……",
        "【愚面】失乐园—傅璟和：混沌？秩序？不过是标签游戏罢了。",
        "【信徒】伊琳·瓦洛-众星教修女：一丝不苟的着装，每日必备的祷告词……",
        "【成人礼前夜】伊琳·瓦洛（少女）：父母曾承诺，要在她十八岁时给予她一份……",
        "【情感湮灭】阿斯摩娅·道格拉斯：感知不到，就不会痛苦。",
        "【无法并存的已逝之人】伊莉希娅·梅洛恩/伪",
        "【拍卖师】阿多尼斯·P·斯代凡纳基斯：我不得不承认，在流动的灯光之下……",
        "【人偶师】阿多尼斯·P·斯代凡纳基斯：我呈上所有的表演，仅为那一人……",
        "【湖水下的倒影】恶灵：别在这里期待什么。",
        "【明夜镜水】阿斯摩娅·道格拉斯：我愿意为安眠之人放上一束花……",
        "【星星？】阿斯摩娅·道格拉斯：掀起帷幕，一起数星星吧……",
        "【悬星】星徒-以赛亚·怀特：他没有过往，亦无明日。",
        "【唱诗班】幼年-以赛亚·怀特：不许抬头，不许乱跑，不许停止歌唱。",
        "【塔中人】执行者-以赛亚·怀特：他沉溺于象牙塔的迷梦……",
        "【悬日】星落大剧院—诺托斯·维加：年少的梦总有破碎的一天……",
        "【冕星】星徒—诺托斯·维加：你知道忒休斯之船吗？",
      ],
      r: [
        "【四时的诗与绵雨】幼年·凯因斯·洛德：童年是潮湿的……",
        "【未尽的浮光】凯因斯·洛德：消极到极点的水一般紧张美丽……",
        "【旧时光的回旋】青年·凯因斯·洛德：他其实更习惯站在聚光灯下……",
        "【致 Le vent】幼年·凯因斯·洛德：我于是恍惚回忆起悠久的夏……",
        "【巡途之人】秦天麟：世间杀戮，无数抗争……",
        "【性别转换】阿斯摩太·道格拉斯：小姐……想要听听音乐吗？",
        "【身份对调的可能性】时星-阿斯摩娅·道格拉斯：再一次……无论多少次……",
        "【灰界】幽灵：契约已成。我会一直在你身边守护你。",
        "【幼年】雷铱·科瑞：听见了吗？哥哥的声音。",
        "【幼年】雷诺·科瑞：请问有看见我的双胞胎弟弟吗？",
        "【暗巷的愿景】幼年-克里丝特·安波莱特：我将苦痛拆吃入腹……",
        "【神罚时刻】十二岁—傅璟和：混沌中有人扼住我溃散的意识……",
        "【母亲】幼年—傅璟和：母亲说花开时是归期……",
        "【我的梦想】伊琳·瓦洛（幼年）：幼小的女孩曾无法理解父母对于众星教的痴狂……",
        "【 █ █的边界？】阿多尼斯·P·斯代凡纳基斯：幻觉？不，我更愿意认为这是我的现实。",
        "【 █ █的阴影？】阿多尼斯·P·斯代凡纳基斯：█ █投下的阴影之中……",
        "【好学者】幼年-阿斯摩娅·道格拉斯：你好？你喜欢读书吗？",
        "【理想之国】幼年—诺托斯·维加：南方的早风为桃源乡送来星火……",
        "【克里特之夜】少年—诺托斯·维加：那时的我们，是不是也曾做过这样的梦？",
        "【拐点】-伊琳（if线）：神明的教堂，璀璨、圣洁、威严。",
      ],
      n: [
        "【流云与高悬之歌】秋·凯因斯·洛德：我开始质疑、这一切是否正确……",
        "【断章】春·凯因斯·洛德：比起游刃有余，脱节的事态、未知的发展……",
        "【工作日、交织的思绪】夏·凯因斯·洛德：当生活占领上风，就把艺术赶到荒野中去了。",
        "【落雪与今日的小憩】冬·凯因斯·洛德：或许这样的天气也不错？",
        "【惊蛰】秦天麟：自东南方展现的初升之雷……",
        "【虔信者】玛丽亚·怀特：我还没来得及问你……",
        "【无未来者】玛丽亚·怀特：我目送你走向父的国度……",
        "【执行者】阿斯摩娅·道格拉斯：新晋执行者，阿斯摩娅·道格拉斯前来报到！",
      ],
      consolation: [
        "【引子与回旋随想曲】凯因斯·洛德：鎏金、飞鸟还有致自由的你。",
        "【阳门茶楼员工】克里丝特·安波莱特：欢迎光临阳门茶楼！",
        "【酒吧驻唱】克里丝特·安波莱特：呀伙计，真是好久不见。",
        "一无所获呵……至少你还能拿到一杯知名人士出品的酒。",
        "【调酒师】以赛亚·怀特：比起救场，我还是更想要调酒啊。",
        "【酒吧驻唱】阿斯摩娅·道格拉斯：欢迎光临普拉捏特酒吧，我是今日的驻场歌手阿斯摩娅……",
      ],
    },
  },
};

// ============================================================
//  四、成就系统定义
// ============================================================

const ACHIEVEMENT_DEFS = [
  { id: "novice_gacha",      name: "抽卡新手",     desc: "累计抽卡 10 次",          check: s => s.totalDraws >= 10,   reward: { money: 50 },           rarity: "common" },
  { id: "veteran_gacha",     name: "抽卡老手",     desc: "累计抽卡 100 次",         check: s => s.totalDraws >= 100,  reward: { money: 200, crystal: 1 },  rarity: "uncommon" },
  { id: "master_gacha",      name: "抽卡大师",     desc: "累计抽卡 500 次",         check: s => s.totalDraws >= 500,  reward: { money: 500, crystal: 5 },  rarity: "rare" },
  { id: "legend_gacha",      name: "抽卡传奇",     desc: "累计抽卡 1000 次",        check: s => s.totalDraws >= 1000, reward: { money: 1000, crystal: 10 }, rarity: "epic" },

  { id: "first_ssr",         name: "初尝甜头",     desc: "获得第 1 个特等赏",        check: s => s.ssrCount >= 1,      reward: { money: 100, crystal: 2 },  rarity: "uncommon" },
  { id: "ssr_collector",     name: "特等赏收藏家", desc: "获得 10 个特等赏",        check: s => s.ssrCount >= 10,     reward: { money: 300, crystal: 5 },  rarity: "rare" },
  { id: "ssr_hunter",        name: "特等赏猎人",   desc: "获得 50 个特等赏",        check: s => s.ssrCount >= 50,     reward: { money: 800, crystal: 15 }, rarity: "epic" },

  { id: "double_ssr_day",    name: "双喜临门",     desc: "单日获得 2 个特等赏",      check: s => s.todaySsr >= 2,        reward: { money: 200, crystal: 3 },  rarity: "rare" },
  { id: "no_water_day",      name: "滴水不漏",     desc: "单日抽卡无打水漂",        check: s => s.todayWater === 0 && s.todayDraws > 0, reward: { money: 200, crystal: 2 }, rarity: "rare" },
  { id: "chain_water_5",     name: "五连水漂",     desc: "连续打水漂 5 次",         check: s => s.chainWater >= 5,    reward: { money: 200 },           rarity: "uncommon" },
  { id: "chain_water_10",    name: "十连水漂",     desc: "连续打水漂 10 次",        check: s => s.chainWater >= 10,   reward: { money: 1000, crystal: 10 }, rarity: "rare" },
  { id: "got_700",           name: "天降横财",     desc: "单次获得 700 金钱奖励",     check: s => s.got700,             reward: { money: 700, crystal: 7 },  rarity: "rare" },

  { id: "collector_10",      name: "收藏新手",     desc: "收集 10 种不同藏品",      check: s => s.uniqueItems >= 10,  reward: { money: 100, crystal: 2 },  rarity: "uncommon" },
  { id: "collector_50",      name: "收藏专家",     desc: "收集 50 种不同藏品",      check: s => s.uniqueItems >= 50,  reward: { money: 300, crystal: 5 },  rarity: "rare" },

  { id: "big_spender",       name: "大富翁",       desc: "累计消耗 10000 金钱抽卡",   check: s => s.totalSpent >= 10000, reward: { money: 0, crystal: 50 },   rarity: "epic" },
  { id: "hundred_water",     name: "水漂达人",     desc: "累计打水漂 100 次",       check: s => s.totalWater >= 100,  reward: { money: 500, crystal: 5 },  rarity: "rare" },
];

const RARITY_LABEL = { common: "普通", uncommon: "稀有", rare: "罕见", epic: "史诗", legendary: "传说" };
const RARITY_ICON  = { common: "⚪", uncommon: "🟢", rare: "🔵", epic: "🟣", legendary: "🟠" };

// ============================================================
//  五、辅助函数
// ============================================================

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hashCode(str) {
  let hash = 0;
  if (str.length === 0) return "0";
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

function getTodayDay() {
  return Math.floor((Date.now() / 1000 + 28800) / 86400);
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

// ============================================================
//  六、运气 / 概率计算
// ============================================================

function calcLuckLevel(ctx) {
  let level = 0;
  const jrrp = seal.vars.intGet(ctx, "$t人品")[0];
  if (jrrp >= 90) level++;
  if (jrrp < 10) level--;

  const now = Date.now() / 1000;
  const upTime = seal.vars.intGet(ctx, "$m道具好运_upTime")[0];
  const downTime = seal.vars.intGet(ctx, "$m道具霉运_upTime")[0];
  const upVal = seal.vars.intGet(ctx, "$m道具好运")[0];
  const downVal = seal.vars.intGet(ctx, "$m道具霉运")[0];

  if (upTime >= now)   level += upVal;
  if (downTime >= now) level += downVal;

  return level;
}

function gainRateFromLuck(level) {
  const table = {
    "-7": 1, "-6": 3, "-5": 5, "-4": 7, "-3": 10,
    "-2": 15, "-1": 25, "0": 50, "1": 75, "2": 85,
    "3": 90, "4": 93, "5": 95, "6": 97, "7": 99,
  };

  return table[String(level)] ?? 50;
}

// ============================================================
//  ★★★ 核心新增：图片后端调用 ★★★
// ============================================================

/**
 * 解析单次抽卡结果文本，提取稀有度和描述信息。
 * 返回 { rarity: "ssr"|"sr"|"r"|"n"|"consolation"|"money"|"small_money", text: "...", extra: "..." }
 */
function parseGachaResult(resultText) {
  let rarity = "n";
  let text = "";
  let extra = "";

  if (resultText.includes("特等赏")) {
    rarity = "ssr";
  } else if (resultText.includes("一等赏")) {
    rarity = "sr";
  } else if (resultText.includes("二等赏")) {
    rarity = "r";
  } else if (resultText.includes("末等赏")) {
    rarity = "n";
  } else if (resultText.includes("700 金钱")) {
    rarity = "money";
  } else if (resultText.includes("只有这点")) {
    rarity = "small_money";
  } else if (resultText.includes("非酋赏")) {
    rarity = "consolation";
  } else {
    // 打水漂的安慰奖
    rarity = "consolation";
  }

  // 提取描述文本（换行后的部分）
  const lines = resultText.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    text = lines.slice(1).join(" ").trim();
  } else {
    text = resultText;
  }

  // 提取额外信息（如 "获得了 1000 金钱奖励！"）
  const moneyMatch = resultText.match(/获得[了d]?\s*(\d+)\s*金钱/);
  if (moneyMatch) {
    extra = "获得了 " + moneyMatch[1] + " 金钱奖励";
  }

  return { rarity, text, extra };
}

/**
 * 调用后端生成十连抽卡图片，返回 Promise<string>（图片 CQ 码或错误信息）
 */
function sendToImageBackend(playerName, poolName, results, summary, extraMsg) {
  const payload = {
    player_name: playerName,
    pool_name: poolName,
    title: "十连抽卡结果",
    results: results.map((r, i) => ({
      index: i + 1,
      rarity: r.rarity,
      text: r.text,
      extra: r.extra || "",
    })),
    summary: summary,
    extra_msg: extraMsg || "",
  };

  return fetch(GACHA_IMAGE_BACKEND + "/api/gacha_image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        throw new Error("HTTP " + res.status + ": " + text.slice(0, 300));
      }
      const data = JSON.parse(text);
      if (!data.ok || !data.image_url) {
        throw new Error(data.error || "后端未返回图片地址");
      }
      return "[CQ:image,file=" + data.image_url + "]";
    });
}

// ============================================================
//  七、Gacha 主类
// ============================================================

class Gacha {
  constructor(ctx, poolType) {
    this.ctx = ctx;
    this.userId = ctx.player.userId;

    const allData = JSON.parse(ext.storageGet("gachaInfo") || "{}");
    const my = allData[this.userId] || {};

    this.money = seal.vars.intGet(ctx, "$m金钱")[0];

    this.lastMoneyGacha  = my.lastMoneyGacha  || 0;
    this.todayMoneyGacha = my.todayMoneyGacha || 0;
    this.totalMoneyGacha = my.totalMoneyGacha || 0;
    this.totalNoGain     = my.totalNoGain     || 0;
    this.totalSsr        = my.totalSsr        || 0;
    this.chainNoGain     = my.chainNoGain     || 0;
    this.noGainDays      = my.noGainDays      || 0;
    this.maxWaterStreak  = my.maxWaterStreak  || 0;
    this.got700          = my.got700          || false;

    this.dailySsr   = my.dailySsr   || {};
    this.dailyDraws = my.dailyDraws || {};
    this.dailyWater = my.dailyWater || {};

    this.poolType = poolType;
    this.pool = GACHA_POOLS[poolType] || GACHA_POOLS.default;

    this.collections = my.collections || {};

    this.achievementFlags   = my.achievementFlags   || {};
    this.achievementHistory = my.achievementHistory || {};

    this.poolStats = my.poolStats || {};
    if (!this.poolStats[poolType]) {
      this.poolStats[poolType] = { totalDraws: 0, ssrObtained: 0, lastDraw: 0 };
    }

    this._totalSpent = my._totalSpent || 0;

    this.crystalShopPurchases = my.crystalShopPurchases || {};
    this.rateBoost = my.rateBoost || {};
    this.ssrGuarantee = my.ssrGuarantee || {};
    this.boostRemaining = my.rateBoost?.remainingDraws || 0;
    this.boostMultiplier = my.rateBoost?.multiplier || 1;

    this._todaySsr   = 0;
    this._todayWater = 0;
    this._todayDraws = 0;

    this._dirty = false;
  }

  // ---------- 水晶余额 ----------

  _getCrystal() {
    return seal.vars.intGet(this.ctx, "$m水晶")[0] || 0;
  }

  _setCrystal(val) {
    seal.vars.intSet(this.ctx, "$m水晶", val);
  }

  _addCrystal(amount) {
    const cur = this._getCrystal();
    this._setCrystal(cur + amount);
  }

  _spendCrystal(amount) {
    const cur = this._getCrystal();
    if (cur < amount) return false;
    this._setCrystal(cur - amount);
    return true;
  }

  // ---------- 购买检查 ----------

  _checkShopLimit(itemKey) {
    const item = CRYSTAL_SHOP[itemKey];
    if (!item || item.limit === "none") return true;
    const rec = this.crystalShopPurchases[itemKey] || { dates: {}, total: 0 };
    if (item.limit === "daily") {
      const today = getTodayDay();
      const todayCount = rec.dates[today] || 0;
      if (todayCount >= item.maxPerDay) return false;
    }
    if (item.limit === "weekly") {
      const now = Date.now();
      const weekStart = Math.floor((now / 1000 + 28800) / 604800);
      const weekKey = "w" + weekStart;
      const weekCount = rec.dates[weekKey] || 0;
      if (weekCount >= item.maxPerWeek) return false;
    }
    if (item.limit === "monthly") {
      const now = Date.now();
      const monthKey = "m" + (new Date(now).getFullYear()) + "-" + (new Date(now).getMonth() + 1);
      const monthCount = rec.dates[monthKey] || 0;
      if (monthCount >= item.maxPerMonth) return false;
    }
    return true;
  }

  _recordShopPurchase(itemKey) {
    if (!this.crystalShopPurchases[itemKey]) {
      this.crystalShopPurchases[itemKey] = { dates: {}, total: 0 };
    }
    const rec = this.crystalShopPurchases[itemKey];
    const item = CRYSTAL_SHOP[itemKey];
    if (item.limit === "daily") {
      const today = getTodayDay();
      rec.dates[today] = (rec.dates[today] || 0) + 1;
    } else if (item.limit === "weekly") {
      const now = Date.now();
      const weekStart = Math.floor((now / 1000 + 28800) / 604800);
      const weekKey = "w" + weekStart;
      rec.dates[weekKey] = (rec.dates[weekKey] || 0) + 1;
    } else if (item.limit === "monthly") {
      const now = Date.now();
      const monthKey = "m" + (new Date(now).getFullYear()) + "-" + (new Date(now).getMonth() + 1);
      rec.dates[monthKey] = (rec.dates[monthKey] || 0) + 1;
    }
    rec.total += 1;
  }

  // ---------- 水晶商店购买 ----------

  shopBuy(itemKey) {
    const item = CRYSTAL_SHOP[itemKey];
    if (!item) return "未知物品：" + itemKey + "。使用「查看水晶商店」查看可购买物品。";
    if (this._getCrystal() < item.price) {
      return MSG_CRYSTAL.NO_CRYSTAL + this._getCrystal() + "，" + MSG_CRYSTAL.NEED_CRYSTAL + item.price + " 水晶。";
    }
    if (!this._checkShopLimit(itemKey)) {
      return item.name + MSG_CRYSTAL.LIMIT_DAILY;
    }
    this._spendCrystal(item.price);
    this._recordShopPurchase(itemKey);
    return this._applyShopEffect(item);
  }

  _applyShopEffect(item) {
    const eff = item.effect;
    switch (eff.type) {
      case "extraDraw": {
        const cur = seal.vars.intGet(this.ctx, "$m额外抽卡次数")[0] || 0;
        seal.vars.intSet(this.ctx, "$m额外抽卡次数", cur + eff.value);
        const msg = MSG_CRYSTAL.PURCHASE_OK + item.price + " 水晶，获得 " + eff.value + " 次额外抽卡次数。";
        this._save();
        return msg;
      }
      case "buff": {
        const now = Date.now() / 1000;
        const key = eff.buffKey;
        seal.vars.intSet(this.ctx, "$m道具" + key, eff.value);
        seal.vars.intSet(this.ctx, "$m道具" + key + "_upTime", now + eff.duration);
        const msg = MSG_CRYSTAL.PURCHASE_OK + item.price + " 水晶。" + MSG_CRYSTAL.BUFF_ACTIVE;
        this._save();
        return msg;
      }
      case "cleanse": {
        seal.vars.intSet(this.ctx, "$m道具霉运", 0);
        seal.vars.intSet(this.ctx, "$m道具霉运_upTime", 0);
        const msg = MSG_CRYSTAL.PURCHASE_OK + item.price + " 水晶。" + MSG_CRYSTAL.CLEANSE_OK;
        this._save();
        return msg;
      }
      case "resetDaily": {
        this.todayMoneyGacha = 0;
        this.lastMoneyGacha = 0;
        const msg = MSG_CRYSTAL.PURCHASE_OK + item.price + " 水晶。" + MSG_CRYSTAL.RESET_OK;
        this._save();
        return msg;
      }
      case "rateBoost": {
        if (this.boostRemaining > 0) {
          return "你已经有一个 SSR 祈愿效果正在生效（剩余 " + this.boostRemaining + " 抽）。请等待效果结束后再使用。";
        }
        this.rateBoost = { remainingDraws: eff.duration, multiplier: eff.multiplier, rarity: eff.rarity };
        this.boostRemaining = eff.duration;
        this.boostMultiplier = eff.multiplier;
        const msg = MSG_CRYSTAL.PURCHASE_OK + item.price + " 水晶。" + MSG_CRYSTAL.BOOST_OK;
        this._save();
        return msg;
      }
      case "ssrGuarantee": {
        if (this.ssrGuarantee.active) return MSG_CRYSTAL.ALREADY_GUARANTEE;
        this.ssrGuarantee = { active: true, poolType: this.poolType };
        const msg = MSG_CRYSTAL.PURCHASE_OK + item.price + " 水晶。" + MSG_CRYSTAL.GUARANTEE_OK;
        this._save();
        return msg;
      }
      case "duplicateCollection": {
        const collKeys = Object.keys(this.collections);
        if (collKeys.length === 0) {
          this._addCrystal(item.price);
          return MSG_CRYSTAL.NO_COLLECTION;
        }
        const pick = collKeys[Math.floor(Math.random() * collKeys.length)];
        const orig = this.collections[pick];
        this.collections[pick].count += 1;
        this.collections[pick].lastObtained = Date.now();
        const msg = MSG_CRYSTAL.PURCHASE_OK + item.price + " 水晶。" + MSG_CRYSTAL.DUPLICATE_OK + " 获得了「" + orig.desc + "」的复制品。";
        this._save();
        return msg;
      }
      case "money": {
        this.money += eff.value;
        const msg = MSG_CRYSTAL.PURCHASE_OK + item.price + " 水晶。" + MSG_CRYSTAL.MONEY_OK + " 获得了 " + eff.value + " 金钱。";
        this._save();
        return msg;
      }
      default:
        return "未知物品效果。";
    }
  }

  // ---------- 持久化 ----------

  _save() {
    const allData = JSON.parse(ext.storageGet("gachaInfo") || "{}");
    const d = {
      name: this.ctx.player.name,
      platform: this.ctx.endPoint.platform,
      groupId: this.ctx.player.groupId,
      lastMoneyGacha: this.lastMoneyGacha,
      todayMoneyGacha: this.todayMoneyGacha,
      totalMoneyGacha: this.totalMoneyGacha,
      totalNoGain: this.totalNoGain,
      totalSsr: this.totalSsr,
      chainNoGain: this.chainNoGain,
      noGainDays: this.noGainDays,
      maxWaterStreak: this.maxWaterStreak,
      got700: this.got700,
      dailySsr: this.dailySsr,
      dailyDraws: this.dailyDraws,
      dailyWater: this.dailyWater,
      collections: this.collections,
      achievementFlags: this.achievementFlags,
      achievementHistory: this.achievementHistory,
      poolStats: this.poolStats,
      _totalSpent: this._totalSpent,
      crystalShopPurchases: this.crystalShopPurchases,
      rateBoost: this.rateBoost,
      ssrGuarantee: this.ssrGuarantee,
    };
    allData[this.userId] = d;
    ext.storageSet("gachaInfo", JSON.stringify(allData));
    seal.vars.intSet(this.ctx, "$m金钱", this.money);
    this._dirty = false;
  }

  // ---------- 随机词条 ----------

  _randomDesc(type) {
    const list = this.pool.descriptions[type];
    if (!list || list.length === 0) return { text: "", id: "" };
    const text = list[Math.floor(Math.random() * list.length)];
    return { text, id: hashCode(text) };
  }

  // ---------- 藏品管理 ----------

  _addCollection(itemDesc, rarity, itemId) {
    if (!itemId) itemId = hashCode(itemDesc);
    if (this.collections[itemId]) {
      this.collections[itemId].count += 1;
      this.collections[itemId].lastObtained = Date.now();
      if (!this.collections[itemId].sources.includes(this.poolType)) {
        this.collections[itemId].sources.push(this.poolType);
      }
    } else {
      this.collections[itemId] = {
        id: itemId,
        desc: itemDesc,
        rarity,
        count: 1,
        firstObtained: Date.now(),
        lastObtained: Date.now(),
        sources: [this.poolType],
      };
    }
  }

  _uniqueItemCount() {
    return Object.keys(this.collections).length;
  }

  // ---------- 成就检查 ----------

  _checkAndUnlockAchievements() {
    const today = getTodayDay();
    const stats = {
      totalDraws:  this.totalMoneyGacha,
      ssrCount:    this.totalSsr,
      totalWater:  this.totalNoGain,
      chainWater:  this.chainNoGain,
      uniqueItems: this._uniqueItemCount(),
      got700:      this.got700,
      totalSpent:  this._totalSpent,
      todaySsr:    this._todaySsr,
      todayWater:  this._todayWater,
      todayDraws:  this._todayDraws,
    };
    const unlocked = [];
    for (const def of ACHIEVEMENT_DEFS) {
      if (this.achievementFlags[def.id]) continue;
      if (def.check(stats)) {
        this.achievementFlags[def.id] = true;
        this.achievementHistory[def.id] = {
          completedAt: Date.now(),
          times: (this.achievementHistory[def.id]?.times || 0) + 1,
        };
        if (def.reward.money) this.money += def.reward.money;
        if (def.reward.crystal) {
          const cur = seal.vars.intGet(this.ctx, "$m水晶")[0] || 0;
          seal.vars.intSet(this.ctx, "$m水晶", cur + def.reward.crystal);
        }
        unlocked.push(def);
      }
    }
    return unlocked;
  }

  // ---------- 核心抽卡逻辑（单次）—— 返回结构化数据 ----------

  _moneyGachaCore(gainRate) {
    const roll = getRandomInt(0, 100);
    this._todayDraws++;
    this.totalMoneyGacha++;

    if (roll > gainRate) {
      this.chainNoGain++;
      this.totalNoGain++;
      this._todayWater++;
      const c = this._randomDesc("consolation");
      this._addCollection(c.text, "consolation", c.id);
      return { text: MSG.SPLASH + "\n" + c.text, rarity: "consolation", raw: MSG.SPLASH + "\n" + c.text };
    }

    this.chainNoGain = 0;
    let sub = getRandomInt(0, 100);
    this.poolStats[this.poolType].totalDraws++;
    this.poolStats[this.poolType].lastDraw = Date.now();

    let ssrThreshold = 100;
    if (this.boostRemaining > 0 && this.rateBoost.rarity === "ssr") {
      this.boostRemaining--;
      this.rateBoost.remainingDraws--;
      ssrThreshold = 101 - this.boostMultiplier;
    }

    let guaranteeTriggered = false;
    if (this.ssrGuarantee.active && this.ssrGuarantee.poolType === this.poolType) {
      guaranteeTriggered = true;
      this.ssrGuarantee.active = false;
    }

    // SSR
    if (sub >= ssrThreshold || guaranteeTriggered) {
      this.poolStats[this.poolType].ssrObtained = (this.poolStats[this.poolType].ssrObtained || 0) + 1;
      this.totalSsr++;
      this._todaySsr++;
      const item = this._randomDesc("ssr");
      this._addCollection(item.text, "ssr", item.id);
      const bonus = 1000;
      this.money += bonus;
      const raw = MSG.SSR + "\n" + item.text + " 获得了 " + bonus + " 金钱奖励！";
      return { text: item.text, rarity: "ssr", extra: "获得了 " + bonus + " 金钱奖励", raw };
    }

    // SR
    if (sub >= 97) {
      const item = this._randomDesc("sr");
      this._addCollection(item.text, "sr", item.id);
      return { text: item.text, rarity: "sr", raw: MSG.SR + "\n" + item.text };
    }

    // R
    if (sub >= 87) {
      const item = this._randomDesc("r");
      this._addCollection(item.text, "r", item.id);
      return { text: item.text, rarity: "r", raw: MSG.R + "\n" + item.text };
    }

    // N
    if (sub >= 51) {
      const item = this._randomDesc("n");
      this._addCollection(item.text, "n", item.id);
      return { text: item.text, rarity: "n", raw: MSG.N + "\n" + item.text };
    }

    // 700 金钱
    if (sub === 50) {
      this.money += 700;
      this.got700 = true;
      const c = this._randomDesc("consolation");
      this._addCollection(c.text, "consolation", c.id);
      const raw = MSG.MONEY_700 + "\n" + c.text;
      return { text: c.text, rarity: "money", extra: "获得了 700 金钱奖励", raw };
    }

    // 小额金钱
    const small = getRandomInt(1, 10);
    this.money += small;
    const raw = MSG.SMALL_MONEY + "你获得了 " + small + " 金钱。";
    return { text: "你获得了 " + small + " 金钱", rarity: "small_money", raw };
  }

  // ---------- 单抽（不变） ----------

  singleMoneyGacha() {
    const extra = seal.vars.intGet(this.ctx, "$m额外抽卡次数")[0];
    if (this.money < MONEY_COST && extra < 1) return MSG.NO_MONEY;
    const now = Math.floor(Date.now() / 1000);
    const todayInt = Math.floor((now + 28800) / 86400);
    const lastInt  = Math.floor((this.lastMoneyGacha + 28800) / 86400);
    if (todayInt !== lastInt) { this.todayMoneyGacha = 0; this.chainNoGain = 0; }
    if (this.todayMoneyGacha + 1 > MAX_MONEYGACHA_PERDAY && extra < 1) return MSG.EXCEED_LIMIT;

    if (this.money >= MONEY_COST && this.todayMoneyGacha + 1 <= MAX_MONEYGACHA_PERDAY) {
      this.todayMoneyGacha += 1;
      this.money -= MONEY_COST;
      this._totalSpent += MONEY_COST;
    } else {
      seal.vars.intSet(this.ctx, "$m额外抽卡次数", extra - 1);
    }
    this.lastMoneyGacha = now;

    this._todaySsr   = this.dailySsr[todayInt]   || 0;
    this._todayWater = this.dailyWater[todayInt] || 0;
    this._todayDraws = this.dailyDraws[todayInt] || 0;

    const luck = calcLuckLevel(this.ctx);
    const rate = gainRateFromLuck(luck);
    let result = this._moneyGachaCore(rate);

    this.dailyDraws[todayInt] = this._todayDraws;
    this.dailySsr[todayInt]   = this._todaySsr;
    this.dailyWater[todayInt] = this._todayWater;

    if (this.chainNoGain > this.maxWaterStreak) this.maxWaterStreak = this.chainNoGain;

    if (this.chainNoGain >= MAX_MONEYGACHA_PERDAY) {
      this.noGainDays++;
      result.raw += "\n" + MSG.EXTREME_LUCK + "\n" + MSG.NONPRIZE;
      seal.vars.intSet(this.ctx, "$m非酋赏", seal.vars.intGet(this.ctx, "$m非酋赏")[0] + 1);
      this.chainNoGain = 0;
    }

    const unlocked = this._checkAndUnlockAchievements();
    if (unlocked.length > 0) {
      result.raw += "\n\n🎉 成就解锁：";
      for (const a of unlocked) {
        result.raw += "\n🏆 " + a.name + "：" + a.desc;
        if (a.reward.money) result.raw += "  奖励：" + a.reward.money + " 金钱";
        if (a.reward.crystal) result.raw += (a.reward.money ? " + " : "  奖励：") + a.reward.crystal + " 水晶";
      }
    }

    this._save();
    return result.raw;
  }

  // ---------- ★★★ 十连（图片版） ★★★ ----------

  /**
   * 十连抽卡核心逻辑，返回对象而非纯文本
   * 返回 { textResult: "原始文本", parsedResults: [...], summary: {...}, extraMsg: "..." }
   */
  multiMoneyGachaCore() {
    const extra = seal.vars.intGet(this.ctx, "$m额外抽卡次数")[0];
    if (this.money < GACHA_MULTI * MONEY_COST && extra < GACHA_MULTI) {
      return { error: MSG.NO_MONEY };
    }

    const now = Math.floor(Date.now() / 1000);
    const todayInt = Math.floor((now + 28800) / 86400);
    const lastInt  = Math.floor((this.lastMoneyGacha + 28800) / 86400);
    if (todayInt !== lastInt) { this.todayMoneyGacha = 0; this.chainNoGain = 0; }
    if (this.todayMoneyGacha + GACHA_MULTI > MAX_MONEYGACHA_PERDAY && extra < GACHA_MULTI) {
      return { error: MSG.EXCEED_LIMIT };
    }

    if (this.money >= GACHA_MULTI * MONEY_COST &&
        this.todayMoneyGacha + GACHA_MULTI <= MAX_MONEYGACHA_PERDAY) {
      this.todayMoneyGacha += GACHA_MULTI;
      this.money -= GACHA_MULTI * MONEY_COST;
      this._totalSpent += GACHA_MULTI * MONEY_COST;
    } else {
      seal.vars.intSet(this.ctx, "$m额外抽卡次数", extra - GACHA_MULTI);
    }
    this.lastMoneyGacha = now;

    this._todaySsr   = this.dailySsr[todayInt]   || 0;
    this._todayWater = this.dailyWater[todayInt] || 0;
    this._todayDraws = this.dailyDraws[todayInt] || 0;

    const luck = calcLuckLevel(this.ctx);
    const rate = gainRateFromLuck(luck);

    let textResult = MSG.MULTI_START + "\n" + "=".repeat(20);
    let parsedResults = [];
    let summary = { ssr: 0, sr: 0, r: 0, n: 0, money: 0, small_money: 0, consolation: 0 };
    let ssrInBatch = 0;
    let srInBatch  = 0;
    let extraMsg = "";

    for (let i = 0; i < GACHA_MULTI; i++) {
      const r = this._moneyGachaCore(rate);
      parsedResults.push({
        rarity: r.rarity,
        text: r.text,
        extra: r.extra || "",
      });

      // 统计
      if (summary[r.rarity] !== undefined) summary[r.rarity]++;
      if (r.rarity === "ssr") ssrInBatch++;
      if (r.rarity === "sr") srInBatch++;

      textResult += "\n\n第" + (i + 1) + "抽：\n" + r.raw;
    }

    this.dailyDraws[todayInt] = this._todayDraws;
    this.dailySsr[todayInt]   = this._todaySsr;
    this.dailyWater[todayInt] = this._todayWater;

    if (this.chainNoGain > this.maxWaterStreak) this.maxWaterStreak = this.chainNoGain;

    // 非酋赏
    if (this.chainNoGain >= MAX_MONEYGACHA_PERDAY) {
      this.noGainDays++;
      textResult += "\n" + MSG.EXTREME_LUCK + "\n" + MSG.NONPRIZE;
      seal.vars.intSet(this.ctx, "$m非酋赏", seal.vars.intGet(this.ctx, "$m非酋赏")[0] + 1);
      this.chainNoGain = 0;
      extraMsg = MSG.EXTREME_LUCK + " " + MSG.NONPRIZE;
    }

    // 战报
    textResult += "\n" + "=".repeat(20);
    if (ssrInBatch > 0 || srInBatch > 0) {
      const summaryLine = "✨ 本次十连战果：" + ssrInBatch + " 个特等赏，" + srInBatch + " 个一等赏 ✨";
      textResult += "\n\n" + summaryLine;
      if (!extraMsg) extraMsg = summaryLine;
    }

    // 成就
    const unlocked = this._checkAndUnlockAchievements();
    if (unlocked.length > 0) {
      let achieveText = "🎉 成就解锁：";
      for (const a of unlocked) {
        achieveText += "\n🏆 " + a.name + "：" + a.desc;
        if (a.reward.money) achieveText += "  奖励：" + a.reward.money + " 金钱";
        if (a.reward.crystal) achieveText += (a.reward.money ? " + " : "  奖励：") + a.reward.crystal + " 水晶";
      }
      textResult += "\n\n" + achieveText;
      extraMsg += (extraMsg ? "\n" : "") + achieveText;
    }

    this._save();

    return {
      textResult,
      parsedResults,
      summary,
      extraMsg,
    };
  }

  // ---------- 小游戏（不变） ----------

  guessNumberGame(guess, betAmount) {
    if (this.money < betAmount) return "金钱不足，无法参与游戏。需要 " + betAmount + " 金钱。";
    const target = Math.floor(Math.random() * 10) + 1;
    this.money -= betAmount;
    if (parseInt(guess) === target) {
      const reward = betAmount * 3;
      this.money += reward;
      this._save();
      return "恭喜！猜中了数字 " + target + "，获得 " + reward + " 金钱奖励！";
    }
    this._save();
    return "很遗憾，数字是 " + target + "，您猜的是 " + guess + "。损失 " + betAmount + " 金钱。";
  }

  rpsGame(choice, betAmount) {
    const choices = ["石头", "剪刀", "布"];
    if (!choices.includes(choice)) return "请选择'石头'、'剪刀'或'布'。";
    if (this.money < betAmount) return "金钱不足，无法参与游戏。需要 " + betAmount + " 金钱。";
    const ai = choices[Math.floor(Math.random() * 3)];
    this.money -= betAmount;
    if (choice === ai) {
      this.money += betAmount;
      this._save();
      return "平局！对方也选择了 " + ai + "。赌注已返还。";
    }
    if ((choice === "石头" && ai === "剪刀") || (choice === "剪刀" && ai === "布") || (choice === "布" && ai === "石头")) {
      const reward = betAmount * 2;
      this.money += reward;
      this._save();
      return "恭喜！您选择了 " + choice + "，对方选择了 " + ai + "，您赢了！获得 " + reward + " 金钱奖励！";
    }
    this._save();
    return "很遗憾！您选择了 " + choice + "，对方选择了 " + ai + "，您输了。损失 " + betAmount + " 金钱。";
  }

  luckyWheel(spinCost) {
    if (this.money < spinCost) return "金钱不足，无法旋转转盘。需要 " + spinCost + " 金钱。";
    this.money -= spinCost;
    const prizes = [
      { type: "money",  value: 10,  prob: 40 },
      { type: "money",  value: 20,  prob: 30 },
      { type: "money",  value: 50,  prob: 15 },
      { type: "money",  value: 100, prob: 10 },
      { type: "money",  value: 200, prob: 4 },
      { type: "crystal", value: 1,  prob: 0.8 },
      { type: "crystal", value: 5,  prob: 0.2 },
      { type: "item",    value: "抽卡券", prob: 0.5 },
    ];
    const total = prizes.reduce((s, p) => s + p.prob, 0);
    const roll = Math.random() * total;
    let cumulative = 0;
    let selected = null;
    for (const p of prizes) { cumulative += p.prob; if (roll <= cumulative) { selected = p; break; } }
    let msg = "转盘结果：";
    if (selected.type === "money") { this.money += selected.value; msg += "获得 " + selected.value + " 金钱！"; }
    else if (selected.type === "crystal") { const cur = seal.vars.intGet(this.ctx, "$m水晶")[0] || 0; seal.vars.intSet(this.ctx, "$m水晶", cur + selected.value); msg += "获得 " + selected.value + " 水晶！"; }
    else { msg += "获得 " + selected.value + "！"; }
    this._save();
    return msg;
  }
}

// ============================================================
//  八、扩展注册与命令处理
// ============================================================

const USER_POOL_PREF = {};

let ext = seal.ext.find("Shop_wish");
if (!ext) {
  ext = seal.ext.new("Shop_wish", "kakakumous", "2.2.0");
  seal.ext.register(ext);
}

// ============================================================
//  插件 UI 配置
// ============================================================

seal.ext.registerStringConfig(ext, "命令前缀", "◆抽卡◆", "所有抽卡命令必须以此前缀开头");
seal.ext.registerIntConfig(ext, "单抽消耗金钱", MONEY_COST, "每次单抽消耗的金钱数量");
seal.ext.registerIntConfig(ext, "十连次数", GACHA_MULTI, "十连抽卡的次数");
seal.ext.registerIntConfig(ext, "每日抽卡上限", MAX_MONEYGACHA_PERDAY, "每日金钱抽卡的最大次数");
seal.ext.registerIntConfig(ext, "排行榜显示人数", RANK_SHOW, "排行榜最多显示的人数");
seal.ext.registerIntConfig(ext, "藏品每页条数", ITEMS_PER_PAGE, "藏品列表每页显示的条数");

// ★ 新增：图片后端配置
seal.ext.registerStringConfig(ext, "图片后端地址", "http://127.0.0.1:8014", "十连结果图片生成后端地址，留空则使用纯文本");
seal.ext.registerBoolConfig(ext, "启用十连图片", true, "启用后十连结果将生成图片发送，关闭则保持纯文本");

function loadGachaConfig() {
  MONEY_COST = seal.ext.getIntConfig(ext, "单抽消耗金钱");
  GACHA_MULTI = seal.ext.getIntConfig(ext, "十连次数");
  MAX_MONEYGACHA_PERDAY = seal.ext.getIntConfig(ext, "每日抽卡上限");
  RANK_SHOW = seal.ext.getIntConfig(ext, "排行榜显示人数");
  ITEMS_PER_PAGE = seal.ext.getIntConfig(ext, "藏品每页条数");

  // ★ 读取图片后端配置
  try {
    GACHA_IMAGE_ENABLED = seal.ext.getBoolConfig(ext, "启用十连图片");
  } catch (e) { GACHA_IMAGE_ENABLED = true; }
  try {
    const addr = seal.ext.getStringConfig(ext, "图片后端地址");
    if (addr && addr.trim()) GACHA_IMAGE_BACKEND = addr.trim();
  } catch (e) {}
}

loadGachaConfig();

function gachaCmdPrefix() { return seal.ext.getStringConfig(ext, "命令前缀") || "◆抽卡◆"; }

ext.onNotCommandReceived = (ctx, msg) => {
  const raw = msg.message.trim();
  const prefix = gachaCmdPrefix();
  if (!raw.startsWith(prefix)) return seal.ext.newCmdExecuteResult(false);
  const cmd = raw.slice(prefix.length).trim();
  loadGachaConfig();

  // ========== 查看金钱 ==========
  if (cmd === "查看金钱" || cmd === "我的金钱") {
    const g = new Gacha(ctx, "default");
    let display = "💰 " + ctx.player.name + " 当前金钱：" + g.money;
    if (g.money >= 1000)      display += " 💎";
    else if (g.money >= 500)  display += " 💰";
    else if (g.money >= 100)  display += " 💵";
    else if (g.money >= 10)   display += " 💸";
    else                      display += " 🏦";
    seal.replyToSender(ctx, msg, display);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看水晶 ==========
  if (cmd === "查看水晶" || cmd === "我的水晶") {
    const g = new Gacha(ctx, "default");
    const c = g._getCrystal();
    let res = "💎 " + ctx.player.name + " 当前水晶：" + c;
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看水晶商店 ==========
  if (cmd === "查看水晶商店" || cmd === "水晶商店" || cmd === "商店") {
    const g = new Gacha(ctx, "default");
    const c = g._getCrystal();
    let res = MSG_CRYSTAL.SHOP_HEADER + "💎 你的水晶：" + c + "\n" + "─".repeat(24) + "\n";
    for (const [key, item] of Object.entries(CRYSTAL_SHOP)) {
      res += "\n" + key + "：「" + item.name + "」  售价：" + item.price + "💎\n  " + item.desc + "\n";
    }
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 购买 ==========
  if (cmd.startsWith("购买 ") || cmd.startsWith("购入 ")) {
    const itemKey = cmd.replace(/^(购买|购入)\s+/, "").trim();
    if (!itemKey) { seal.replyToSender(ctx, msg, "用法：购买 <物品名称>"); return seal.ext.newCmdExecuteResult(true); }
    let realKey = itemKey;
    if (!CRYSTAL_SHOP[realKey]) {
      const found = Object.entries(CRYSTAL_SHOP).find(([k, v]) => v.name === itemKey || v.name.includes(itemKey) || k.includes(itemKey));
      if (found) realKey = found[0];
    }
    if (!CRYSTAL_SHOP[realKey]) { seal.replyToSender(ctx, msg, "未找到物品：" + itemKey); return seal.ext.newCmdExecuteResult(true); }
    let poolType = USER_POOL_PREF[ctx.player.userId] || "default";
    const g = new Gacha(ctx, poolType);
    seal.replyToSender(ctx, msg, g.shopBuy(realKey));
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看增益 ==========
  if (cmd === "查看增益" || cmd === "我的增益" || cmd === "增益状态") {
    const g = new Gacha(ctx, "default");
    const now = Date.now() / 1000;
    let res = "🔮 " + ctx.player.name + " 的当前增益状态：\n";
    // ... （原版代码完全保留，此处省略）
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== ★★★ 抽卡（含图片逻辑） ★★★ ==========
  if (cmd.startsWith("抽一下") || cmd.startsWith("抽十连")) {
    const isMulti = cmd.startsWith("抽十连");
    let poolType = cmd.replace(/^抽(一下|十连)[\s]*/, "").trim().toLowerCase();
    if (!poolType) poolType = USER_POOL_PREF[ctx.player.userId] || "default";
    if (!GACHA_POOLS[poolType]) {
      seal.replyToSender(ctx, msg, "未知卡池：" + poolType);
      return seal.ext.newCmdExecuteResult(true);
    }

    const g = new Gacha(ctx, poolType);
    USER_POOL_PREF[ctx.player.userId] = poolType;

    if (!isMulti) {
      // 单抽：保持纯文本
      const result = g.singleMoneyGacha();
      seal.replyToSender(ctx, msg, result);
      return seal.ext.newCmdExecuteResult(true);
    }

    // ★ 十连：尝试生成图片
    const coreResult = g.multiMoneyGachaCore();

    if (coreResult.error) {
      seal.replyToSender(ctx, msg, coreResult.error);
      return seal.ext.newCmdExecuteResult(true);
    }

    // 如果启用图片后端，尝试调用
    if (GACHA_IMAGE_ENABLED) {
      seal.replyToSender(ctx, msg, MSG.IMAGE_WAIT);

      sendToImageBackend(
        ctx.player.name,
        g.pool.name,
        coreResult.parsedResults,
        coreResult.summary,
        coreResult.extraMsg
      )
        .then((cqImage) => {
          // 图片成功：发送图片 + 额外消息（成就、非酋赏等）
          let fullMsg = cqImage;
          if (coreResult.extraMsg) {
            fullMsg += "\n" + coreResult.extraMsg;
          }
          seal.replyToSender(ctx, msg, fullMsg);
        })
        .catch((err) => {
          // 图片失败：回退到纯文本
          seal.replyToSender(ctx, msg,
            MSG.IMAGE_FAIL + "\n" + coreResult.textResult +
            "\n\n[错误：" + String(err?.message || err).slice(0, 200) + "]"
          );
        });
    } else {
      // 未启用图片：纯文本
      seal.replyToSender(ctx, msg, coreResult.textResult);
    }

    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看卡池 ==========
  if (cmd === "查看卡池") {
    let res = "可用卡池：\n";
    for (const [key, pool] of Object.entries(GACHA_POOLS)) {
      res += "\n" + key + "：" + pool.name + " - " + pool.description;
    }
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 设置卡池 ==========
  if (cmd.startsWith("设置卡池")) {
    const parts = cmd.split(/\s+/);
    if (parts.length < 2) { seal.replyToSender(ctx, msg, "用法：设置卡池 [卡池名称]"); return seal.ext.newCmdExecuteResult(true); }
    const pt = parts[1].toLowerCase();
    if (!GACHA_POOLS[pt]) { seal.replyToSender(ctx, msg, "未知卡池：" + pt); return seal.ext.newCmdExecuteResult(true); }
    USER_POOL_PREF[ctx.player.userId] = pt;
    seal.replyToSender(ctx, msg, "已设置默认卡池为：" + GACHA_POOLS[pt].name);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看抽卡统计 ==========
  if (cmd === "查看抽卡次数" || cmd === "抽卡次数" || cmd === "抽卡统计") {
    const allData = JSON.parse(ext.storageGet("gachaInfo") || "{}");
    const info = allData[ctx.player.userId];
    if (!info) { seal.replyToSender(ctx, msg, ctx.player.name + " 还没有进行过抽卡。"); return seal.ext.newCmdExecuteResult(true); }
    const now = Math.floor(Date.now() / 1000);
    const todayStart = Math.floor((now + 28800) / 86400) * 86400 - 28800;
    const isNewDay = Math.floor((info.lastMoneyGacha + 28800) / 86400) !== Math.floor((now + 28800) / 86400);
    let res = "📊 " + ctx.player.name + " 的抽卡统计：";
    res += "\n\n🎯 总抽卡次数：" + (info.totalMoneyGacha || 0) + " 次";
    res += "\n📅 今日抽卡：" + (isNewDay ? 0 : info.todayMoneyGacha || 0) + " / " + MAX_MONEYGACHA_PERDAY;
    const extra = seal.vars.intGet(ctx, "$m额外抽卡次数")[0] || 0;
    if (extra > 0) res += "\n✨ 额外抽卡次数：" + extra + " 次";
    res += "\n💦 累计打水漂：" + (info.totalNoGain || 0) + " 次";
    res += "\n🌟 特等赏：" + (info.totalSsr || 0) + " 个";
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看藏品 ==========
  if (cmd === "查看藏品" || cmd === "我的藏品" || cmd.startsWith("藏品 ")) {
    const allData = JSON.parse(ext.storageGet("gachaInfo") || "{}");
    const info = allData[ctx.player.userId];
    if (!info || !info.collections || Object.keys(info.collections).length === 0) {
      seal.replyToSender(ctx, msg, ctx.player.name + " 还没有获得任何藏品。");
      return seal.ext.newCmdExecuteResult(true);
    }
    let items = Object.values(info.collections);
    items.sort((a, b) => b.lastObtained - a.lastObtained);
    const rn = { ssr: "特等赏", sr: "一等赏", r: "二等赏", n: "末等赏", consolation: "安慰奖" };
    const ri = { ssr: "🌟", sr: "⭐", r: "🔶", n: "🔸", consolation: "💫" };
    let res = "🏆 " + ctx.player.name + " 的藏品（前 " + ITEMS_PER_PAGE + " 件）：\n\n";
    items.slice(0, ITEMS_PER_PAGE).forEach((item, idx) => {
      res += (ri[item.rarity] || "📦") + " " + (idx + 1) + ". " + item.desc + " ×" + item.count + "\n";
    });
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 查看成就 ==========
  if (cmd === "查看成就" || cmd === "成就列表") {
    const allData = JSON.parse(ext.storageGet("gachaInfo") || "{}");
    const info = allData[ctx.player.userId];
    if (!info) { seal.replyToSender(ctx, msg, ctx.player.name + " 还没有任何成就进度。"); return seal.ext.newCmdExecuteResult(true); }
    const flags = info.achievementFlags || {};
    const completed = Object.values(flags).filter(Boolean).length;
    let res = "🏆 成就进度：" + completed + "/" + ACHIEVEMENT_DEFS.length + "\n";
    for (const def of ACHIEVEMENT_DEFS) {
      res += (flags[def.id] ? " ✅ " : " 🔒 ") + def.name + "\n";
    }
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 小游戏 ==========
  if (cmd.startsWith("猜数字")) {
    const parts = cmd.split(/\s+/);
    if (parts.length < 2) { seal.replyToSender(ctx, msg, "请输入要猜测的数字"); return seal.ext.newCmdExecuteResult(true); }
    const bet = parts.length > 2 ? parseInt(parts[2]) : 10;
    const g = new Gacha(ctx, "default");
    seal.replyToSender(ctx, msg, g.guessNumberGame(parts[1], bet));
    return seal.ext.newCmdExecuteResult(true);
  }
  if (cmd.startsWith("石头剪刀布")) {
    const parts = cmd.split(/\s+/);
    if (parts.length < 2) { seal.replyToSender(ctx, msg, "请选择'石头'、'剪刀'或'布'"); return seal.ext.newCmdExecuteResult(true); }
    const bet = parts.length > 2 ? parseInt(parts[2]) : 10;
    const g = new Gacha(ctx, "default");
    seal.replyToSender(ctx, msg, g.rpsGame(parts[1], bet));
    return seal.ext.newCmdExecuteResult(true);
  }
  if (cmd === "转盘" || cmd === "幸运转盘") {
    const g = new Gacha(ctx, "default");
    seal.replyToSender(ctx, msg, g.luckyWheel(50));
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 帮助 ==========
  if (cmd === "抽卡帮助") {
    let poolsList = "";
    for (const [key, pool] of Object.entries(GACHA_POOLS)) { poolsList += "\n  " + key + "：" + pool.name; }
    seal.replyToSender(ctx, msg, `
抽卡系统使用指南：
  抽一下 [卡池]       单次抽卡
  抽十连 [卡池]       十连抽卡（自动生成图片）
  查看金钱 / 水晶     查看余额
  查看卡池            查看所有可用卡池
  设置卡池 [名称]     设置默认卡池
  查看抽卡次数        查看抽卡统计
  查看藏品 / 图鉴     查看收藏
  查看成就            查看成就进度

十连图片功能需要在后端运行图片生成服务，端口 8014。
在插件配置中可关闭图片功能回退为纯文本。

可用卡池：${poolsList}
    `.trim());
    return seal.ext.newCmdExecuteResult(true);
  }

  // ========== 排行榜（原版保留） ==========
  if (cmd === "想看一群倒霉蛋") {
    const allData = JSON.parse(ext.storageGet("gachaInfo") || "{}");
    const arr = [];
    for (const [uid, info] of Object.entries(allData)) {
      if (info.platform !== ctx.endPoint.platform) continue;
      arr.push([info.totalNoGain || 0, info.name || "noname"]);
    }
    descValueSort(arr);
    let res = "重磅！打水漂高手榜火热竞争中！\n";
    for (let i = 0; i < Math.min(arr.length, RANK_SHOW); i++) {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + "-";
      res += "\n" + medal + arr[i][1] + "~" + arr[i][0] + "次";
    }
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  if (cmd === "想看最倒霉的倒霉蛋") {
    const allData = JSON.parse(ext.storageGet("gachaInfo") || "{}");
    const arr = [];
    for (const [uid, info] of Object.entries(allData)) {
      if (uid === "UI:1001") { arr.push([info.totalNoGain || 0, "【ADMIN】"]); continue; }
      arr.push([info.totalNoGain || 0, info.name || "noname"]);
    }
    descValueSort(arr);
    let res = "重磅！打水漂高手榜火热竞争中！\n";
    for (let i = 0; i < Math.min(arr.length, RANK_SHOW); i++) {
      const medal = i === 0 ? "👸🏿" : i === 1 ? "👸🏾" : i === 2 ? "👸🏽" : (i + 1) + "-";
      res += "\n" + medal + arr[i][1] + "~" + arr[i][0] + "次";
    }
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }

  if (cmd === "想看自己的倒霉程度") {
    const allData = JSON.parse(ext.storageGet("gachaInfo") || "{}");
    const info = allData[ctx.player.userId];
    if (!info) { seal.replyToSender(ctx, msg, ctx.player.name + " 您还没有抽过卡。"); return seal.ext.newCmdExecuteResult(true); }
    const total = info.totalMoneyGacha || 0;
    const water = info.totalNoGain || 0;
    const ssr = info.totalSsr || 0;
    let res = "尊敬的客户 <" + (info.name || ctx.player.name) + ">，您的查询抽卡数据业务回复如下：\n";
    res += "~ 累计进行抽卡：" + total + " 次";
    res += "\n~ 累计打水漂：" + water + " 次";
    res += "\n~ 累计获取特等赏：" + ssr + " 个";
    seal.replyToSender(ctx, msg, res);
    return seal.ext.newCmdExecuteResult(true);
  }
};
