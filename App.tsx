
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initAuth, updatePlayerInDb } from './services/firebase';
import { ThreeGame } from './services/ThreeGame';
import { GameConfig, GamePhase, GameState, FloatingTextData } from './types';
import MainMenu from './components/MainMenu';
import CharacterCreator from './components/CharacterCreator';
import HUD from './components/HUD';
import Controls from './components/Controls';
import BuildMenu from './components/BuildMenu';
import SettingsModal from './components/SettingsModal';
import PetStoreModal from './components/PetStoreModal';

const DEFAULT_CONFIG: GameConfig = {
  skin: '#ffccaa', hair: '#4a3021', eyes: '#000000', shirt: '#ff5555', pants: '#5555ff',
  name: 'Citizen', pet: null
};

interface HoverInfo {
    label: string;
    type: string;
    x: number;
    y: number;
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('MENU');
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    money: 100, energy: 100, zone: 'City Center', level: 0,
    isBuilding: false, buildItem: 'wood',
    showMobileControls: true, alwaysRun: false
  });
  const [buildLevel, setBuildLevel] = useState(0);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showPetStore, setShowPetStore] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingTextData[]>([]);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [uiHoverInfo, setUiHoverInfo] = useState<HoverInfo | null>(null);

  // Refs
  const gameRef = useRef<ThreeGame | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<number>(0);

  // Init Auth
  useEffect(() => {
    initAuth().then(uid => setUserId(uid));
  }, []);

  // Start Game Loop when Phase changes to PLAYING
  useEffect(() => {
    if (phase === 'PLAYING' && containerRef.current && userId) {
        const game = new ThreeGame(
            containerRef.current, 
            userId, 
            config,
            (zone: string, level: number) => {
                setGameState(prev => {
                    if (prev.zone !== zone || prev.level !== level) {
                         return { ...prev, zone, level };
                    }
                    return prev;
                });
            },
            (type: string, cost: number, msg: string) => {
                if (type === 'pet') setShowPetStore(true);
                else if (type === 'food' || type === 'build') {
                    setGameState(prev => ({ ...prev, money: prev.money - cost, energy: 100 }));
                    if(msg) addFloatingText(msg);
                } else if (type === 'error') {
                    if(msg) addFloatingText(msg);
                }
            },
            (info: HoverInfo | null) => {
                setHoverInfo(info);
            }
        );
        gameRef.current = game;

        const animate = () => {
            if (gameRef.current) {
                gameRef.current.update(
                    gameState.money, 
                    gameState.isBuilding, 
                    gameState.buildItem,
                    gameState.alwaysRun,
                    buildLevel
                );
            }
            loopRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            if(loopRef.current) cancelAnimationFrame(loopRef.current);
            gameRef.current?.cleanup();
            gameRef.current = null;
        };
    }
  }, [phase, userId]); // Re-init if user or phase really changes (should act like once)

  // Sync config changes to game
  useEffect(() => {
      if (gameRef.current && phase === 'PLAYING') {
          gameRef.current.updateConfig(config);
      }
  }, [config, phase]);

  const addFloatingText = (text: string) => {
      const id = Date.now();
      setFloatingTexts(prev => [...prev, { id, x: window.innerWidth/2, y: window.innerHeight/2, text }]);
      setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 1000);
  };

  const handleInteract = useCallback(() => {
      gameRef.current?.handleInteraction(gameState.money, gameState.buildItem, buildLevel, gameState.isBuilding);
  }, [gameState.money, gameState.buildItem, buildLevel, gameState.isBuilding]);

  // Keyboard Listeners for Interaction
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (phase !== 'PLAYING') return;
          if (e.key === ' ' || e.key === 'Enter') {
              handleInteract();
          }
          // B key to toggle build
          if (e.key.toLowerCase() === 'b') {
              toggleBuild();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, handleInteract, gameState.zone]); // dependencies matter here

  const toggleBuild = () => {
      // Use ref or latest state? We need a way to check current zone reliable.
      // Since this function is recreated on render, accessing gameState is fine.
      if (gameState.zone === 'Home Lot') {
        setGameState(prev => ({ ...prev, isBuilding: !prev.isBuilding }));
        addFloatingText(gameState.isBuilding ? "Build Mode OFF" : "Build Mode ON");
      } else {
        addFloatingText("Can't build here!");
      }
  };

  const handlePetPurchase = (type: string, cost: number) => {
      if (gameState.money >= cost) {
          setGameState(prev => ({ ...prev, money: prev.money - cost }));
          setConfig(prev => ({ ...prev, pet: type === 'none' ? null : type }));
          setShowPetStore(false);
          addFloatingText(type === 'none' ? "Pet removed" : `Bought ${type}!`);
      } else {
          addFloatingText("Not enough money!");
      }
  };

  const activeHover = uiHoverInfo || hoverInfo;

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
        
        {/* 3D Container */}
        {phase === 'PLAYING' && (
            <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        )}

        {/* Main Menu */}
        {phase === 'MENU' && (
            <MainMenu 
                onStart={() => setPhase('CREATOR')} 
                isReady={!!userId} 
            />
        )}

        {/* Character Creator */}
        {phase === 'CREATOR' && (
            <CharacterCreator 
                config={config} 
                setConfig={setConfig} 
                onFinish={() => setPhase('PLAYING')} 
            />
        )}

        {/* In-Game UI */}
        {phase === 'PLAYING' && (
            <>
                <div className="absolute top-4 left-4 z-10">
                     <button onClick={() => setShowSettings(true)} className="bg-black/50 text-white p-3 rounded-full border-2 border-white text-2xl hover:bg-black/70 transition">⚙️</button>
                </div>

                <div className="absolute top-4 right-4 z-10 text-green-400 font-vt323 text-xl shadow-black drop-shadow-md">
                    Online
                </div>

                <HUD state={gameState} />

                {/* Hover Toast */}
                {gameState.isBuilding && activeHover && (
                    <div 
                        className="fixed z-50 pointer-events-none bg-black/80 text-white p-3 rounded border border-white/50 shadow-lg transform -translate-y-full -translate-x-1/2 transition-all duration-75"
                        style={{ left: activeHover.x, top: activeHover.y - 20 }}
                    >
                        <div className="font-bold text-lg font-vt323 leading-none">{activeHover.label}</div>
                        <div className="text-sm text-gray-300 font-vt323">{activeHover.type}</div>
                    </div>
                )}

                {gameState.isBuilding && (
                    <BuildMenu 
                        selected={gameState.buildItem} 
                        onSelect={(item) => setGameState(p => ({ ...p, buildItem: item }))}
                        level={buildLevel}
                        onLevelToggle={() => setBuildLevel(prev => prev === 0 ? 1 : 0)}
                        onHover={setUiHoverInfo}
                    />
                )}

                {gameState.showMobileControls && (
                    <Controls 
                        game={gameRef.current} 
                        onInteract={handleInteract} 
                        onBuild={toggleBuild} 
                        onZoom={(delta) => gameRef.current?.adjustZoom(delta)}
                    />
                )}

                {floatingTexts.map(ft => (
                    <div key={ft.id} className="absolute text-yellow-300 text-2xl font-bold pointer-events-none floating-text" style={{ left: ft.x, top: ft.y }}>
                        {ft.text}
                    </div>
                ))}
            </>
        )}

        {/* Modals */}
        {showSettings && (
            <SettingsModal 
                onClose={() => setShowSettings(false)}
                config={config}
                setConfig={setConfig}
                gameState={gameState}
                setGameState={setGameState}
                onUnstuck={() => {
                    if(gameRef.current) {
                        gameRef.current.playerData.x = 200;
                        gameRef.current.playerData.y = 200;
                        gameRef.current.playerData.z = 0;
                        setShowSettings(false);
                    }
                }}
            />
        )}

        {showPetStore && (
            <PetStoreModal 
                onClose={() => setShowPetStore(false)} 
                onBuy={handlePetPurchase} 
            />
        )}
    </div>
  );
}
