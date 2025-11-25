
import React, { useState, useEffect, useCallback } from 'react';
import Game from './components/Game';
import { GameState } from './types';
import { audioService } from './services/audioService';
import { SKILL_COOLDOWNS, SHOP_PRICES } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState({ score: 0, lives: 3, level: 1, coins: 0, time: 0 });
  const [hp, setHp] = useState(5);
  const [skillCooldowns, setSkillCooldowns] = useState([0, 0, 0, 0]); 
  
  const [upgrades, setUpgrades] = useState({ speed: 0, dmg: 0, fire: 0 });
  const [playerName, setPlayerName] = useState('');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showVictoryModal, setShowVictoryModal] = useState(true); // 控制通关时弹窗的显示
  const [leaderboardType, setLeaderboardType] = useState<'score' | 'time'>('score'); // 排行榜类型：score-积分榜，time-竞速榜

  // ESC 返回主页监听
  useEffect(() => {
      const handleEsc = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              if (gameState === GameState.VICTORY) {
                  goHome();
              }
          }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
  }, [gameState]);

  // 保存分数到服务器
  const saveScore = async (fromVictory = false) => {
    if (!playerName.trim()) return;
    
    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playerName,
          score: stats.score,
          level: stats.level,
          coins: stats.coins,
          time: stats.time,
          isCompleted: fromVictory && stats.level === 6, // 只有在胜利界面且达到第六关才标记为已通关
          date: new Date().toLocaleString() // 使用完整日期时间格式
        }),
      });
      
      if (response.ok) {
        if (fromVictory) {
            setShowVictoryModal(false); // 胜利界面提交后隐藏弹窗，保留画面
        } else {
            await loadLeaderboard();
            setGameState(GameState.LEADERBOARD);
        }
      } else {
        console.error('保存分数失败');
        if (!fromVictory) setGameState(GameState.GAME_OVER);
        else setShowVictoryModal(false);
      }
    } catch (error) {
      console.error('网络错误:', error);
      if (!fromVictory) setGameState(GameState.GAME_OVER);
      else setShowVictoryModal(false);
    }
  };

  // 加载排行榜数据
  const loadLeaderboard = async (page = 1, type?: 'score' | 'time') => {
    const currentType = type || leaderboardType;
    const limit = 5; // 每页5条记录
    try {
      const response = await fetch(`/api/scores?page=${page}&type=${currentType}&limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        // 使用后端返回的排行榜数据
        setLeaderboardData(data.scores || []);
        // 使用后端计算的分页信息
        setTotalPages(data.pagination?.totalPages || 1);
        setCurrentPage(page);
        setGameState(GameState.LEADERBOARD);
      } else {
        console.error('加载排行榜失败');
        // 如果加载失败，使用模拟数据
        setLeaderboardData(getMockLeaderboard(currentType));
        setTotalPages(1);
        setCurrentPage(1);
        setGameState(GameState.LEADERBOARD);
      }
    } catch (error) {
      console.error('网络错误:', error);
      // 网络错误时使用模拟数据
      setLeaderboardData(getMockLeaderboard(currentType));
      setTotalPages(1);
      setCurrentPage(1);
      setGameState(GameState.LEADERBOARD);
    }
  };

  // 模拟排行榜数据
  const getMockLeaderboard = (type: 'score' | 'time') => {
    if (type === 'time') {
      return [
        { id: 1, name: 'SpeedRunner', time: 120, isCompleted: 1, date: new Date(Date.now() - 1000 * 60 * 60 * 24).toLocaleString() },
        { id: 2, name: 'FlashGamer', time: 150, isCompleted: 1, date: new Date(Date.now() - 1000 * 60 * 60 * 48).toLocaleString() },
        { id: 3, name: 'QuickDraw', time: 180, isCompleted: 1, date: new Date(Date.now() - 1000 * 60 * 60 * 72).toLocaleString() },
        { id: 4, name: 'SwiftKnight', time: 210, isCompleted: 1, date: new Date(Date.now() - 1000 * 60 * 60 * 96).toLocaleString() },
        { id: 5, name: 'AgileWarrior', time: 240, isCompleted: 1, date: new Date(Date.now() - 1000 * 60 * 60 * 120).toLocaleString() },
      ];
    }
    return [
      { id: 1, name: 'CyberNinja', score: 15000, level: 10, coins: 500, date: new Date(Date.now() - 1000 * 60 * 60 * 24).toLocaleString() },
      { id: 2, name: 'NeonRunner', score: 12500, level: 8, coins: 420, date: new Date(Date.now() - 1000 * 60 * 60 * 48).toLocaleString() },
      { id: 3, name: 'NightStalker', score: 10000, level: 7, coins: 350, date: new Date(Date.now() - 1000 * 60 * 60 * 72).toLocaleString() },
      { id: 4, name: 'SynthRaider', score: 8500, level: 6, coins: 280, date: new Date(Date.now() - 1000 * 60 * 60 * 96).toLocaleString() },
      { id: 5, name: 'PixelHunter', score: 7000, level: 5, coins: 220, date: new Date(Date.now() - 1000 * 60 * 60 * 120).toLocaleString() },
    ];
  };

  const startGame = useCallback((level = 1) => {
    audioService.initialize();
    audioService.startMusic();
    setStats(prev => ({ ...prev, level, lives: 3, score: level === 1 ? 0 : prev.score, coins: level === 1 ? 0 : prev.coins }));
    setUpgrades({ speed: 0, dmg: 0, fire: 0 }); 
    setHp(5);
    setGameState(GameState.PLAYING);
    setShowVictoryModal(true); // 重置胜利弹窗显示
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

  const getRankIcon = (rank: number) => {
      if (rank === 1) return <span className="mr-1 text-yellow-400 text-lg">👑</span>;
      if (rank === 2) return <span className="mr-1 text-gray-300 text-lg">👑</span>;
      if (rank === 3) return <span className="mr-1 text-amber-600 text-lg">👑</span>;
      return null;
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
                    <div className="text-blue-400 font-bold text-sm">
                      时间: {Math.floor(stats.time / 60)}:{(stats.time % 60).toString().padStart(2, '0')}
                    </div>
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
                <button 
                    onClick={() => loadLeaderboard(1)}
                    className="px-10 py-4 bg-neonPink/10 border-2 border-neonPink text-neonPink hover:bg-neonPink hover:text-black transition-all font-bold text-2xl tracking-wider clip-path-slant hover:shadow-[0_0_20px_#ff00ff]"
                >
                    排行榜
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

        {/* 游戏结束时的分数提交界面 */}
        {gameState === GameState.SCORE_SUBMIT && (
           <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center backdrop-blur-sm z-50">
              <h2 className="text-5xl font-bold text-neonBlue mb-4 drop-shadow-[0_0_10px_#00ffff]">记录你的战绩</h2>
              <p className="text-3xl mb-8 text-white">最终得分: <span className="text-neonGreen">{stats.score}</span></p>
              
              <div className="bg-black/60 border border-neonBlue/50 rounded-lg p-8 w-96">
                <label className="block text-gray-300 mb-2 text-lg">输入你的名字:</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="输入你的名字..."
                  className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-neonBlue"
                  maxLength={20}
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && playerName.trim() && saveScore()}
                />
                
                <div className="flex gap-4 mt-8">
                  <button 
                    onClick={() => saveScore(false)}
                    disabled={!playerName.trim()}
                    className={`px-6 py-3 font-bold text-xl transition-all ${playerName.trim() ? 'bg-neonGreen text-black hover:bg-neonGreen/80' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                  >
                    保存分数
                  </button>
                  <button 
                    onClick={() => setGameState(GameState.GAME_OVER)}
                    className="px-6 py-3 border border-gray-600 text-gray-300 hover:bg-gray-800 font-bold text-xl"
                  >
                    跳过
                  </button>
                </div>
              </div>
           </div>
        )}

        {/* 通关界面 VICTORY */}
        {gameState === GameState.VICTORY && (
            <div className="absolute inset-0 pointer-events-none z-50 flex flex-col items-center pt-20">
                <h1 className="text-6xl font-black text-yellow-300 drop-shadow-[0_0_20px_#fbbf24] animate-pulse mb-4">恭喜通关</h1>
                <p className="text-2xl text-cyan-100 drop-shadow-md mb-8 font-light tracking-widest">无论前路多遥远，我都陪伴着你，加油勇士~</p>
                
                {showVictoryModal && (
                    <div className="pointer-events-auto bg-black/70 border border-yellow-500/50 rounded-lg p-8 w-96 backdrop-blur-md animate-fade-in">
                        <p className="text-center text-gray-300 mb-6">记录这传奇的一刻</p>
                        <p className="text-center text-3xl mb-6 text-neonGreen font-bold">{stats.score} 分</p>
                        
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          placeholder="输入你的名字..."
                          className="w-full p-3 bg-gray-900/80 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-6"
                          maxLength={20}
                        />
                        
                        <button 
                            onClick={() => saveScore(true)}
                            disabled={!playerName.trim()}
                            className={`w-full py-3 font-bold text-xl transition-all rounded ${playerName.trim() ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-gray-500'}`}
                        >
                            保存并欣赏风景
                        </button>
                        <p className="text-center text-gray-500 text-xs mt-4">按 ESC 返回主菜单</p>
                    </div>
                )}
            </div>
        )}

        {/* 排行榜界面 */}
        {gameState === GameState.LEADERBOARD && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center backdrop-blur-sm z-50 overflow-auto">
            <h2 className="text-5xl font-bold text-neonPink mb-8 drop-shadow-[0_0_15px_rgba(255,0,255,0.5)]">
            传奇排行榜
            </h2>
            
            {/* 排行榜切换按钮 */}
            <div className="flex gap-4 mb-6">
              <button 
                onClick={() => {
                  const type = 'score';
                  setLeaderboardType(type);
                  loadLeaderboard(1, type);
                }}
                className={`px-6 py-2 font-bold text-lg transition-all ${leaderboardType === 'score' ? 'bg-neonBlue text-black hover:bg-neonBlue/80' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
              >
                积分榜
              </button>
              <button 
                onClick={() => {
                  const type = 'time';
                  setLeaderboardType(type);
                  loadLeaderboard(1, type);
                }}
                className={`px-6 py-2 font-bold text-lg transition-all ${leaderboardType === 'time' ? 'bg-neonBlue text-black hover:bg-neonBlue/80' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
              >
                竞速榜
              </button>
            </div>
            
            {leaderboardData.length > 0 ? (
              <>
                <div className="bg-black/60 border border-gray-800 rounded-lg overflow-hidden w-[650px] mb-6">
                  {/* 积分榜表头 */}
                  {leaderboardType === 'score' && (
                    <div className="grid grid-cols-[80px_1fr_80px_60px_200px] bg-gray-900 p-2 text-gray-400 text-sm">
                      <div className="font-bold text-center">排名</div>
                      <div className="font-bold">玩家</div>
                      <div className="font-bold text-right pr-7">分数</div>
                      <div className="font-bold text-center">关卡</div>
                      <div className="font-bold text-right">日期</div>
                    </div>
                  )}
                  
                  {/* 竞速榜表头 */}
                  {leaderboardType === 'time' && (
                    <div className="grid grid-cols-[80px_1fr_120px_200px] bg-gray-900 p-2 text-gray-400 text-sm">
                      <div className="font-bold text-center">排名</div>
                      <div className="font-bold">玩家</div>
                      <div className="font-bold text-center">通关时间</div>
                      <div className="font-bold text-right">日期</div>
                    </div>
                  )}
                  
                  {leaderboardData.map((item, index) => {
                    const pageNum = Number(currentPage) || 1;
                    const rank = (pageNum - 1) * 5 + index + 1; // Modified for 5 items per page
                    const isTop3 = rank <= 3;
                    const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
                    
                    // 格式化时间（秒转分:秒）
                    const formatTime = (seconds: number) => {
                      const mins = Math.floor(seconds / 60);
                      const secs = seconds % 60;
                      return `${mins}:${secs.toString().padStart(2, '0')}`;
                    };
                    
                    return (
                      <>
                        {/* 积分榜行 */}
                        {leaderboardType === 'score' && (
                          <div key={item.id} className={`grid grid-cols-[80px_1fr_80px_60px_200px] p-2 border-t border-gray-800 ${isTop3 ? 'bg-gray-900/50' : 'bg-black/30'}`}>
                            <div className={`font-bold text-center flex items-center justify-center ${isTop3 ? rankColors[rank-1] : 'text-gray-400'}`}>
                              {getRankIcon(rank)}
                              {rank}
                            </div>
                            <div className="text-white font-bold truncate flex items-center">{item.name}</div>
                            <div className="text-neonGreen font-bold text-right pr-7 flex items-center justify-end">{item.score}</div>
                            <div className="text-neonBlue font-bold text-center flex items-center justify-center">{item.level}</div>
                            <div className="text-gray-400 font-bold text-right flex items-center justify-end">{item.date || new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                          </div>
                        )}
                        
                        {/* 竞速榜行 */}
                        {leaderboardType === 'time' && (
                          <div key={item.id} className={`grid grid-cols-[80px_1fr_120px_200px] p-2 border-t border-gray-800 ${isTop3 ? 'bg-gray-900/50' : 'bg-black/30'}`}>
                            <div className={`font-bold text-center flex items-center justify-center ${isTop3 ? rankColors[rank-1] : 'text-gray-400'}`}>
                              {getRankIcon(rank)}
                              {rank}
                            </div>
                            <div className="text-white font-bold truncate flex items-center">{item.name}</div>
                            <div className="text-neonGreen font-bold text-center flex items-center justify-center">{formatTime(item.time)}</div>
                            <div className="text-gray-400 font-bold text-right flex items-center justify-end">{item.date || new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                          </div>
                        )}
                      </>
                    );
                  })}
                </div>
                
                <div className="flex gap-2 mb-8">
                  <button 
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1);
                      setCurrentPage(newPage);
                      loadLeaderboard(newPage, leaderboardType);
                    }}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 ${currentPage === 1 ? 'bg-gray-800 text-gray-500' : 'bg-gray-800 hover:bg-gray-700 text-white'} rounded`}
                  >
                    上一页
                  </button>
                  <span className="text-white px-4 py-2">
                    第 {Number(currentPage)} / {Number(totalPages)} 页
                  </span>
                  <button 
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1);
                      setCurrentPage(newPage);
                      loadLeaderboard(newPage, leaderboardType);
                    }}
                    disabled={currentPage >= totalPages}
                    className={`px-4 py-2 ${currentPage >= totalPages ? 'bg-gray-800 text-gray-500' : 'bg-gray-800 hover:bg-gray-700 text-white'} rounded`}
                  >
                    下一页
                  </button>
                </div>
              </>
            ) : (
              <div className="text-gray-400 text-xl mb-8">暂无排行榜数据</div>
            )}
            
            <button 
              onClick={goHome}
              className="px-8 py-3 border-2 border-neonBlue text-neonBlue hover:bg-neonBlue hover:text-black font-bold text-xl rounded transition-all"
            >
              返回主页
            </button>
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
                {stats.level < 6 ? (
                  <>
                    <h2 className="text-4xl font-bold text-white animate-bounce">区域肃清!</h2>
                    <p className="text-gray-300">前往黑市...</p>
                  </>
                ) : (
                  // 最后一关完成时不显示任何文字，等待胜利画面
                  <div className="animate-pulse text-2xl text-yellow-300">最终胜利...</div>
                )}
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
