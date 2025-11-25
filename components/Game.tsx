
import React, { useEffect, useRef, useCallback } from 'react';
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT, GRAVITY, FRICTION, BASE_MOVE_SPEED, JUMP_FORCE, DOUBLE_JUMP_FORCE, LEVEL_CONFIGS, SKILL_COOLDOWNS, SKILL_DURATIONS, PROJECTILE_STATS, KEYS, DASH_SPEED, DASH_DURATION, DASH_COOLDOWN, MAX_HEAT, HEAT_COOLDOWN_RATE, ENEMY_STATS, SPRITES, BOSS_DEATH_DURATION } from '../constants';
import { GameState, Player, Enemy, Projectile, Platform, Particle, Item, EnemyType, WeaponType, Entity, ProjectileType, LevelMode, DamageNumber } from '../types';
import { audioService } from '../services/audioService';

interface GameProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  stats: { score: number; lives: number; level: number; coins: number };
  setStats: React.Dispatch<React.SetStateAction<{ score: number; lives: number; level: number; coins: number }>>;
  setHp: (hp: number) => void;
  setSkillCooldowns: (cd: number[]) => void;
  onPause: () => void;
  upgrades: { speed: number; dmg: number; fire: number };
}

const Game: React.FC<GameProps> = ({ gameState, setGameState, stats, setStats, setHp, setSkillCooldowns, onPause, upgrades }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);
  const timeScaleRef = useRef<number>(1.0); // 时间缩放，用于慢动作
  
  // --- Sprite Assets ---
  const spritesRef = useRef<Record<string, HTMLImageElement>>({});

  // --- Stable Loop Refs ---
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const FIXED_TIME_STEP = 1000 / 60; 

  // --- Victory Scene Refs ---
  const starsRef = useRef<{x: number, y: number, size: number, blinkSpeed: number, offset: number}[]>([]);

  // --- Game Entity Refs ---
  const playerRef = useRef<Player>({
    id: 0, x: 50, y: 300, 
    width: 32, height: 48, // Updated to 32x48 for Compact Mech
    vx: 0, vy: 0, color: COLORS.PLAYER, hp: 5, maxHp: 5, dead: false,
    facingRight: true, isGrounded: false, jumpCount: 0, invincibleTimer: 0, weaponLevel: WeaponType.BLASTER,
    shootCooldown: 0,
    cannonCooldown: 0, shieldActive: false, shieldTimer: 0, shieldCooldown: 0, missileTimer: 0, missileCooldown: 0, rageTimer: 0, rageCooldown: 0,
    dashTimer: 0, dashCooldown: 0, weaponHeat: 0, overheated: false,
    statSpeedLvl: 0, statDmgLvl: 0, statFireRateLvl: 0,
    isCrouching: false // 新增趴下状态
  });
  
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const platformsRef = useRef<Platform[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const damageNumbersRef = useRef<DamageNumber[]>([]); 
  const cameraXRef = useRef(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  const levelLengthRef = useRef(2000);
  const bossSpawnedRef = useRef(false);
  const levelModeRef = useRef<LevelMode>(LevelMode.STANDARD);
  const lockdownTriggeredRef = useRef(false);
  const lockdownClearedRef = useRef(false);
  const lockdownBoundsRef = useRef({ min: 0, max: 0 });

  // --- Load Sprites ---
  useEffect(() => {
    const loadSprite = (key: string, src: string) => {
        const img = new Image();
        img.src = src;
        spritesRef.current[key] = img;
    };
    // 依然保留加载逻辑，如果 constants.ts 中的 PLAYER 有效，它将覆盖默认形象
    loadSprite('PLAYER', SPRITES.PLAYER); 
    loadSprite('WALKER', SPRITES.WALKER);
    loadSprite('FLYER', SPRITES.FLYER);
    loadSprite('BOSS', SPRITES.BOSS);

    // Initialize Stars for Victory Scene
    starsRef.current = Array.from({ length: 80 }).map(() => ({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (CANVAS_HEIGHT * 0.6),
        size: Math.random() * 2 + 1,
        blinkSpeed: 0.02 + Math.random() * 0.05,
        offset: Math.random() * Math.PI * 2
    }));
  }, []);

  // --- Level Init ---
  const initLevel = useCallback((levelIndex: number) => {
    if (levelIndex > 6) {
        // Protection against loop if state updates delayed
        return;
    }
    const config = LEVEL_CONFIGS[Math.min(levelIndex - 1, LEVEL_CONFIGS.length - 1)];
    levelLengthRef.current = config.length;
    bossSpawnedRef.current = false;
    cameraXRef.current = 0;
    levelModeRef.current = config.mode !== undefined ? config.mode : LevelMode.STANDARD;
    shakeRef.current = 0;
    timeScaleRef.current = 1.0;
    
    lockdownTriggeredRef.current = false;
    lockdownClearedRef.current = false;
    lockdownBoundsRef.current = { min: 0, max: 0 };
    
    playerRef.current.x = 50;
    playerRef.current.y = 100;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.hp = 5;
    playerRef.current.dead = false;
    playerRef.current.rageTimer = 0;
    playerRef.current.rageCooldown = 0;
    playerRef.current.cannonCooldown = 0;
    playerRef.current.missileTimer = 0;
    playerRef.current.missileCooldown = 0;
    playerRef.current.shieldActive = false;
    playerRef.current.shieldTimer = 0;
    playerRef.current.shieldCooldown = 0;
    playerRef.current.weaponHeat = 0;
    playerRef.current.overheated = false;
    playerRef.current.isCrouching = false;
    playerRef.current.width = 32;
    playerRef.current.height = 48;
    setHp(5);

    const platforms: Platform[] = [];
    platforms.push({ x: -100, y: CANVAS_HEIGHT - 40, width: levelLengthRef.current + 1000, height: 40, type: 'solid' });
    
    let currentX = 200;
    while (currentX < levelLengthRef.current - 500) {
      const width = 100 + Math.random() * 200;
      const height = 20;
      const y = CANVAS_HEIGHT - 150 - Math.random() * 250;
      let trapType: 'none' | 'spike' | 'laser' = 'none';
      if (levelIndex > 1 && Math.random() > 0.7) {
          trapType = Math.random() > 0.5 ? 'spike' : 'laser';
      }
      platforms.push({ x: currentX, y, width, height, type: 'solid', trapType, trapActive: true, trapTimer: 0 });
      if (Math.random() > 0.5) {
          platforms.push({ x: currentX + 50, y: y - 120, width: width - 50, height: 20, type: 'solid' });
      }
      currentX += width + 80 + Math.random() * 150;
    }
    platformsRef.current = platforms;

    const enemies: Enemy[] = [];
    for (let i = 0; i < config.enemies; i++) {
      const rand = Math.random();
      let type = EnemyType.WALKER;
      if (rand > 0.9) type = EnemyType.BARREL; 
      else if (rand > 0.7) type = EnemyType.FLYER;
      else if (rand > 0.5) type = EnemyType.TURRET;
      else if (rand > 0.4) type = EnemyType.JUMPER;

      const x = 600 + Math.random() * (levelLengthRef.current - 800);
      enemies.push(createEnemy(x, type, config.bossHp));
    }
    enemiesRef.current = enemies;
    
    projectilesRef.current = [];
    particlesRef.current = [];
    itemsRef.current = [];
    damageNumbersRef.current = [];
    
  }, [setHp, stats.level]);

  const createEnemy = (x: number, type: EnemyType, bossHp: number): Enemy => {
    let y = CANVAS_HEIGHT - 80;
    let width = 40;
    let height = 40;
    let color = COLORS.ENEMY_WALKER;
    let hp = (3 + stats.level * 2); 

    if (type === EnemyType.FLYER) {
      y = CANVAS_HEIGHT - 250 - Math.random() * 150;
      color = COLORS.ENEMY_FLYER;
      width = 40; height = 30;
      hp = 2 + stats.level;
    } else if (type === EnemyType.TURRET) {
      y = CANVAS_HEIGHT - 150 - Math.random() * 200; 
      color = COLORS.ENEMY_TURRET;
      width = 40; height = 40;
      hp = 5 + stats.level * 2;
    } else if (type === EnemyType.BOSS) {
        width = 180; height = 140; 
        color = COLORS.ENEMY_BOSS;
        hp = bossHp;
        y = CANVAS_HEIGHT - 180;
    } else if (type === EnemyType.JUMPER) {
        width = 35; height = 35;
    } else if (type === EnemyType.BARREL) {
        width = 30; height = 45;
        hp = 1; 
        color = '#ff3300';
        y = CANVAS_HEIGHT - 85;
        if (platformsRef.current.length > 5) {
            const p = platformsRef.current[Math.floor(Math.random() * platformsRef.current.length)];
            y = p.y - 45;
            x = p.x + p.width/2;
        }
    }

    return {
      id: Math.random(),
      x, y, width, height, vx: 0, vy: 0, color, hp, maxHp: hp, dead: false,
      type, scoreValue: (type + 1) * 100, shootTimer: Math.random() * 100, patternTimer: 0,
      frameOffset: Math.random() * 100
    };
  };

  const fireBossPattern = (boss: Enemy, player: Player) => {
      if (boss.isDying) return; // 濒死不攻击
      
      const config = LEVEL_CONFIGS[Math.min(stats.level - 1, LEVEL_CONFIGS.length - 1)];
      const aggroLevel = config.bossAggro || 1; 
      const patternCycle = Math.floor(frameCountRef.current / 120) % 3; 
      const centerX = boss.x + boss.width / 2;
      const centerY = boss.y + boss.height / 2;
      const bossProjSpeed = PROJECTILE_STATS.BOSS_PROJECTILE_SPEED; // 使用配置常量

      if (frameCountRef.current % Math.max(5, 20 - aggroLevel * 2) === 0) {
          shakeRef.current = 2; 
          if (patternCycle === 0) {
              const arms = 3 + aggroLevel;
              const angleOffset = frameCountRef.current * 0.1;
              for (let i = 0; i < arms; i++) {
                  const angle = angleOffset + (Math.PI * 2 / arms) * i;
                  projectilesRef.current.push({
                      id: Math.random(), x: centerX, y: centerY, width: 10, height: 10,
                      vx: Math.cos(angle) * bossProjSpeed, vy: Math.sin(angle) * bossProjSpeed,
                      color: COLORS.neonRed, damage: 1, isPlayer: false, lifeTime: 200, type: ProjectileType.NORMAL,
                      hasGravity: false // 螺旋弹幕无重力
                  });
              }
          } else if (patternCycle === 1) {
               const targetAngle = Math.atan2(player.y + player.height/2 - centerY, player.x + player.width/2 - centerX);
               const spreadCount = 3 + Math.floor(aggroLevel / 2);
               for (let i = -Math.floor(spreadCount/2); i <= Math.floor(spreadCount/2); i++) {
                   const angle = targetAngle + i * 0.2;
                   projectilesRef.current.push({
                      id: Math.random(), x: centerX, y: centerY, width: 12, height: 12,
                      vx: Math.cos(angle) * (bossProjSpeed * 1.5), vy: Math.sin(angle) * (bossProjSpeed * 1.5),
                      color: COLORS.neonYellow, damage: 1, isPlayer: false, lifeTime: 200, type: ProjectileType.NORMAL,
                      hasGravity: false // 精准弹幕无重力
                   });
               }
          } else {
               projectilesRef.current.push({
                  id: Math.random(), x: centerX, y: centerY - 50, width: 8, height: 8,
                  vx: (Math.random() - 0.5) * (bossProjSpeed * 2.5), vy: -5 - Math.random() * 5, 
                  color: COLORS.neonGreen, damage: 1, isPlayer: false, lifeTime: 300, type: ProjectileType.NORMAL,
                  hasGravity: true // 火雨有重力
               });
          }
      }
  };

  // --- Core Game Logic ---
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING && gameState !== GameState.VICTORY) return;
    frameCountRef.current++;
    if (shakeRef.current > 0) shakeRef.current *= 0.9; 

    // 如果是胜利状态，只更新背景动画，不更新物理逻辑
    if (gameState === GameState.VICTORY) {
        cameraXRef.current += 1.5; // 缓慢滚动背景
        return;
    }

    const player = playerRef.current;
    const keys = keysPressed.current;

    // Safety check for NaN
    if (isNaN(player.x) || isNaN(player.y)) {
        player.x = 100; player.y = 100; player.vx = 0; player.vy = 0;
    }
    
    if (!player.dead) {
      let speed = (BASE_MOVE_SPEED + upgrades.speed * 0.5); // 降低升级带来的速度收益
      
      const isDashing = player.dashTimer > 0;
      if (isDashing) {
          player.vx = player.facingRight ? DASH_SPEED : -DASH_SPEED;
          player.vy = 0; 
          player.dashTimer--;
          if (frameCountRef.current % 3 === 0) {
            createParticles(player.x, player.y, 1, 'rgba(0,255,255,0.5)');
          }
      } else {
          if (player.rageTimer > 0) speed *= 1.3; 

          // 趴下逻辑 - 修复：处理高度变化导致的抖动
          const isDown = KEYS.DOWN.some(k => keys[k]);
          
          if (player.isGrounded && isDown) {
              if (!player.isCrouching) {
                  // 进入趴下状态：高度从48变为28，Y坐标增加20以保持脚底位置不变
                  player.isCrouching = true;
                  player.height = 28;
                  player.y += 20;
              }
              player.vx *= 0.1;   // 趴下移动极慢
          } else {
              if (player.isCrouching) {
                  // 退出趴下状态：高度恢复48，Y坐标减少20以向上生长
                  player.isCrouching = false;
                  player.height = 48; 
                  player.y -= 20;
              }
              
              if (KEYS.LEFT.some(k => keys[k])) {
                player.vx -= 1.0; 
                player.facingRight = false;
              } else if (KEYS.RIGHT.some(k => keys[k])) {
                player.vx += 1.0;
                player.facingRight = true;
              } else {
                player.vx *= FRICTION; 
              }
              player.vx = Math.max(Math.min(player.vx, speed), -speed);
          }

          player.vy += GRAVITY;
          if (player.vy > 15) player.vy = 15; // 限制下落最大速度
      }

      player.x += player.vx;
      player.y += player.vy;

      if (player.dashCooldown > 0) player.dashCooldown--;
      if (player.cannonCooldown > 0) player.cannonCooldown--;
      
      // E技能：残影特效
      if (player.missileTimer > 0) {
          player.missileTimer--;
          // 生成数字化残影
          if (frameCountRef.current % 4 === 0) {
             createParticles(player.x, player.y, 1, 'rgba(0, 255, 255, 0.3)');
          }
      }

      if (player.missileCooldown > 0) player.missileCooldown--;
      if (player.rageTimer > 0) player.rageTimer--;
      if (player.rageCooldown > 0) player.rageCooldown--;
      if (player.shieldTimer > 0) player.shieldTimer--;
      if (player.shieldCooldown > 0) player.shieldCooldown--;
      if (player.invincibleTimer > 0) player.invincibleTimer--;
      if (player.shootCooldown > 0) player.shootCooldown--;
      
      if (player.shieldTimer === 0 && player.shieldActive) {
          player.shieldActive = false;
          audioService.playHit(); 
      }

      if (player.weaponHeat > 0) {
          player.weaponHeat -= HEAT_COOLDOWN_RATE;
          if (player.weaponHeat <= 0) {
              player.weaponHeat = 0;
              player.overheated = false; 
          }
      }

      if (KEYS.DASH.some(k => keys[k]) && player.dashCooldown <= 0) {
          player.dashTimer = DASH_DURATION;
          player.dashCooldown = DASH_COOLDOWN;
          player.invincibleTimer = DASH_DURATION + 10; 
          audioService.playJump();
          createParticles(player.x, player.y, 10, '#00ffff');
      }
      if (KEYS.SKILL_Q.some(k => keys[k]) && player.cannonCooldown <= 0) {
        player.cannonCooldown = SKILL_COOLDOWNS.CANNON;
        shootCannon(player); 
      }
      if (KEYS.SKILL_E.some(k => keys[k]) && player.missileCooldown <= 0) {
        player.missileCooldown = SKILL_COOLDOWNS.MISSILE;
        player.missileTimer = SKILL_DURATIONS.MISSILE;
        audioService.playPowerUp();
        showDamageNumber(player.x, player.y - 20, "MISSILES UP", '#00ffff');
      }
      if (KEYS.SKILL_R.some(k => keys[k]) && player.rageCooldown <= 0) {
        player.rageTimer = SKILL_DURATIONS.RAGE;
        player.rageCooldown = SKILL_COOLDOWNS.RAGE;
        audioService.playPowerUp();
        showDamageNumber(player.x, player.y - 20, "RAGE MODE", '#ff0000');
      }

      if (levelModeRef.current === LevelMode.LOCKDOWN && !lockdownTriggeredRef.current) {
          const triggerX = levelLengthRef.current / 2;
          if (player.x > triggerX) {
              lockdownTriggeredRef.current = true;
              lockdownBoundsRef.current = { min: triggerX - 400, max: triggerX + 400 };
              audioService.playPowerUp();
              showDamageNumber(player.x, player.y - 100, "LOCKDOWN INITIATED!", '#ff0000');
              shakeRef.current = 10;
              
              const {min, max} = lockdownBoundsRef.current;
              for(let i=0; i<6; i++) {
                  const spawnX = min + Math.random() * (max - min);
                  enemiesRef.current.push(createEnemy(spawnX, EnemyType.FLYER, 10));
                  enemiesRef.current.push(createEnemy(spawnX, EnemyType.WALKER, 10));
              }
          }
      }

      if (lockdownTriggeredRef.current && !lockdownClearedRef.current) {
          const { min, max } = lockdownBoundsRef.current;
          
          if (player.x < min + 20) player.x = min + 20;
          if (player.x > max - 20 - player.width) player.x = max - 20 - player.width;
          
          const targetCamX = (min + max) / 2 - CANVAS_WIDTH / 2;
          cameraXRef.current += (targetCamX - cameraXRef.current) * 0.1;

          const enemiesInZone = enemiesRef.current.filter(e => e.x > min - 100 && e.x < max + 100 && !e.dead);
          if (enemiesInZone.length === 0) {
              lockdownClearedRef.current = true;
              showDamageNumber(player.x, player.y - 50, "LOCKDOWN CLEARED!", '#00ff00');
              audioService.playPowerUp();
          }
      } else if (levelModeRef.current === LevelMode.AUTOSCROLL) {
          cameraXRef.current += 3; 
          if (player.x < cameraXRef.current) damagePlayer(100); 
      } else {
          const targetCamX = player.x - CANVAS_WIDTH / 3;
          cameraXRef.current += (targetCamX - cameraXRef.current) * 0.1;
      }
      
      cameraXRef.current = Math.max(0, Math.min(cameraXRef.current, levelLengthRef.current - CANVAS_WIDTH + 200));
      if (player.y > CANVAS_HEIGHT + 100) damagePlayer(5); 
    }

    player.isGrounded = false;
    platformsRef.current.forEach(plat => {
      if (plat.trapType === 'laser') {
          plat.trapTimer = (plat.trapTimer || 0) + 1;
          if (plat.trapTimer > 180) plat.trapTimer = 0;
          plat.trapActive = plat.trapTimer < 120; 
          
          if (plat.trapActive && rectIntersect(player, {x: plat.x, y: plat.y - 100, width: plat.width, height: 100})) {
               damagePlayer(1);
          }
      }
      
      if (
        player.x < plat.x + plat.width &&
        player.x + player.width > plat.x &&
        player.y + player.height > plat.y &&
        player.y + player.height < plat.y + plat.height + 30 && 
        player.vy >= 0 
      ) {
        player.isGrounded = true;
        player.vy = 0;
        player.y = plat.y - player.height;
        player.jumpCount = 0; 

        if (plat.trapType === 'spike') {
            damagePlayer(1);
            player.vy = -10; 
        }
      }
    });

    projectilesRef.current.forEach(p => {
      if (p.type === ProjectileType.NORMAL && !p.isPlayer && p.vy < 10) {
          if (p.hasGravity) p.vy += 0.2; 
      }
      p.x += p.vx;
      p.y += p.vy;
      p.lifeTime--; 
      
      if (p.type === ProjectileType.MISSILE) {
          let target: Entity | null = null;
          let minDist = 800;
          const targets = p.isPlayer ? enemiesRef.current : [player];
          targets.forEach(e => {
              if (e.dead) return;
              const dist = Math.sqrt(Math.pow(e.x - p.x, 2) + Math.pow(e.y - p.y, 2));
              if (dist < minDist) { minDist = dist; target = e; }
          });

          if (target) {
              const t = target as Entity;
              const dx = (t.x + t.width/2) - p.x;
              const dy = (t.y + t.height/2) - p.y;
              const targetAngle = Math.atan2(dy, dx);
              const currentAngle = Math.atan2(p.vy, p.vx);
              let deltaAngle = targetAngle - currentAngle;
              while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
              while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
              const turnRate = PROJECTILE_STATS.MISSILE_TURN_RATE;
              const newAngle = currentAngle + Math.max(-turnRate, Math.min(turnRate, deltaAngle));
              const speed = p.isPlayer ? PROJECTILE_STATS.MISSILE_SPEED : 6;
              p.vx = Math.cos(newAngle) * speed;
              p.vy = Math.sin(newAngle) * speed;
          }
          if (frameCountRef.current % 3 === 0) createParticles(p.x, p.y, 1, p.isPlayer ? '#00ffff' : '#ff0000');
      }
    });
    projectilesRef.current = projectilesRef.current.filter(p => p.lifeTime > 0);

    enemiesRef.current.forEach(enemy => {
      if (enemy.dead) return;

      // BOSS 濒死慢动作逻辑
      if (enemy.isDying && enemy.dyingTimer) {
          enemy.dyingTimer--;
          if (frameCountRef.current % 5 === 0) {
              shakeRef.current = 20;
              createParticles(enemy.x + Math.random()*enemy.width, enemy.y + Math.random()*enemy.height, 10, '#ffaa00');
              audioService.playExplosion();
          }
          if (enemy.dyingTimer <= 0) {
              // 真正的死亡
              enemy.dead = true;
              timeScaleRef.current = 1.0; // 恢复时间
              
              // 大爆炸
              shakeRef.current = 30;
              for(let i=0; i<10; i++) {
                   createParticles(enemy.x + Math.random()*enemy.width, enemy.y + Math.random()*enemy.height, 20, '#ff0000');
              }
              setStats(prev => ({ ...prev, score: prev.score + enemy.scoreValue * 2, coins: prev.coins + 100 }));
              handleLevelComplete();
          }
          return; // 濒死时不移动也不攻击
      }
      
      const dist = Math.abs(enemy.x - player.x);
      if (dist < 1200) {
        if (enemy.type === EnemyType.BOSS) {
            enemy.x += (player.x > enemy.x ? 1 : -1) * ENEMY_STATS.BOSS_SPEED; 
            fireBossPattern(enemy, player);
        } else if (enemy.type === EnemyType.BARREL) {
        } else {
            if (enemy.type === EnemyType.WALKER || enemy.type === EnemyType.JUMPER) {
               const dir = player.x > enemy.x ? 1 : -1;
               const spd = enemy.type === EnemyType.WALKER ? ENEMY_STATS.WALKER_SPEED : ENEMY_STATS.JUMPER_SPEED;
               enemy.vx = dir * spd;
               enemy.x += enemy.vx;
               enemy.vy += GRAVITY;
               enemy.y += enemy.vy;
               
               platformsRef.current.forEach(plat => {
                  if (
                    enemy.x < plat.x + plat.width &&
                    enemy.x + enemy.width > plat.x &&
                    enemy.y + enemy.height > plat.y &&
                    enemy.y + enemy.height < plat.y + plat.height + 25 &&
                    enemy.vy >= 0
                  ) {
                    enemy.vy = 0;
                    enemy.y = plat.y - enemy.height;
                    if (enemy.type === EnemyType.JUMPER && Math.random() < 0.02) enemy.vy = -18; 
                  }
                });
            } else if (enemy.type === EnemyType.FLYER) {
                 const targetY = player.y - 100;
                 enemy.x += (player.x > enemy.x ? 1 : -1) * ENEMY_STATS.FLYER_SPEED;
                 enemy.y += (targetY - enemy.y) * 0.02 + Math.sin(frameCountRef.current / 20 + enemy.frameOffset) * 2;
            }
            enemy.shootTimer -= 1;
            if (enemy.shootTimer <= 0) {
              if (enemy.type === EnemyType.TURRET || enemy.type === EnemyType.FLYER) {
                shootProjectile(enemy, true);
                enemy.shootTimer = 150; 
              }
            }
        }
      }
    });

    projectilesRef.current.filter(p => p.isPlayer).forEach(bullet => {
      enemiesRef.current.forEach(enemy => {
        if (!enemy.dead && !enemy.isDying && rectIntersect(bullet, enemy)) {
          
          // Q技能伤害频率限制
          if (bullet.type === ProjectileType.CANNON) {
              if (!bullet.hitCooldowns) bullet.hitCooldowns = {};
              const lastHit = bullet.hitCooldowns[enemy.id] || -100;
              if (frameCountRef.current - lastHit < 15) return; // 15帧内不造成二次伤害
              bullet.hitCooldowns[enemy.id] = frameCountRef.current;
          }

          let dmg = bullet.damage;
          if (player.weaponLevel === WeaponType.SPREAD && bullet.originX) {
              const traveled = Math.abs(bullet.x - bullet.originX);
              if (traveled > 300) dmg *= 0.2; 
              else if (traveled > 150) dmg *= 0.5;
          }

          enemy.hp -= dmg;
          showDamageNumber(enemy.x, enemy.y, Math.floor(dmg), '#fff');
          
          if (bullet.type !== ProjectileType.CANNON && player.weaponLevel !== WeaponType.LASER) {
              bullet.lifeTime = 0;
          }
          
          if (bullet.type === ProjectileType.CANNON) {
              createParticles(bullet.x, bullet.y, 20, '#ffaa00');
              audioService.playExplosion();
              shakeRef.current = 5;
          } else {
              createParticles(bullet.x, bullet.y, 5, COLORS.neonGreen);
          }
          
          if (enemy.hp <= 0) {
            
            if (enemy.type === EnemyType.BOSS) {
                // 触发 BOSS 处决特效
                enemy.isDying = true;
                enemy.dyingTimer = BOSS_DEATH_DURATION;
                timeScaleRef.current = 0.2; // 开启慢动作
                showDamageNumber(enemy.x, enemy.y - 50, "FINISH HIM!", '#ff0000');
                audioService.playExplosion();
            } else {
                enemy.dead = true;
                if (enemy.type === EnemyType.BARREL) {
                    shakeRef.current = 15;
                    audioService.playExplosion();
                    createParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, 40, '#ff3300');
                    projectilesRef.current.push({
                        id: Math.random(), x: enemy.x - 80, y: enemy.y - 80, width: 200, height: 200,
                        vx: 0, vy: 0, color: 'transparent', damage: 50,
                        isPlayer: true, lifeTime: 2, type: ProjectileType.NORMAL 
                    });
                } else {
                    createParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, 20, enemy.color);
                    audioService.playExplosion();
                }

                setStats(prev => ({ ...prev, score: prev.score + enemy.scoreValue, coins: prev.coins + Math.floor(enemy.scoreValue / 10) }));
                showDamageNumber(enemy.x, enemy.y - 30, `+${Math.floor(enemy.scoreValue/10)}$`, '#ffff00');
                
                if (Math.random() < 0.35) { 
                   const rand = Math.random();
                   let type: 'coin' | 'health' | 'weapon' = 'coin';
                   let wType: WeaponType | undefined = undefined;
                   
                   if (rand > 0.8) {
                       type = 'weapon';
                       const wRand = Math.random();
                       if (wRand < 0.33) wType = WeaponType.SPREAD;
                       else if (wRand < 0.66) wType = WeaponType.LASER;
                       else wType = WeaponType.RAPID_FIRE;
                   }
                   else if (rand > 0.6) type = 'health';
                   
                   itemsRef.current.push({ id: Math.random(), x: enemy.x, y: enemy.y, type, weaponType: wType, vx: 0, vy: -8 });
                }
            }
          }
        }
      });
    });

    if (!player.invincibleTimer) {
      projectilesRef.current.filter(p => !p.isPlayer).forEach(bullet => {
        if (rectIntersect(bullet, player)) {
            if (player.shieldActive) {
                bullet.lifeTime = 0;
                audioService.playHit(); 
                createParticles(bullet.x, bullet.y, 5, '#00ffff');
            } else {
                damagePlayer(1);
                bullet.lifeTime = 0;
            }
        }
      });
      
      enemiesRef.current.forEach(enemy => {
          if (!enemy.dead && !enemy.isDying && rectIntersect(player, enemy)) {
             if (player.dashTimer > 0) return; 
             
             if (player.shieldActive) {
                 player.vx = -player.vx * 2; 
                 player.vy = -5;
                 createParticles(player.x, player.y, 10, '#00ffff');
             } else {
                 damagePlayer(1);
             }
          }
      });
    }

    itemsRef.current.forEach(item => {
        item.vy += GRAVITY;
        item.y += item.vy;
        if (item.y > CANVAS_HEIGHT - 60) { item.y = CANVAS_HEIGHT - 60; item.vy = 0; }
        platformsRef.current.forEach(plat => {
             if (item.y + 10 > plat.y && item.y < plat.y + plat.height && item.x > plat.x && item.x < plat.x + plat.width && item.vy >= 0) {
                 item.y = plat.y - 15; item.vy = 0;
             }
        });
        
        if (rectIntersect(player, { ...item, width: 20, height: 20 })) {
            collectItem(item);
            item.y = 10000; 
        }
    });
    itemsRef.current = itemsRef.current.filter(i => i.y < 2000);
    enemiesRef.current = enemiesRef.current.filter(e => !e.dead);
    particlesRef.current.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    
    damageNumbersRef.current.forEach(d => { d.y -= 1; d.life--; });
    damageNumbersRef.current = damageNumbersRef.current.filter(d => d.life > 0);

    if (!bossSpawnedRef.current && player.x > levelLengthRef.current - 800) {
        bossSpawnedRef.current = true;
        enemiesRef.current.push(createEnemy(levelLengthRef.current - 200, EnemyType.BOSS, LEVEL_CONFIGS[Math.min(stats.level - 1, 5)].bossHp));
    }

    setSkillCooldowns([player.cannonCooldown, player.shieldCooldown, player.missileCooldown, player.rageCooldown]);

  }, [gameState, stats, setHp, setStats, setSkillCooldowns, initLevel, upgrades]);

  const rectIntersect = (r1: any, r2: any) => {
    return !(r2.x > r1.x + r1.width || r2.x + r2.width < r1.x || r2.y > r1.y + r1.height || r2.y + r2.height < r1.y);
  };

  const showDamageNumber = (x: number, y: number, value: string | number, color: string) => {
      damageNumbersRef.current.push({ id: Math.random(), x, y, value, life: 40, color });
  };

  const damagePlayer = (amount: number) => {
      const player = playerRef.current;
      if (player.invincibleTimer > 0 || player.dead) return;
      player.hp -= amount;
      player.invincibleTimer = 60; 
      setHp(player.hp);
      createParticles(player.x, player.y, 10, COLORS.PLAYER_HAIR);
      shakeRef.current = 10;
      audioService.playHit();
      showDamageNumber(player.x, player.y, `-${amount}`, '#ff0000');
      if (player.hp <= 0) handleDeath();
  };

  const handleDeath = () => {
      const player = playerRef.current;
      player.dead = true;
      setStats(prev => {
          const newLives = prev.lives - 1;
          if (newLives < 0) {
              setGameState(GameState.SCORE_SUBMIT);
              return prev;
          }
          setTimeout(() => {
            player.dead = false; player.hp = 5; setHp(5);
            player.x = cameraXRef.current + 100; player.y = 100; player.vy = 0;
            player.rageTimer = 0; player.missileTimer = 0; player.weaponLevel = WeaponType.BLASTER; 
            player.weaponHeat = 0; player.overheated = false;
            lockdownTriggeredRef.current = false; 
          }, 1000);
          return { ...prev, lives: newLives };
      });
  };

  const handleLevelComplete = () => {
      setGameState(GameState.LEVEL_COMPLETE);
      // 如果是第6关 (stats.level === 6)，完成后不进商店，而是直接通关
      if (stats.level >= 6) {
          setTimeout(() => {
              setGameState(GameState.VICTORY);
              cameraXRef.current = 0; // 重置摄像机，让通关背景从头开始滚
              audioService.stopMusic();
              audioService.startVictoryMusic();
          }, 2000);
      } else {
          setTimeout(() => setGameState(GameState.SHOP), 2000);
      }
  };

  const collectItem = (item: Item) => {
      audioService.playPowerUp();
      if (item.type === 'coin') {
          setStats(prev => ({ ...prev, score: prev.score + 50, coins: prev.coins + 5 }));
          createParticles(item.x, item.y, 8, '#ffff00');
          showDamageNumber(item.x, item.y, "+5$", '#ffff00');
      } else if (item.type === 'health') {
          playerRef.current.hp = Math.min(playerRef.current.hp + 2, playerRef.current.maxHp);
          setHp(playerRef.current.hp);
          createParticles(item.x, item.y, 8, '#00ff00');
      } else if (item.type === 'weapon' && item.weaponType !== undefined) {
          playerRef.current.weaponLevel = item.weaponType;
          setStats(prev => ({ ...prev, score: prev.score + 200 }));
          createParticles(item.x, item.y, 30, '#ff00ff');
          
          let name = "UPGRADE!";
          if (item.weaponType === WeaponType.SPREAD) name = "SHOTGUN!";
          else if (item.weaponType === WeaponType.LASER) name = "LASER!";
          else if (item.weaponType === WeaponType.RAPID_FIRE) name = "MINIGUN!";
          
          showDamageNumber(item.x, item.y, name, '#ff00ff');
      }
  };

  const shootCannon = (player: Player) => {
     audioService.playShoot(true, 'cannon');
     // 增加震动
     shakeRef.current = 20;
     const vx = player.facingRight ? PROJECTILE_STATS.CANNON_SPEED : -PROJECTILE_STATS.CANNON_SPEED;
     projectilesRef.current.push({
         id: Math.random(), x: player.x + (player.facingRight ? player.width : -20), y: player.y + 15,
         width: PROJECTILE_STATS.CANNON_SIZE, height: PROJECTILE_STATS.CANNON_SIZE,
         vx: vx, vy: 0, color: '#ffaa00', damage: PROJECTILE_STATS.CANNON_DAMAGE, isPlayer: true, lifeTime: 80, type: ProjectileType.CANNON
     });
     // 增加后坐力
     player.vx -= vx * 2.0; 
  };

  const shootProjectile = (source: Entity | Player, isEnemy: boolean) => {
      const p = source;
      const isPlayer = !isEnemy;
      const player = playerRef.current;
      
      if (isPlayer) {
          if ((source as Player).shootCooldown > 0) return;
          if (player.overheated) {
              showDamageNumber(player.x, player.y - 30, "OVERHEAT!", '#ff0000');
              return;
          }

          let cd = 12 - (upgrades.fire * 2); 
          if (player.weaponLevel === WeaponType.RAPID_FIRE) {
              cd = 4; 
              player.weaponHeat += 5;
              if (player.weaponHeat >= MAX_HEAT) {
                  player.overheated = true;
                  player.weaponHeat = MAX_HEAT;
                  audioService.playHit(); 
              }
          }
          if (player.rageTimer > 0) cd = Math.max(2, cd / 2); 
          (source as Player).shootCooldown = cd;
      }

      // --- 多向射击逻辑 ---
      let vx = 0; 
      let vy = 0;
      
      if (isPlayer) {
          const keys = keysPressed.current;
          const speed = PROJECTILE_STATS.PLAYER_SPEED;
          
          if (KEYS.UP.some(k => keys[k])) {
              vy = -speed;
              if (KEYS.LEFT.some(k => keys[k])) {
                  vx = -speed * 0.7; vy = -speed * 0.7;
              } else if (KEYS.RIGHT.some(k => keys[k])) {
                  vx = speed * 0.7; vy = -speed * 0.7;
              } else {
                  vx = 0; // 纯垂直向上
              }
          } else {
              // 默认水平射击
              vx = (source as Player).facingRight ? speed : -speed;
              vy = 0;
          }
      } else {
          // 敌人射击逻辑
          const angle = Math.atan2(playerRef.current.y - p.y, playerRef.current.x - p.x);
          const speed = PROJECTILE_STATS.ENEMY_SPEED;
          vx = Math.cos(angle) * speed; vy = Math.sin(angle) * speed;
      }

      const baseDmg = isPlayer ? (PROJECTILE_STATS.BASE_DAMAGE + upgrades.dmg) : 1;

      const createProj = (ox: number, oy: number, ovx: number, ovy: number, damage: number, color: string, type = ProjectileType.NORMAL, w?: number, h?: number) => {
          projectilesRef.current.push({
              id: Math.random(), x: ox, y: oy, width: w || (isPlayer ? 12 : 8), height: h || (isPlayer ? 6 : 8),
              vx: ovx, vy: ovy, color: color, damage: damage, isPlayer: isPlayer, lifeTime: 100, type: type, originX: ox
          });
      };

      if (isPlayer) {
        const wLvl = player.weaponLevel;
        const spawnX = p.x + (player.facingRight ? p.width : -10);
        const spawnY = p.y + 25; // 大约在手部位置

        if (wLvl === WeaponType.BLASTER) {
             audioService.playShoot(true, 'normal');
             createProj(spawnX, spawnY, vx, vy, baseDmg, COLORS.BULLET_PLAYER);
        } else if (wLvl === WeaponType.SPREAD) {
             audioService.playShoot(true, 'normal');
             const spreadDmg = baseDmg * 2; 
             // 简易散射：仅在水平射击时应用扇形，向上射击时简化
             if (vy !== 0 && vx === 0) {
                 createProj(spawnX, spawnY, -2, vy, spreadDmg, COLORS.BULLET_PLAYER, ProjectileType.NORMAL, 14, 8);
                 createProj(spawnX, spawnY, 0, vy, spreadDmg, COLORS.BULLET_PLAYER, ProjectileType.NORMAL, 14, 8);
                 createProj(spawnX, spawnY, 2, vy, spreadDmg, COLORS.BULLET_PLAYER, ProjectileType.NORMAL, 14, 8);
             } else {
                 createProj(spawnX, spawnY, vx, vy, spreadDmg, COLORS.BULLET_PLAYER, ProjectileType.NORMAL, 14, 8);
                 createProj(spawnX, spawnY, vx, vy - 2, spreadDmg, COLORS.BULLET_PLAYER, ProjectileType.NORMAL, 14, 8);
                 createProj(spawnX, spawnY, vx, vy + 2, spreadDmg, COLORS.BULLET_PLAYER, ProjectileType.NORMAL, 14, 8);
                 createProj(spawnX, spawnY, vx, vy - 4, spreadDmg, COLORS.BULLET_PLAYER, ProjectileType.NORMAL, 14, 8);
                 createProj(spawnX, spawnY, vx, vy + 4, spreadDmg, COLORS.BULLET_PLAYER, ProjectileType.NORMAL, 14, 8);
             }
        } else if (wLvl === WeaponType.LASER) {
             audioService.playShoot(true, 'laser');
             
             // 修复：计算激光速度向量，支持斜向射击
             const speed = PROJECTILE_STATS.LASER_SPEED;
             let lvx = vx;
             let lvy = vy;
             
             // 归一化并应用激光速度
             if (lvx !== 0 || lvy !== 0) {
                const mag = Math.sqrt(lvx*lvx + lvy*lvy);
                lvx = (lvx / mag) * speed;
                lvy = (lvy / mag) * speed;
             } else {
                lvx = player.facingRight ? speed : -speed;
                lvy = 0;
             }
             
             createProj(spawnX, spawnY, lvx, lvy, PROJECTILE_STATS.LASER_DAMAGE + upgrades.dmg, '#00ffff', ProjectileType.NORMAL, 60, 6);
        } else if (wLvl === WeaponType.RAPID_FIRE) {
             audioService.playShoot(true, 'normal');
             shakeRef.current = 1; 
             const spread = (Math.random() - 0.5) * 5;
             createProj(spawnX, spawnY + spread, vx, vy + spread, baseDmg * 0.8, COLORS.neonYellow, ProjectileType.NORMAL, 10, 10);
        }

        if (player.missileTimer > 0) {
            audioService.playMissile();
            for(let i=0; i<3; i++) {
                const mvx = (Math.random() - 0.5) * 10;
                const mvy = -5 - Math.random() * 5;
                createProj(spawnX, p.y + 10, mvx, mvy, PROJECTILE_STATS.MISSILE_DAMAGE + upgrades.dmg, '#00ffff', ProjectileType.MISSILE, 10, 10);
            }
        }
      } else {
          createProj(p.x + p.width/2, p.y + p.height/2, vx, vy, 1, COLORS.BULLET_ENEMY);
          audioService.playShoot(false);
      }
  };

  const createParticles = (x: number, y: number, count: number, color: string) => {
      for (let i = 0; i < count; i++) {
          particlesRef.current.push({
              id: Math.random(), x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
              life: 20 + Math.random() * 20, color, size: Math.random() * 4 + 1
          });
      }
  };

  const drawPlayerSprite = (ctx: CanvasRenderingContext2D, p: Player) => {
      const sprite = spritesRef.current['PLAYER'];
      
      // Strict save/restore block
      ctx.save();
      
      ctx.translate(p.x + p.width/2, p.y + p.height/2);
      if (!p.facingRight) ctx.scale(-1, 1);
      if (p.isCrouching) {
          ctx.translate(0, 10); // Lower center of mass
          ctx.scale(1.1, 0.7); // Squash
      }

      // --- PATH 1: SPRITE (If valid) ---
      if (sprite && sprite.complete && sprite.naturalWidth > 1) { 
          ctx.translate(-p.width/2, -p.height/2);
          ctx.drawImage(sprite, 0, 0, p.width, p.height);
          ctx.restore();
          return; 
      }

      // --- PATH 2: SD CYBER-KNIGHT (Cape & Big Head) ---
      const isRage = p.rageTimer > 0;
      const glow = isRage ? '#ff0000' : '#00ffff'; 
      const armorMain = '#e2e8f0'; // White
      const armorDark = '#2d3748'; // Dark Grey

      // Bobbing animation
      const bob = !p.isGrounded ? 0 : Math.sin(frameCountRef.current * 0.2) * 2;
      
      // --- CAPE ---
      ctx.save();
      ctx.translate(-6, -5 + bob);
      ctx.fillStyle = isRage ? '#9b2c2c' : '#2b6cb0'; // Red or Blue cape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      // Dynamic wave based on velocity
      const wind = Math.abs(p.vx) * 2;
      const wave = Math.sin(frameCountRef.current * 0.3) * (wind > 1 ? 5 : 2);
      const capeLen = 25;
      
      // Simple wave shape
      ctx.quadraticCurveTo(-15 - wind, 10, -5 - wind/2 + wave, capeLen);
      ctx.lineTo(5 + wave, capeLen);
      ctx.quadraticCurveTo(0, 10, 8, 0);
      ctx.fill();
      ctx.restore();

      // --- BODY (Tiny) ---
      ctx.fillStyle = armorDark;
      ctx.fillRect(-6, -2 + bob, 12, 12); // Small torso
      
      // --- LEGS (Floating) ---
      // Back Leg
      ctx.save();
      ctx.translate(-6, 12);
      if (Math.abs(p.vx) > 0.1 && p.isGrounded) ctx.rotate(Math.sin(frameCountRef.current * 0.4) * 0.8);
      ctx.fillStyle = armorMain;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(3, 8); ctx.lineTo(-5, 8); ctx.fill(); // Boot
      ctx.restore();
      
      // Front Leg
      ctx.save();
      ctx.translate(6, 12);
      if (Math.abs(p.vx) > 0.1 && p.isGrounded) ctx.rotate(-Math.sin(frameCountRef.current * 0.4) * 0.8);
      ctx.fillStyle = armorMain;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(3, 8); ctx.lineTo(-5, 8); ctx.fill(); // Boot
      ctx.restore();

      // --- HEAD (Huge) ---
      ctx.save();
      ctx.translate(0, -10 + bob);
      
      // Helmet Main
      ctx.fillStyle = armorMain;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI*2); 
      ctx.fill();
      
      // Visor
      ctx.fillStyle = '#1a202c'; // Black glass
      ctx.beginPath();
      ctx.moveTo(-11, -2); ctx.lineTo(11, -2); ctx.lineTo(8, 8); ctx.lineTo(-8, 8);
      ctx.fill();
      
      // Glowing Eyes/Strip
      ctx.fillStyle = glow;
      ctx.shadowBlur = 10; ctx.shadowColor = glow;
      ctx.fillRect(-8, 0, 16, 3);
      ctx.shadowBlur = 0;
      
      // V-Antenna (Big)
      ctx.fillStyle = '#f6e05e';
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-14, -24); ctx.lineTo(0, -12); ctx.lineTo(14, -24); ctx.fill();
      
      // Scarf/Energy Collar
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 10, 8, 0, Math.PI); ctx.stroke();
      
      ctx.restore();

      // --- ARM (Floating) ---
      const keys = keysPressed.current;
      let rot = 0;
      if (KEYS.UP.some(k => keys[k]) && !p.isCrouching) {
          rot = -Math.PI/2;
          if (KEYS.LEFT.some(k => keys[k]) || KEYS.RIGHT.some(k => keys[k])) rot = -Math.PI/4;
      }
      
      ctx.save();
      ctx.translate(8, 4 + bob);
      ctx.rotate(rot);
      ctx.fillStyle = armorMain;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill(); // Hand
      ctx.fillStyle = armorDark;
      ctx.fillRect(2, -3, 10, 6); // Cannon
      ctx.fillStyle = p.weaponHeat > 50 ? '#e53e3e' : '#1a202c';
      ctx.fillRect(12, -2, 4, 4); // Muzzle
      ctx.restore();

      // E-Skill Floating Orbs
      if (p.missileTimer > 0) {
          const orbit = frameCountRef.current * 0.1;
          ctx.fillStyle = '#00ffff';
          ctx.beginPath(); ctx.arc(Math.cos(orbit)*25, Math.sin(orbit)*25, 3, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(Math.cos(orbit + Math.PI)*25, Math.sin(orbit + Math.PI)*25, 3, 0, Math.PI*2); ctx.fill();
      }

      // Shield Overlay
      if (p.shieldActive) {
          ctx.strokeStyle = COLORS.neonBlue; ctx.lineWidth = 2; ctx.beginPath();
          ctx.arc(0, 0, 45, 0, Math.PI*2); ctx.stroke();
          ctx.fillStyle = `rgba(0, 255, 255, ${0.15 + Math.sin(frameCountRef.current * 0.1) * 0.05})`; ctx.fill();
      }

      ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy) => {
      // 检查并使用贴图
      let spriteKey = '';
      if (e.type === EnemyType.WALKER || e.type === EnemyType.JUMPER) spriteKey = 'WALKER';
      else if (e.type === EnemyType.FLYER || e.type === EnemyType.TURRET) spriteKey = 'FLYER';
      else if (e.type === EnemyType.BOSS) spriteKey = 'BOSS';

      const sprite = spritesRef.current[spriteKey];
      
      // FIX: Check naturalWidth
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
          ctx.save();
          if (e.isDying) {
             // 濒死震动特效
             ctx.translate(e.x + (Math.random()-0.5)*5, e.y + (Math.random()-0.5)*5);
             ctx.globalCompositeOperation = 'exclusion'; // 负片闪烁效果
          } else {
             ctx.translate(e.x, e.y);
          }
          
          if (e.type === EnemyType.FLYER) {
              const hover = Math.sin(frameCountRef.current * 0.1) * 5;
              ctx.drawImage(sprite, 0, hover, e.width, e.height);
          } else {
              ctx.drawImage(sprite, 0, 0, e.width, e.height);
          }
          
          // BOSS 血条绘制在贴图上方
          if (e.type === EnemyType.BOSS) {
               ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText("OMEGA TANK", e.width/2, -45);
               ctx.fillStyle = 'red'; ctx.fillRect(0, -30, e.width, 8);
               ctx.fillStyle = '#0f0'; ctx.fillRect(0, -30, e.width * (e.hp / e.maxHp), 8); ctx.strokeStyle = '#fff'; ctx.strokeRect(0, -30, e.width, 8);
          }
          ctx.restore();
          return;
      }

      // Fallback
      if (e.type === EnemyType.BARREL) {
          ctx.fillStyle = '#aa0000';
          ctx.fillRect(e.x, e.y, e.width, e.height);
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(e.x + 5, e.y + 5, e.width - 10, e.height - 10);
          ctx.fillStyle = '#ffff00';
          ctx.font = 'bold 20px monospace';
          ctx.fillText("!", e.x + 10, e.y + 30);
          return;
      }

      if (e.type === EnemyType.WALKER || e.type === EnemyType.JUMPER) {
          const anim = Math.sin(frameCountRef.current * 0.2 + e.frameOffset);
          ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
          for(let i=0; i<4; i++) {
              const legX = e.x + 5 + i * 8; ctx.beginPath(); ctx.moveTo(legX, e.y + 20);
              ctx.lineTo(legX - 10 + (anim * 5 * ((i%2===0)?1:-1)), e.y + e.height); ctx.stroke();
          }
          ctx.fillStyle = e.color; ctx.shadowBlur = 10; ctx.shadowColor = e.color;
          ctx.beginPath(); ctx.arc(e.x + e.width/2, e.y + 20, 15, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x + e.width/2 + (Math.sign(e.vx)*5), e.y + 20, 6, 0, Math.PI*2); ctx.fill();
      } else if (e.type === EnemyType.FLYER || e.type === EnemyType.TURRET) {
          const hover = Math.sin(frameCountRef.current * 0.1 + e.frameOffset) * 5;
          ctx.fillStyle = '#333'; ctx.fillRect(e.x - 5, e.y + 10 + hover, 10, 15); ctx.fillRect(e.x + e.width - 5, e.y + 10 + hover, 10, 15);
          ctx.fillStyle = '#0ff';
          if (Math.random() > 0.5) { ctx.fillRect(e.x - 3, e.y + 25 + hover, 6, 10); ctx.fillRect(e.x + e.width - 3, e.y + 25 + hover, 6, 10); }
          ctx.shadowBlur = 10; ctx.shadowColor = e.color;
          ctx.fillStyle = e.color; ctx.beginPath(); ctx.ellipse(e.x + e.width/2, e.y + 15 + hover, 20, 10, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(e.x + e.width/2, e.y + 10 + hover, 8, Math.PI, 0); ctx.fill();
      } else if (e.type === EnemyType.BOSS) {
          ctx.fillStyle = '#222';
          const offset = (frameCountRef.current * 2) % 10;
          ctx.fillRect(e.x, e.y + e.height - 30, e.width, 30);
          ctx.strokeStyle = '#444';
          for(let i=0; i<e.width; i+=15) { ctx.beginPath(); ctx.moveTo(e.x + i + offset, e.y + e.height - 30); ctx.lineTo(e.x + i + offset, e.y + e.height); ctx.stroke(); }
          ctx.shadowBlur = 15; ctx.shadowColor = '#f00'; ctx.fillStyle = '#500'; ctx.fillRect(e.x + 10, e.y + 40, e.width - 20, e.height - 70);
          ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(frameCountRef.current * 0.1) * 0.5})`; ctx.beginPath(); ctx.arc(e.x + e.width/2, e.y + 80, 20, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(e.x + e.width/2, e.y + 40, 40, Math.PI, 0); ctx.fill();
          const aimX = playerRef.current.x;
          const angle = Math.atan2(playerRef.current.y - (e.y+40), aimX - (e.x + e.width/2));
          ctx.save(); ctx.translate(e.x + e.width/2, e.y + 40); ctx.rotate(angle);
          ctx.fillStyle = '#333'; ctx.fillRect(0, -10, 60, 20);
          ctx.fillStyle = '#f00'; if (e.shootTimer < 20) ctx.fillRect(0, -10, 60, 20); ctx.restore();
          ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText("OMEGA TANK", e.x + e.width/2, e.y - 45);
          ctx.fillStyle = 'red'; ctx.fillRect(e.x, e.y - 30, e.width, 8);
          ctx.fillStyle = '#0f0'; ctx.fillRect(e.x, e.y - 30, e.width * (e.hp / e.maxHp), 8); ctx.strokeStyle = '#fff'; ctx.strokeRect(e.x, e.y - 30, e.width, 8);
      }
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, camX: number) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#020205'); gradient.addColorStop(1, '#0f0f20');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const drawLayer = (scroll: number, color: string, width: number, gap: number, baseH: number, varH: number, neon: boolean) => {
          const startX = Math.floor(camX * scroll / (width + gap)) * (width + gap);
          const endX = startX + CANVAS_WIDTH + width + gap;
          for (let x = startX; x < endX; x += width + gap) {
              const h = baseH + Math.abs(Math.sin(x * 0.01)) * varH;
              const screenX = x - camX * scroll;
              ctx.fillStyle = color; ctx.fillRect(screenX, CANVAS_HEIGHT - h, width, h);
              if (neon) {
                  const r = Math.sin(x);
                  if (r > 0.5) {
                      ctx.fillStyle = r > 0.8 ? '#ff00ff' : '#00ffff'; ctx.fillRect(screenX + 5, CANVAS_HEIGHT - h + 5, width - 10, 5);
                      for(let wy = 0; wy < h - 20; wy+=20) { if (Math.sin(wy*x) > 0) ctx.fillRect(screenX + 10, CANVAS_HEIGHT - h + 20 + wy, 5, 10); if (Math.sin(wy*x + 1) > 0) ctx.fillRect(screenX + width - 15, CANVAS_HEIGHT - h + 20 + wy, 5, 10); }
                  }
              }
          }
      };
      drawLayer(0.1, '#050510', 100, 10, 200, 150, false); 
      drawLayer(0.3, '#0a0a1a', 80, 40, 150, 100, true);  
      const fogGrad = ctx.createLinearGradient(0, CANVAS_HEIGHT - 200, 0, CANVAS_HEIGHT);
      fogGrad.addColorStop(0, 'rgba(0,0,0,0)'); fogGrad.addColorStop(1, 'rgba(5,5,20,0.8)');
      ctx.fillStyle = fogGrad; ctx.fillRect(0, CANVAS_HEIGHT - 200, CANVAS_WIDTH, 200);
  };

  const drawPlatform = (ctx: CanvasRenderingContext2D, p: Platform) => {
      ctx.fillStyle = '#1a202c'; ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#f6e05e'; ctx.fillRect(p.x, p.y, p.width, 4);
      ctx.strokeStyle = '#2d3748'; ctx.beginPath();
      for (let i = 20; i < p.width; i += 40) {
          ctx.moveTo(p.x + i, p.y); ctx.lineTo(p.x + i, p.y + p.height);
          if (p.height > 20 && i + 20 < p.width) { ctx.moveTo(p.x + i, p.y); ctx.lineTo(p.x + i + 20, p.y + p.height); }
      }
      ctx.stroke();

      if (p.trapType === 'spike') {
          ctx.fillStyle = '#999';
          for(let i=0; i<p.width; i+=20) {
              ctx.beginPath(); ctx.moveTo(p.x + i, p.y); ctx.lineTo(p.x + i + 10, p.y - 20); ctx.lineTo(p.x + i + 20, p.y); ctx.fill();
          }
      } else if (p.trapType === 'laser') {
          ctx.fillStyle = '#333';
          ctx.fillRect(p.x + p.width/2 - 10, p.y - 5, 20, 5);
          if (p.trapActive) {
              ctx.shadowBlur = 20; ctx.shadowColor = '#f00';
              ctx.fillStyle = 'rgba(255,0,0,0.5)';
              ctx.fillRect(p.x + p.width/2 - 5, p.y - 105, 10, 100);
              ctx.fillStyle = '#fff';
              ctx.fillRect(p.x + p.width/2 - 2, p.y - 105, 4, 100);
              ctx.shadowBlur = 0;
          } else {
              if (p.trapTimer && p.trapTimer > 100 && frameCountRef.current % 10 < 5) {
                  ctx.fillStyle = 'rgba(255,0,0,0.2)';
                  ctx.fillRect(p.x + p.width/2 - 2, p.y - 105, 4, 100);
              }
          }
      }
  };

  const drawVictoryScene = (ctx: CanvasRenderingContext2D) => {
      // 1. Draw Background (Slow scroll)
      drawBackground(ctx, cameraXRef.current);
      
      // 2. Draw Moon
      ctx.save();
      ctx.translate(CANVAS_WIDTH - 150, 100);
      ctx.shadowBlur = 50; ctx.shadowColor = '#fef3c7';
      ctx.fillStyle = '#fef3c7'; 
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // 3. Draw Stars (Twinkling)
      starsRef.current.forEach(star => {
          const blink = Math.sin(frameCountRef.current * star.blinkSpeed + star.offset);
          ctx.globalAlpha = (blink + 1) / 2; 
          ctx.fillStyle = '#fcd34d';
          ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 4. Draw Moving Ground Grid to simulate walking
      ctx.save();
      // Simple perspective grid
      const floorY = CANVAS_HEIGHT - 50;
      const moveOffset = (cameraXRef.current * 2) % 100; // Simulate movement speed
      
      // Ground plane
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, floorY, CANVAS_WIDTH, 50);
      
      // Moving lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      // Vertical moving lines (perspective) - moving left to right relative to camera
      for(let x = -moveOffset; x < CANVAS_WIDTH + 100; x += 100) {
          // Simple vertical lines for floor tiles
          ctx.moveTo(x, floorY);
          ctx.lineTo(x - 40, CANVAS_HEIGHT); // Slant left
      }
      // Horizontal lines (static relative to screen bottom)
      ctx.moveTo(0, floorY + 10); ctx.lineTo(CANVAS_WIDTH, floorY + 10);
      ctx.moveTo(0, floorY + 30); ctx.lineTo(CANVAS_WIDTH, floorY + 30);
      ctx.stroke();
      ctx.restore();

      // 5. Draw Player (Walking Centered)
      const victoryPlayer = {
          ...playerRef.current,
          x: CANVAS_WIDTH / 2 - 20,
          y: CANVAS_HEIGHT - 100, // Positioned perfectly on the floor line
          vx: 2, // Fake velocity for walking anim
          isGrounded: true,
          facingRight: true,
          rageTimer: 0,
          missileTimer: 0,
          shieldActive: false,
          dead: false,
          invincibleTimer: 0,
          weaponHeat: 0
      };
      drawPlayerSprite(ctx, victoryPlayer);
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
      // 如果是胜利画面，使用专用渲染函数
      if (gameState === GameState.VICTORY) {
          drawVictoryScene(ctx);
          return;
      }

      const camX = cameraXRef.current;
      const shakeX = (Math.random() - 0.5) * shakeRef.current;
      const shakeY = (Math.random() - 0.5) * shakeRef.current;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground(ctx, camX);
      
      try {
          ctx.save();
          ctx.translate(-camX + shakeX, shakeY);

          platformsRef.current.forEach(p => {
              if (p.x + p.width < camX || p.x > camX + CANVAS_WIDTH) return;
              drawPlatform(ctx, p);
          });
          
          if (lockdownTriggeredRef.current && !lockdownClearedRef.current) {
              const { min, max } = lockdownBoundsRef.current;
              ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
              ctx.fillRect(min, 0, 20, CANVAS_HEIGHT);
              ctx.fillRect(max - 20, 0, 20, CANVAS_HEIGHT);
              ctx.strokeStyle = '#ff0000';
              ctx.lineWidth = 2;
              const offset = frameCountRef.current % 40;
              for (let y = -offset; y < CANVAS_HEIGHT; y += 40) {
                  ctx.beginPath(); ctx.moveTo(min + 10, y); ctx.lineTo(min + 10, y + 20); ctx.stroke();
                  ctx.beginPath(); ctx.moveTo(max - 10, y + 20); ctx.lineTo(max - 10, y + 40); ctx.stroke();
              }
          }

          itemsRef.current.forEach(i => {
              ctx.shadowBlur = 15; ctx.shadowColor = i.type === 'weapon' ? '#ff00ff' : '#ffff00';
              ctx.fillStyle = i.type === 'weapon' ? COLORS.neonRed : (i.type === 'health' ? COLORS.neonGreen : COLORS.neonYellow);
              const floatY = i.y + Math.sin(frameCountRef.current / 20) * 5;
              ctx.beginPath(); ctx.arc(i.x + 10, floatY + 10, 10, 0, Math.PI * 2); ctx.fill();
              
              let label = i.type === 'health' ? '+' : '$';
              if (i.type === 'weapon') {
                  if (i.weaponType === WeaponType.SPREAD) label = 'S';
                  else if (i.weaponType === WeaponType.LASER) label = 'L';
                  else if (i.weaponType === WeaponType.RAPID_FIRE) label = 'J';
                  else label = 'W';
              }

              ctx.fillStyle = '#000'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText(label, i.x+10, floatY+14);
          });

          enemiesRef.current.forEach(e => {
              if (e.x + e.width < camX || e.x > camX + CANVAS_WIDTH) return;
              drawEnemy(ctx, e);
          });

          if (!playerRef.current.dead) drawPlayerSprite(ctx, playerRef.current);

          projectilesRef.current.forEach(proj => {
              ctx.shadowBlur = 10; ctx.shadowColor = proj.color; ctx.fillStyle = proj.color;
              if (proj.type === ProjectileType.CANNON) {
                  ctx.beginPath(); ctx.arc(proj.x + proj.width/2, proj.y + proj.height/2, proj.width/2, 0, Math.PI*2); ctx.fill();
              } else if (proj.type === ProjectileType.MISSILE) {
                  ctx.save(); ctx.translate(proj.x, proj.y); const angle = Math.atan2(proj.vy, proj.vx); ctx.rotate(angle);
                  ctx.fillStyle = proj.color; ctx.fillRect(-5, -2, 10, 4); ctx.fillStyle = '#fff'; if (Math.random() > 0.5) ctx.fillRect(-8, -1, 3, 2); ctx.restore();
              } else if (playerRef.current.weaponLevel === WeaponType.LASER && proj.isPlayer && proj.type === ProjectileType.NORMAL) {
                  // 修复：激光的旋转绘制逻辑
                  ctx.save();
                  ctx.translate(proj.x, proj.y);
                  ctx.rotate(Math.atan2(proj.vy, proj.vx));
                  
                  ctx.fillStyle = proj.color;
                  // 这里的坐标是相对于旋转中心的
                  ctx.fillRect(0, -proj.height/2, proj.width, proj.height);
                  
                  ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff';
                  ctx.fillStyle = 'rgba(255,255,255,0.8)';
                  ctx.fillRect(0, -proj.height/2 + 2, proj.width, proj.height - 4);
                  ctx.shadowBlur = 0;
                  
                  ctx.restore();
              } else if (playerRef.current.weaponLevel === WeaponType.RAPID_FIRE && proj.isPlayer && proj.type === ProjectileType.NORMAL) {
                  ctx.fillStyle = COLORS.neonYellow;
                  ctx.beginPath(); ctx.arc(proj.x + proj.width/2, proj.y + proj.height/2, proj.width/2, 0, Math.PI*2); ctx.fill();
              } else {
                  ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
              }
          });

          particlesRef.current.forEach(part => {
              ctx.globalAlpha = part.life / 20; ctx.fillStyle = part.color; ctx.fillRect(part.x, part.y, part.size, part.size); ctx.globalAlpha = 1;
          });

          damageNumbersRef.current.forEach(d => {
              ctx.fillStyle = d.color;
              ctx.font = 'bold 16px monospace';
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 2;
              ctx.strokeText(d.value.toString(), d.x, d.y);
              ctx.fillText(d.value.toString(), d.x, d.y);
          });

          ctx.restore();
      } catch (e) {
          console.error("Rendering error:", e);
          ctx.restore(); // Emergency restore to fix stack
      }
  }, [gameState]); // **CRITICAL FIX**: Added gameState dependency

  // --- STABLE LOOP PATTERN ---
  const updateRef = useRef(update);
  const drawRef = useRef(draw);

  useEffect(() => {
    updateRef.current = update;
    drawRef.current = draw;
  }, [update, draw]);

  const loop = useCallback((time: number) => {
      // 强制互斥锁：如果已被标记为停止，直接退出，防止僵尸循环
      if (!isRunningRef.current) return;

      if (!lastTimeRef.current) lastTimeRef.current = time;
      
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // 慢动作时间缩放
      accumulatorRef.current += deltaTime * timeScaleRef.current;

      // 钳制时间步长，防止浏览器卡顿后为了追赶进度而瞬间执行过多帧（"瞬移"现象）
      if (accumulatorRef.current > 65) accumulatorRef.current = 65; 

      while (accumulatorRef.current >= FIXED_TIME_STEP) {
          updateRef.current(); 
          accumulatorRef.current -= FIXED_TIME_STEP;
      }
      
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) drawRef.current(ctx);
      }
      requestRef.current = requestAnimationFrame(loop);
  }, []); 

  useEffect(() => {
      isRunningRef.current = true; // 启动时标记为运行中
      requestRef.current = requestAnimationFrame(loop);
      
      return () => {
          isRunningRef.current = false; // 卸载时强制标记为停止
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [loop]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Debug Key: 6 => FORCE VICTORY
          if (e.key === '6') {
              setGameState(GameState.VICTORY);
              cameraXRef.current = 0; // Reset camera for clean loop
              audioService.stopMusic();
              audioService.startVictoryMusic();
              return;
          }

          // VICTORY 状态下不响应游戏操作按键
          if (gameState === GameState.VICTORY) return;
          if (gameState !== GameState.PLAYING) return;
          keysPressed.current[e.key] = true;
          if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') onPause();
          if (KEYS.JUMP.includes(e.key)) {
              const p = playerRef.current;
              if (p.isGrounded) {
                  p.vy = JUMP_FORCE;
                  p.jumpCount = 1;
                  audioService.playJump();
              } else if (p.jumpCount < 2) { 
                  p.vy = DOUBLE_JUMP_FORCE;
                  p.jumpCount = 2;
                  createParticles(p.x + p.width/2, p.y + p.height, 5, '#fff');
                  audioService.playJump();
              }
          }
          if (KEYS.SHOOT.includes(e.key) && !playerRef.current.dead) { 
             shootProjectile(playerRef.current, false);
          }
          if (KEYS.SKILL_W.some(k => k === e.key)) {
              if (!playerRef.current.shieldActive && playerRef.current.shieldCooldown <= 0) {
                  playerRef.current.shieldActive = true;
                  playerRef.current.shieldTimer = SKILL_DURATIONS.SHIELD;
                  playerRef.current.shieldCooldown = SKILL_COOLDOWNS.SHIELD;
                  audioService.playPowerUp();
                  showDamageNumber(playerRef.current.x, playerRef.current.y - 20, "SHIELD ON", '#00ffff');
              }
          }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
          keysPressed.current[e.key] = false;
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [gameState, onPause, setGameState]);

  useEffect(() => {
      if (gameState === GameState.PLAYING) {
          initLevel(stats.level);
      }
  }, [gameState, initLevel]);

  return (
    <div className="relative border-4 border-cyan-900 rounded-lg overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.2)]">
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block bg-black" />
    </div>
  );
};

export default Game;
