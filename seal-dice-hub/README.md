# Seal Dice Hub

基于 [海豹骰 (SealDice)](https://github.com/sealdice/sealdice-core) 的插件与资源合集。

## 目录结构

```
seal-dice-hub/
├── plugins/                ← JS 插件
│   ├── 秘境远征/           ← 多人合作 Roguelike 地牢冒险
│   │   ├── backend/        ← Python Flask 图片后端
│   │   └── docs/           ← 源代码文档、数据表、平衡分析
│   ├── 抽卡系统/           ← 每日抽卡 + 十连抽卡 + 水晶商店
│   │   ├── backend/        ← Python Flask 图片后端
│   │   └── docs/
│   ├── 好感度系统/         ← 群成员好感度追踪
│   │   └── docs/
│   └── 综合功能包/         ← 背包 + 钓鱼 + 抽签 + 探险
│       └── docs/
├── decks/                  ← 牌堆文件 (.json)
├── docs/                   ← 全局文档
├── .gitignore
├── LICENSE
└── README.md
```

## 插件一览

| 插件 | 目录 | 说明 |
|------|------|------|
| 秘境远征 v3.0 | [`plugins/秘境远征/`](plugins/秘境远征/) | 多人 Roguelike 地牢冒险，7 职业、15+ BOSS、检定系统、图片后端 |
| 抽卡系统 | [`plugins/抽卡系统/`](plugins/抽卡系统/) | 每日抽卡 + 十连抽卡，内置水晶商店，图片后端 |
| 好感度系统 | [`plugins/好感度系统/`](plugins/好感度系统/) | 群成员好感度追踪，互动加成、等级解锁 |
| 综合功能包 | [`plugins/综合功能包/`](plugins/综合功能包/) | 背包、钓鱼、抽签、探险等综合工具 |

## 环境要求

- 海豹骰核心 (SealDice Core) v1.4+
- Python 3.8+（仅图片后端需要）
- Flask + Pillow（仅图片后端需要）

## 快速部署

### 纯 JS 插件

1. 将 `plugins/` 下对应插件的 `.js` 文件上传到海豹骰的 `plugins` 目录
2. 在骰娘 UI 中重载脚本
3. 按需在 UI 配置面板中修改参数

### 带图片后端

以秘境远征为例：

```bash
cd plugins/秘境远征/backend
pip install flask pillow
python expedition_image_backend.py
```

在骰娘 UI 中配置后端地址（默认 `http://127.0.0.1:8015`）。

## 端口分配

| 服务 | 端口 |
|------|------|
| 抽卡图片后端 | 8014 |
| 秘境远征图片后端 | 8015 |

## 添加新内容

- **新插件**：在 `plugins/` 下新建目录，放入 `.js` 文件和 `docs/`
- **牌堆**：将 `.json` 牌堆文件放入 `decks/`
- **全局文档**：放入 `docs/`

## License

MIT
