
export const CANVAS_WIDTH = 1024; // 画布宽度
export const CANVAS_HEIGHT = 600; // 画布高度

// --- 物理系统参数 (Physics) ---
// 平衡补丁：大幅降低重力和速度，回归经典平台游戏手感，解决"太快"的问题
export const GRAVITY = 0.8;         // 重力加速度 (原 1.5)
export const FRICTION = 0.2;        // 地面摩擦力 (增加摩擦，急停更稳)
export const BASE_MOVE_SPEED = 5;   // 基础移动速度 (原 7)
export const JUMP_FORCE = -15;      // 跳跃力度 (原 -22)
export const DOUBLE_JUMP_FORCE = -14; // 二段跳力度

// --- 新机制参数 (Mechanics) ---
export const DASH_SPEED = 15;           // 冲刺速度 (原 20)
export const DASH_DURATION = 12;        // 冲刺持续帧数
export const DASH_COOLDOWN = 300;       // 冲刺冷却
export const MAX_HEAT = 100;            // 武器最大热量值
export const HEAT_COOLDOWN_RATE = 1.5;  // 武器冷却速率
export const BOSS_DEATH_DURATION = 60; // BOSS 死亡慢动作持续时间 (3秒 @ 60fps)

// --- 怪物基础属性 (Enemy Stats) ---
export const ENEMY_STATS = {
  WALKER_SPEED: 0.6,
  FLYER_SPEED: 0.6,
  BOSS_SPEED: 0.3,
  JUMPER_SPEED: 0.5
};

// --- 颜色配置 (Visuals) ---
export const COLORS = {
  PLAYER: '#ff00ff',        // 玩家主色 (霓虹粉)
  PLAYER_HAIR: '#ff073a',   // 玩家头发颜色
  ENEMY_WALKER: '#39ff14',  // 步行怪物颜色 (霓虹绿)
  ENEMY_FLYER: '#00ffff',   // 飞行怪物颜色 (霓虹蓝)
  ENEMY_TURRET: '#faff00',  // 炮台颜色
  ENEMY_BOSS: '#ff073a',    // BOSS颜色
  BULLET_PLAYER: '#ff00ff', // 玩家子弹颜色
  BULLET_ENEMY: '#39ff14',  // 敌人子弹颜色
  BG_DARK: '#050510',       // 背景深色
  PLATFORM: '#2d3748',      // 平台颜色
  PLATFORM_GLOW: '#00ffff', // 平台发光色
  
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
  // 红色方块 (代表机甲 - 默认为空，触发代码绘制的高级机甲)
  PLAYER: '', 
  // 绿色方块 (代表步行怪)
  WALKER: '',
  // 蓝色方块 (代表飞行怪)
  FLYER: '',
  // 深红方块 (代表BOSS)
  BOSS: ''
};

// --- 关卡配置 (Level Configs) ---
export const LEVEL_CONFIGS = [
  { enemies: 25, length: 4000, bossHp: 300, bossAggro: 1, mode: 0 }, // 第1关 (普通)
  { enemies: 35, length: 5000, bossHp: 600, bossAggro: 2, mode: 0 }, // 第2关
  { enemies: 45, length: 6000, bossHp: 1000, bossAggro: 3, mode: 1 }, // 第3关 (强制卷轴)
  { enemies: 60, length: 7000, bossHp: 1500, bossAggro: 4, mode: 2 }, // 第4关 (竞技场死斗)
  { enemies: 80, length: 8000, bossHp: 2500, bossAggro: 5, mode: 0 }, // 第5关
  { enemies: 120, length: 10000, bossHp: 5000, bossAggro: 6, mode: 1 }, // 第6关
];

// --- 技能冷却时间 (单位: 帧, 60帧=1秒) ---
export const SKILL_COOLDOWNS = {
  CANNON: 600,    // Q技能: 10秒
  MISSILE: 2100,  // E技能: 35秒
  RAGE: 2400,     // R技能: 40秒
  SHIELD: 900,    // W技能: 15秒
};

// --- 技能持续时间 (单位: 帧) ---
export const SKILL_DURATIONS = {
  RAGE: 600,      // R技能持续: 10秒
  MISSILE: 300,   // E技能持续: 5秒
  SHIELD: 180,    // W技能持续: 3秒
};

// --- 子弹与战斗数值 (Combat Stats) ---
export const PROJECTILE_STATS = {
  PLAYER_SPEED: 8,         // 玩家普通子弹速度
  ENEMY_SPEED: 2.5,        // 敌人普通子弹速度 (降低，便于躲避)
  BASE_DAMAGE: 2,          // 玩家基础伤害
  
  CANNON_SPEED: 10,         // Q技能巨炮速度 (原 18，太快了)
  CANNON_DAMAGE: 20,
  CANNON_SIZE: 20,
  
  MISSILE_SPEED: 7,         // E技能导弹速度 (原 14，太快看不清)
  MISSILE_TURN_RATE: 0.15,  // 导弹转向灵敏度
  MISSILE_DAMAGE: 2,
  
  LASER_SPEED: 40,
  LASER_DAMAGE: 8,
  
  SHOCKWAVE_DAMAGE: 10,
  
  BOSS_PROJECTILE_SPEED: 4  // 新增：BOSS弹幕专用速度，防止太快
};

// --- 按键映射 ---
export const KEYS = {
  LEFT: ['ArrowLeft'],
  RIGHT: ['ArrowRight'],
  UP: ['ArrowUp'],
  DOWN: ['ArrowDown'],
  JUMP: [' '],         
  DASH: ['Shift'],     
  SHOOT: ['a', 'A'],   
  SKILL_Q: ['q', 'Q'], 
  SKILL_W: ['w', 'W'],
  SKILL_E: ['e', 'E'],
  SKILL_R: ['r', 'R'],
};

// --- 商店价格 ---
export const SHOP_PRICES = {
  DAMAGE: 300,    
  SPEED: 200,     
  FIRE_RATE: 400, 
  HEAL: 100       
};
