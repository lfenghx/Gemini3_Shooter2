

// 游戏状态枚举
export enum GameState {
  MENU,           // 主菜单
  PLAYING,        // 游戏中
  PAUSED,         // 暂停
  GAME_OVER,      // 游戏结束
  VICTORY,        // 胜利
  LEVEL_COMPLETE, // 关卡完成
  SHOP            // 商店界面
}

// 武器类型枚举 (对应升级等级 0-3)
export enum WeaponType {
  BLASTER = 0,    // 初始手枪
  SPREAD = 1,     // 散弹枪
  LASER = 2,      // 激光枪
  RAPID_FIRE = 3  // 加特林
}

// 敌人类型
export enum EnemyType {
  WALKER, // 步行者 (只会走)
  FLYER,  // 飞行者 (空中追踪)
  JUMPER, // 跳跃者 (会跳跃)
  TURRET, // 炮台 (固定位置射击)
  BOSS,   // 关卡BOSS
  BARREL  // 爆炸桶 (环境道具)
}

// 投射物/子弹类型
export enum ProjectileType {
  NORMAL,    // 普通子弹
  CANNON,    // 巨炮 (Q技能)
  MISSILE    // 导弹 (E技能)
}

// 关卡模式
export enum LevelMode {
  STANDARD,   // 普通模式
  AUTOSCROLL, // 强制卷轴 (屏幕自动向右移)
  LOCKDOWN    // 竞技场锁死 (杀光怪才能走)
}

// 基础实体接口
export interface Entity {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number; // X轴速度
  vy: number; // Y轴速度
  color: string;
  hp: number;
  maxHp: number;
  dead: boolean;
}

// 玩家数据结构
export interface Player extends Entity {
  facingRight: boolean;   // 朝向
  isGrounded: boolean;    // 是否在地面
  jumpCount: number;      // 跳跃次数 (用于二段跳)
  invincibleTimer: number;// 无敌时间计时器
  weaponLevel: WeaponType;// 当前武器等级
  shootCooldown: number;  // 射击冷却
  
  // 动作机制
  isCrouching: boolean;    // 新增：是否趴下
  dashTimer: number;       // 冲刺状态剩余时间
  dashCooldown: number;    // 冲刺技能冷却
  weaponHeat: number;      // 武器热量 (0-100)
  overheated: boolean;     // 是否过热 (过热无法射击)
  
  // 属性等级 (商店升级)
  statSpeedLvl: number;
  statDmgLvl: number;
  statFireRateLvl: number;

  // 技能状态
  cannonCooldown: number;
  shieldActive: boolean;
  shieldTimer: number;     // W技能(护盾)持续时间
  shieldCooldown: number;  // W技能(护盾)冷却
  missileTimer: number;    // E技能持续时间
  missileCooldown: number; // E技能冷却
  rageTimer: number;       // R技能持续时间
  rageCooldown: number;    // R技能冷却
}

// 敌人数据结构
export interface Enemy extends Entity {
  type: EnemyType;
  scoreValue: number; // 击杀得分
  shootTimer: number; // 攻击计时器
  patternTimer: number; // 行为模式计时器
  frameOffset: number; // 动画偏移量
  
  // BOSS 死亡特效
  isDying?: boolean;    // 是否处于濒死慢动作状态
  dyingTimer?: number;  // 濒死状态倒计时
}

// 子弹数据结构
export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  damage: number;
  isPlayer: boolean; // 是否是玩家发射的
  lifeTime: number;  // 存活时间 (帧)
  type: ProjectileType;
  targetId?: number; // 追踪目标ID (导弹用)
  originX?: number;  // 发射点X (用于计算伤害衰减)
  
  // 伤害频率限制 (Q技能用)
  hitCooldowns?: Record<number, number>; // key: enemyId, value: lastHitFrame
}

// 粒子效果
export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

// 地形平台
export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'solid' | 'oneway';
  trapType?: 'none' | 'spike' | 'laser'; // 陷阱类型
  trapActive?: boolean; // 陷阱是否激活
  trapTimer?: number;   // 陷阱循环计时器
}

// 掉落道具
export interface Item {
  id: number;
  x: number;
  y: number;
  type: 'health' | 'weapon' | 'coin'; // 道具类型
  weaponType?: WeaponType; // 如果是武器，具体是哪种武器 (S, L, J)
  vx: number;
  vy: number;
}

// 飘字伤害数字
export interface DamageNumber {
  id: number;
  x: number;
  y: number;
  value: string | number;
  life: number;
  color: string;
}

// 全局游戏统计
export interface GameStats {
  score: number;
  lives: number;
  level: number;
  coins: number; // 金币 (用于商店)
}