
export const CANVAS_WIDTH = 1024; // 游戏画布宽度 (像素)
export const CANVAS_HEIGHT = 600; // 游戏画布高度 (像素)

// --- 物理系统参数 (Physics) ---
// 平衡补丁：大幅降低重力和速度，回归经典平台游戏手感，解决"太快"的问题
export const GRAVITY = 0.8;         // 重力加速度 (每帧Y轴增加的速度，原 1.5)
export const FRICTION = 0.2;        // 地面摩擦力系数 (值越小摩擦越大，用于角色停止时的减速)
export const BASE_MOVE_SPEED = 5;   // 玩家基础移动速度 (每帧移动像素，原 7)
export const JUMP_FORCE = -15;      // 一段跳跃力度 (向上为负值，原 -22)
export const DOUBLE_JUMP_FORCE = -14; // 二段跳跃力度

// --- 新机制参数 (Mechanics) ---
export const DASH_SPEED = 15;           // 冲刺时的速度 (像素/帧，原 20)
export const DASH_DURATION = 12;        // 冲刺持续时间 (单位：帧。60帧约等于1秒)
export const DASH_COOLDOWN = 300;       // 冲刺冷却时间 (单位：帧。300帧 = 5秒)
export const MAX_HEAT = 100;            // 武器过热阈值 (热量达到此值将无法射击)
export const HEAT_COOLDOWN_RATE = 1.5;  // 武器自动冷却速率 (每帧减少的热量值)
export const BOSS_DEATH_DURATION = 60;  // BOSS 死亡慢动作特效持续时间 (单位：帧)

// --- 怪物基础属性 (Enemy Stats) ---
export const ENEMY_STATS = {
  WALKER_SPEED: 0.6, // 步行者(绿色怪物)移动速度
  FLYER_SPEED: 0.6,  // 飞行者(蓝色怪物)移动速度
  BOSS_SPEED: 0.3,   // BOSS 移动速度
  JUMPER_SPEED: 0.5  // 跳跃者移动速度
};

// --- 颜色配置 (Visuals) ---
export const COLORS = {
  PLAYER: '#ff00ff',        // 玩家主色 (霓虹粉 - 代码绘制时的备用色)
  PLAYER_HAIR: '#ff073a',   // 玩家头发/装饰色
  ENEMY_WALKER: '#39ff14',  // 步行怪物颜色 (霓虹绿)
  ENEMY_FLYER: '#00ffff',   // 飞行怪物颜色 (霓虹蓝)
  ENEMY_TURRET: '#faff00',  // 炮台颜色
  ENEMY_BOSS: '#ff073a',    // BOSS颜色
  BULLET_PLAYER: '#ff00ff', // 玩家普通子弹颜色
  BULLET_ENEMY: '#39ff14',  // 敌人子弹颜色
  BG_DARK: '#050510',       // 背景深色基调
  PLATFORM: '#2d3748',      // 平台主体颜色
  PLATFORM_GLOW: '#00ffff', // 平台边缘发光色
  
  // 通用霓虹色板
  neonBlue: '#00ffff',
  neonRed: '#ff073a',
  neonGreen: '#39ff14',
  neonYellow: '#faff00',
  neonPink: '#ff00ff'
};

// --- 精灵图配置 (Sprites) ---
// 使用简单的 1x1 像素纯色 Base64 PNG 作为占位符。
// 这种图片非常小，保证加载成功且绝对可见（会自动拉伸）。
// 只要替换这里的字符串为有效的图片URL (.png/.jpg)，即可更换怪物形象。
export const SPRITES = {
  // 红色方块 (代表机甲 - 默认为空字符串，这样游戏会使用代码绘制的高级机甲形象)
  PLAYER: '', 
  // 绿色方块 (代表步行怪 - 纯色占位符)
  WALKER: '',
  // 蓝色方块 (代表飞行怪 - 纯色占位符)
  FLYER: '',
  // 深红方块 (代表BOSS - 纯色占位符)
  BOSS: ''
};

