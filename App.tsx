

import React, { useState, useEffect, useCallback } from 'react';
import Game from './components/Game';
import { GameState } from './types';
import { audioService } from './services/audioService';
import { SKILL_COOLDOWNS, SHOP_PRICES } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState({ score: 0, lives: 3, level: 1, coins: 0 });
  const [hp, setHp] = useState(5);
  const [skillCooldowns, setSkillCooldowns] = useState([0, 0, 0, 0]); 
  
  const [upgrades, setUpgrades] = useState({ speed: 0, dmg: 0, fire: 0 });

  const startGame = useCallback((level = 1) => {
    audioService.initialize();
    audioService.startMusic();
    setStats(prev => ({ ...prev, level, lives: 3, score: level === 1 ? 0 : prev.score, coins: level === 1 ? 0 : prev.coins }));
    setUpgrades({ speed: 0, dmg: 0, fire: 0 }); 
    setHp(5);
    setGameState(GameState.PLAYING);
  }, []);

  const nextLevel = useCallback(() => {
      setStats(prev => ({ ...prev, level: prev.level + 1 }));
      setGameState(GameState.PLAYING);
  }, []);

  const togglePause = useCallback(() => {
      setGameState(prev => {
        if (prev === GameState.PLAYING) return GameState.PAUSED;
        if (prev === GameState.PAUSED) return GameState.PLAYING;
        return prev;
      });
  }, []);

  const goHome = useCallback(() => {
      setGameState(GameState.MENU);
      audioService.stopMusic();
  }, []);
  
  const buyUpgrade = (type: 'speed' | 'dmg' | 'fire' | 'heal') => {
      if (type === 'heal') {
          if (stats.coins >= SHOP_PRICES.HEAL && hp < 5) {
              setStats(prev => ({ ...prev, coins: prev.coins - SHOP_PRICES.HEAL }));
              setHp(Math.min(5, hp + 2));
              audioService.playPowerUp();
          }
          return;
      }

      const price = type === 'speed' ? SHOP_PRICES.SPEED : (type === 'dmg' ? SHOP_PRICES.DAMAGE : SHOP_PRICES.FIRE_RATE);
      if (stats.coins >= price) {
          setStats(prev => ({ ...prev, coins: prev.coins - price }));
          setUpgrades(prev => ({ ...prev, [type]: prev[type] + 1 }));
          audioService.playPowerUp();
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-mono text-white select-none">
      <div className="relative group">
        <div className="absolute inset-0 z-50 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] mix-blend-overlay rounded-lg"></div>
        
        <Game 
            gameState={gameState} 
            setGameState={setGameState}
            stats={stats}
            setStats={setStats}
            setHp={setHp}
            setSkillCooldowns={setSkillCooldowns}
            onPause={togglePause}
            upgrades={upgrades}
        />

        {gameState === GameState.PLAYING && (
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between pointer-events-none z-40">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-gray-700">
                    <span className="text-neonRed font-bold text-xl" style={{textShadow: '0 0 5px #f00'}}>HP</span>
                    <div className="w-40 h-6 bg-gray-900 border border-gray-600 flex">
                        {Array.from({length: 5}).map((_, i) => (
                             <div key={i} className={`flex-1 m-0.5 transition-all duration-300 ${i < hp ? 'bg-neonRed shadow-[0_0_8px_#ff073a]' : 'bg-transparent'}`}></div>
                        ))}
                    </div>
                </div>
                <div className="text-neonBlue font-bold text-lg tracking-widest drop-shadow-md">
                    生命: {Array.from({length: stats.lives}).map((_, i) => '♥').join(' ')}
                </div>
            </div>

            <div className="flex gap-4 items-end bg-black/40 p-2 rounded-xl border border-gray-700 backdrop-blur-sm">
                <SkillIcon label="Q: 毁灭巨炮" cd={skillCooldowns[0]} max={SKILL_COOLDOWNS.CANNON} color="text-orange-400" />
                <SkillIcon label="W: 能量护盾" cd={skillCooldowns[1]} max={SKILL_COOLDOWNS.SHIELD} color="text-blue-400" />
                <SkillIcon label="E: 智能导弹" cd={skillCooldowns[2]} max={SKILL_COOLDOWNS.MISSILE} color="text-purple-400" />
                <SkillIcon label="R: 暴走模式" cd={skillCooldowns[3]} max={SKILL_COOLDOWNS.RAGE} color="text-red-600" />
            </div>

            <div className="text-right flex flex-col items-end gap-2">
                 <button 
                    onClick={togglePause}
                    className="pointer-events-auto px-4 py-1 bg-gray-800 border border-gray-600 hover:bg-gray-700 text-sm rounded font-bold"
                 >
                    ⏸ 暂停
                 </button>
                 <div className="bg-black/40 p-2 rounded border border-gray-700">
                    <div className="text-neonGreen font-bold text-2xl shadow-black drop-shadow-md font-[Courier]">{stats.score.toString().padStart(6, '0')}</div>
                    <div className="text-yellow-400 font-bold text-lg">${stats.coins}</div>
                    <div className="text-gray-400 text-sm">关卡 {stats.level}</div>
                 </div>
            </div>
          </div>
        )}

        {gameState === GameState.PAUSED && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm z-50">
                <h2 className="text-5xl font-bold text-white mb-8 tracking-widest">暂停中</h2>
                <div className="flex flex-col gap-4">
                    <button 
                        onClick={togglePause}
                        className="px-8 py-3 bg-neonBlue/20 border border-neonBlue text-neonBlue hover:bg-neonBlue hover:text-black font-bold text-xl rounded transition-all"
                    >
                        继续游戏
                    </button>
                    <button 
                        onClick={goHome}
                        className="px-8 py-3 bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black font-bold text-xl rounded transition-all"
                    >
                        返回主页
                    </button>
                </div>
            </div>
        )}

        {gameState === GameState.SHOP && (
           <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center backdrop-blur-sm z-50">
              <h2 className="text-5xl font-bold text-yellow-400 mb-4 drop-shadow-[0_0_10px_#ff0]">黑市商人</h2>
              <p className="text-xl text-gray-300 mb-8">花费金币升级你的装备</p>
              
              <div className="bg-black/60 p-8 rounded-xl border border-yellow-600 flex gap-8 mb-8">
                  <ShopItem title="移动速度" cost={SHOP_PRICES.SPEED} lvl={upgrades.speed} icon="⚡" onClick={() => buyUpgrade('speed')} canAfford={stats.coins >= SHOP_PRICES.SPEED} />
                  <ShopItem title="武器伤害" cost={SHOP_PRICES.DAMAGE} lvl={upgrades.dmg} icon="💥" onClick={() => buyUpgrade('dmg')} canAfford={stats.coins >= SHOP_PRICES.DAMAGE} />
                  <ShopItem title="射击冷却" cost={SHOP_PRICES.FIRE_RATE} lvl={upgrades.fire} icon="🔫" onClick={() => buyUpgrade('fire')} canAfford={stats.coins >= SHOP_PRICES.FIRE_RATE} />
                  <ShopItem title="紧急治疗" cost={SHOP_PRICES.HEAL} lvl={0} icon="💊" onClick={() => buyUpgrade('heal')} canAfford={stats.coins >= SHOP_PRICES.HEAL} />
              </div>
              
              <div className="text-3xl text-yellow-300 font-bold mb-8">当前金币: ${stats.coins}</div>

              <button 
                    onClick={nextLevel}
                    className="px-8 py-3 bg-neonGreen text-black font-bold hover:scale-110 transition-transform text-xl shadow-[0_0_20px_#39ff14]"
                >
                    进入下一区域
                </button>
           </div>
        )}

        {gameState === GameState.MENU && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm z-50">
            <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neonPink to-neonBlue animate-pulse mb-8 drop-shadow-[0_0_20px_rgba(0,255,255,0.5)] italic">
              霓虹跑酷：赛博行动
            </h1>
            <div className="flex gap-4">
                <button 
                    onClick={() => startGame(1)}
                    className="px-10 py-4 bg-neonBlue/10 border-2 border-neonBlue text-neonBlue hover:bg-neonBlue hover:text-black transition-all font-bold text-2xl tracking-wider clip-path-slant hover:shadow-[0_0_20px_#00ffff]"
                >
                    开始任务
                </button>
            </div>
            <div className="mt-12 p-6 border border-gray-800 bg-gray-900/80 rounded text-gray-300 text-sm text-center shadow-2xl">
                <p className="text-neonYellow font-bold mb-2 text-lg">操作指南</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-left">
                    <p>Shift : 幽灵冲刺 (无敌)</p>
                    <p>按 ↓ : 趴下 (躲避)</p>
                    <p>A : 射击 (可按 ↑/←/→ 瞄准)</p>
                    <p>Q : 毁灭巨炮</p>
                    <p>W : 能量护盾</p>
                    <p>E : 智能导弹</p>
                    <p>R : 暴走模式</p>
                </div>
            </div>
          </div>
        )}

        {gameState === GameState.GAME_OVER && (
           <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center backdrop-blur-sm z-50">
              <h2 className="text-6xl font-bold text-neonRed mb-4 drop-shadow-[0_0_10px_#f00]">系统崩溃</h2>
              <p className="text-3xl mb-8 text-white">最终得分: {stats.score}</p>
              <div className="flex gap-4">
                  <button 
                        onClick={() => startGame(1)}
                        className="px-8 py-3 border-2 border-white hover:bg-white hover:text-red-900 transition-all font-bold text-xl"
                    >
                        重启系统
                    </button>
                    <button 
                        onClick={goHome}
                        className="px-8 py-3 border-2 border-transparent hover:border-white transition-all font-bold text-xl"
                    >
                        返回主页
                    </button>
              </div>
           </div>
        )}
        
        {gameState === GameState.LEVEL_COMPLETE && (
            <div className="absolute inset-0 bg-green-900/90 flex flex-col items-center justify-center backdrop-blur-sm z-50">
                <h2 className="text-4xl font-bold text-white animate-bounce">区域肃清!</h2>
                <p className="text-gray-300">前往黑市...</p>
            </div>
        )}

      </div>
    </div>
  );
};