// --- 关卡配置 (Level Configs) ---
// 数组索引对应关卡等级 (0对应第1关)
export const LEVEL_CONFIGS = [
  // enemies: 敌人总数, length: 关卡长度(像素), bossHp: BOSS血量, bossAggro: BOSS攻击欲望(1-6), mode: 关卡模式(0=普通, 1=卷轴, 2=死斗)
  { enemies: 25, length: 5000, bossHp: 300, bossAggro: 1, mode: 0 }, // 第1关 (普通模式)
  { enemies: 35, length: 6000, bossHp: 800, bossAggro: 1, mode: 0 }, // 第2关 (降低攻击欲望，便于躲避)
  { enemies: 45, length: 6500, bossHp: 1350, bossAggro: 2, mode: 1 }, // 第3关 (强制卷轴模式)
  { enemies: 60, length: 7000, bossHp: 2000, bossAggro: 2, mode: 2 }, // 第4关 (竞技场死斗模式)
  { enemies: 80, length: 8000, bossHp: 3000, bossAggro: 3, mode: 2 }, // 第5关 (竞技场死斗模式)
  { enemies: 120, length: 10000, bossHp: 5000, bossAggro: 4, mode: 1 } // 第6关 (所有关卡攻击欲望均降低1-2级)
];

// --- 技能冷却时间 (单位: 帧, 游戏运行在60帧/秒) ---
export const SKILL_COOLDOWNS = {
  CANNON: 600,    // Q技能(巨炮): 10秒 (600帧)
  MISSILE: 2100,  // E技能(导弹): 35秒 (2100帧)
  RAGE: 2400,     // R技能(暴走): 40秒 (2400帧)
  SHIELD: 900,    // W技能(护盾): 15秒 (900帧)
};

// --- 技能持续时间 (单位: 帧) ---
export const SKILL_DURATIONS = {
  RAGE: 600,      // R技能持续: 10秒
  MISSILE: 300,   // E技能持续: 5秒
  SHIELD: 180,    // W技能持续: 3秒
};

// --- 子弹与战斗数值 (Combat Stats) ---
export const PROJECTILE_STATS = {
  PLAYER_SPEED: 8,         // 玩家普通子弹飞行速度
  ENEMY_SPEED: 2.5,        // 敌人普通子弹飞行速度 (降低，便于躲避)
  BASE_DAMAGE: 2,          // 玩家基础伤害值
  
  CANNON_SPEED: 10,         // Q技能巨炮飞行速度
  CANNON_DAMAGE: 20,        // Q技能巨炮单次伤害
  CANNON_SIZE: 20,          // Q技能巨炮判定半径
  
  MISSILE_SPEED: 7,         // E技能导弹飞行速度
  MISSILE_TURN_RATE: 0.15,  // E技能导弹转向灵敏度 (数值越大转向越快)
  MISSILE_DAMAGE: 2,        // E技能导弹单发伤害
  
  LASER_SPEED: 40,          // 激光武器飞行速度 (极快)
  LASER_DAMAGE: 4,          // 激光武器单发伤害
  
  SHOCKWAVE_DAMAGE: 10,     // (已弃用) 震荡波伤害
  
  BOSS_PROJECTILE_SPEED: 3  // BOSS弹幕飞行速度 (降低至3，便于玩家躲避)
};

// --- 按键映射配置 ---
export const KEYS = {
  LEFT: ['ArrowLeft'],     // 向左走
  RIGHT: ['ArrowRight'],   // 向右走
  UP: ['ArrowUp'],         // 向上瞄准
  DOWN: ['ArrowDown'],     // 趴下
  JUMP: [' '],             // 跳跃 (空格)
  DASH: ['Shift'],         // 冲刺 (Shift)
  SHOOT: ['a', 'A'],       // 射击 (A键)
  SKILL_Q: ['q', 'Q'],     // 技能Q
  SKILL_W: ['w', 'W'],     // 技能W
  SKILL_E: ['e', 'E'],     // 技能E
  SKILL_R: ['r', 'R'],     // 技能R
};

// --- 商店价格配置 ---
export const SHOP_PRICES = {
  DAMAGE: 300,    // 升级伤害的价格
  SPEED: 200,     // 升级移动速度的价格
  FIRE_RATE: 400, // 升级射速/冷却的价格
  HEAL: 100       // 购买治疗的价格
};