const SkillIcon = ({ label, cd, max, color, active }: { label: string, cd: number, max: number, color: string, active?: boolean }) => {
    const pct = Math.max(0, Math.min(1, cd / max));
    return (
        <div className={`flex flex-col items-center ${active ? 'scale-110 border-white' : ''} transition-all`}>
            <div className={`w-14 h-14 border-2 ${active ? 'border-white bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'border-gray-600 bg-black'} relative overflow-hidden mb-1 rounded`}>
                {cd > 0 && <div className="absolute inset-0 bg-black/80 origin-bottom transition-transform" style={{ transform: `scaleY(${pct})` }} />}
                <div className={`absolute inset-0 flex items-center justify-center font-bold text-sm ${color} ${cd > 0 ? 'opacity-50' : 'opacity-100'}`}>
                    {active ? '激活' : (cd > 0 ? Math.ceil(cd/60) : '就绪')}
                </div>
            </div>
            <span className="text-[10px] text-gray-300 font-bold whitespace-nowrap">{label.split(':')[0]}</span>
        </div>
    )
}

const ShopItem = ({ title, cost, lvl, icon, onClick, canAfford }: { title: string, cost: number, lvl: number, icon: string, onClick: () => void, canAfford: boolean }) => {
    return (
        <div className={`flex flex-col items-center p-4 border-2 ${canAfford ? 'border-yellow-500 bg-yellow-900/20 hover:bg-yellow-900/40 cursor-pointer' : 'border-gray-700 bg-gray-900 opacity-50'} rounded transition-all w-40`} onClick={onClick}>
            <div className="text-4xl mb-2">{icon}</div>
            <div className="text-yellow-200 font-bold mb-1">{title}</div>
            {lvl > 0 && <div className="text-xs text-green-400 mb-1">Lv. {lvl}</div>}
            <div className="text-white font-mono">${cost}</div>
        </div>
    )
}

export default App;