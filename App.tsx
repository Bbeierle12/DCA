
import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { LocalNet } from './services/net/LocalNet';
import { NetClient } from './services/net/NetClient';
import { ThreeGame } from './services/ThreeGame';
import { GameConfig, GamePhase, GameState, FloatingTextData } from './types';
import { COMBAT_CONFIG } from './constants';
import { createDebugApi, installDebugApi } from './services/debug/DebugApi';
import { isTypingTarget } from './services/game/Input';
import { GameStore } from './services/game/GameStore';
import { FEATURES } from './services/features';
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

const DEFAULT_SETTINGS = {
  showMobileControls: true,
  alwaysRun: false,
  invertYCamera: false,
  cameraSensitivity: 1.0,
  cameraRelativeMovement: true,
  renderDistance: 700,
  shadowQuality: 'medium' as const,
  showOtherPlayers: true,
  masterVolume: 100,
  musicVolume: 80,
  sfxVolume: 100,
  showDamageNumbers: true,
  showTooltips: true,
  freeCameraEnabled: false,
  freeCameraSpeed: 200,
};

const SETTINGS_STORAGE_KEY = 'dca-game-settings';

function loadSettings(): Partial<typeof DEFAULT_SETTINGS> {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return {};
}

function saveSettings(settings: typeof DEFAULT_SETTINGS) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

interface HoverInfo {
    label: string;
    type: string;
    x: number;
    y: number;
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('MENU');
  const storeRef = useRef<GameStore | null>(null);
  if (!storeRef.current) storeRef.current = new GameStore({ zone: '', health: COMBAT_CONFIG.MAX_HEALTH, maxHealth: COMBAT_CONFIG.MAX_HEALTH });
  const store = storeRef.current;
  const snap = useSyncExternalStore(store.subscribe, store.get);
  const netRef = useRef<NetClient | null>(null);
  if (!netRef.current) netRef.current = new LocalNet();
  const net = netRef.current;
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  
  // Game State - merge saved settings with defaults
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedSettings = loadSettings();
    return {
      money: 100, energy: 100, zone: '', level: 0,
      isBuilding: false, buildItem: 'wood',
      health: COMBAT_CONFIG.MAX_HEALTH,
      maxHealth: COMBAT_CONFIG.MAX_HEALTH,
      weapon: null,
      isDead: false,
      ...DEFAULT_SETTINGS,
      ...savedSettings,
    };
  });
  const [buildLevel, setBuildLevel] = useState(0);

  // Refs to avoid stale state in animation loop
  const gameStateRef = useRef(gameState);
  const buildLevelRef = useRef(buildLevel);

  // Keep refs synced
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { buildLevelRef.current = buildLevel; }, [buildLevel]);

  // Save settings to localStorage when they change
  useEffect(() => {
    const settingsToSave = {
      showMobileControls: gameState.showMobileControls,
      alwaysRun: gameState.alwaysRun,
      invertYCamera: gameState.invertYCamera,
      cameraSensitivity: gameState.cameraSensitivity,
      cameraRelativeMovement: gameState.cameraRelativeMovement,
      renderDistance: gameState.renderDistance,
      shadowQuality: gameState.shadowQuality,
      showOtherPlayers: gameState.showOtherPlayers,
      masterVolume: gameState.masterVolume,
      musicVolume: gameState.musicVolume,
      sfxVolume: gameState.sfxVolume,
      showDamageNumbers: gameState.showDamageNumbers,
      showTooltips: gameState.showTooltips,
      freeCameraEnabled: gameState.freeCameraEnabled,
      freeCameraSpeed: gameState.freeCameraSpeed,
    };
    saveSettings(settingsToSave);
  }, [
    gameState.showMobileControls, gameState.alwaysRun, gameState.invertYCamera,
    gameState.cameraSensitivity, gameState.cameraRelativeMovement, gameState.renderDistance,
    gameState.shadowQuality, gameState.showOtherPlayers, gameState.masterVolume,
    gameState.musicVolume, gameState.sfxVolume, gameState.showDamageNumbers, gameState.showTooltips,
    gameState.freeCameraEnabled, gameState.freeCameraSpeed,
  ]);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showPetStore, setShowPetStore] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingTextData[]>([]);
  const [uiHoverInfo, setUiHoverInfo] = useState<HoverInfo | null>(null);

  // Refs
  const gameRef = useRef<ThreeGame | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);


  const addFloatingText = (text: string, color: string = 'text-yellow-300') => {
      const id = Date.now();
      setFloatingTexts(prev => [...prev, { id, x: window.innerWidth/2, y: window.innerHeight/2, text, color }]);
      setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 1000);
  };

  // Create the game when entering PLAYING; it owns its render loop.
  useEffect(() => {
    if (phase === 'PLAYING' && containerRef.current) {
        const game = new ThreeGame({
            container: containerRef.current,
            net,
            config,
            store,
            getUi: () => ({
                money: gameStateRef.current.money,
                isBuilding: gameStateRef.current.isBuilding,
                buildItem: gameStateRef.current.buildItem,
                buildLevel: buildLevelRef.current,
                alwaysRun: gameStateRef.current.alwaysRun,
            }),
            events: {
                onInteract: (type: string, cost: number, msg: string) => {
                    if (type === 'pet') setShowPetStore(true);
                    else if (type === 'food' || type === 'build') {
                        setGameState(prev => ({ ...prev, money: prev.money - cost, energy: 100 }));
                        if (msg) addFloatingText(msg, 'text-yellow-300');
                    } else if (type === 'error') {
                        if (msg) addFloatingText(msg, 'text-red-500');
                    } else if (type === 'pickup' || type === 'drop') {
                        if (msg) addFloatingText(msg, 'text-green-400');
                    }
                },
                onDamageDealt: (amount: number, x: number, y: number) => {
                    if (!gameStateRef.current.showDamageNumbers) return;
                    const id = Date.now() + Math.random();
                    setFloatingTexts(prev => [...prev, { id, x, y, text: `-${amount}`, color: 'text-red-500' }]);
                    setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 1000);
                },
                onDeath: () => addFloatingText('YOU DIED!', 'text-red-600'),
                onRespawn: () => addFloatingText('Respawned!', 'text-green-400'),
            },
        });
        gameRef.current = game;
        const uninstallDebug = installDebugApi(createDebugApi(game, () => gameStateRef.current.money));
        game.start();

        return () => {
            uninstallDebug();
            game.cleanup();
            gameRef.current = null;
        };
    }
  }, [phase, net, store]);

  // Sync config changes to game
  useEffect(() => {
      if (gameRef.current && phase === 'PLAYING') {
          gameRef.current.updateConfig(config);
      }
  }, [config, phase]);

  // Sync settings to game instance when they change
  useEffect(() => {
      if (gameRef.current && phase === 'PLAYING') {
          gameRef.current.setInvertYCamera(gameState.invertYCamera);
          gameRef.current.setCameraSensitivity(gameState.cameraSensitivity);
          gameRef.current.setCameraRelativeMovement(gameState.cameraRelativeMovement);
          gameRef.current.setRenderDistance(gameState.renderDistance);
          gameRef.current.setShadowQuality(gameState.shadowQuality);
          gameRef.current.setShowOtherPlayers(gameState.showOtherPlayers);
          // Sync free camera state
          if (gameRef.current.freeCameraEnabled !== gameState.freeCameraEnabled) {
              gameRef.current.toggleFreeCamera();
          }
          gameRef.current.freeCameraSpeed = gameState.freeCameraSpeed;
      }
  }, [
      phase,
      gameState.invertYCamera,
      gameState.cameraSensitivity,
      gameState.cameraRelativeMovement,
      gameState.renderDistance,
      gameState.shadowQuality,
      gameState.showOtherPlayers,
      gameState.freeCameraEnabled,
      gameState.freeCameraSpeed,
  ]);

  const handleInteract = useCallback(() => {
      gameRef.current?.handleInteraction();
  }, []);

  // Keyboard Listeners for Interaction
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (phase !== 'PLAYING') return;
          if (e.repeat || isTypingTarget(e.target)) return;
          if (e.code === 'Space' || e.code === 'Enter') {
              handleInteract();
          }
          // B key to toggle build
          if (e.code === 'KeyB') {
              toggleBuild();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, handleInteract]); 

  const toggleBuild = () => {
      // Check current zone from ref to be safe, or state
      if (gameRef.current?.canBuildNearPlayer()) {
        setGameState(prev => {
            const newState = !prev.isBuilding;
            addFloatingText(newState ? "Build Mode ON" : "Build Mode OFF");
            return { ...prev, isBuilding: newState };
        });
      } else {
        addFloatingText("Find open land to build on!", 'text-red-500');
      }
  };

  const handlePetPurchase = (type: string, cost: number) => {
      if (gameState.money >= cost) {
          setGameState(prev => ({ ...prev, money: prev.money - cost }));
          setConfig(prev => ({ ...prev, pet: type === 'none' ? null : type }));
          setShowPetStore(false);
          addFloatingText(type === 'none' ? "Pet removed" : `Bought ${type}!`);
      } else {
          addFloatingText("Not enough money!", 'text-red-500');
      }
  };

  const activeHover = uiHoverInfo || snap.hover;
  const hudState: GameState = { ...gameState, zone: snap.zone, level: snap.level, health: snap.health, maxHealth: snap.maxHealth, weapon: snap.weapon, isDead: snap.isDead };

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
                isReady={true} 
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

                <div data-testid="net-badge" className={`absolute top-4 right-4 z-10 font-vt323 text-xl shadow-black drop-shadow-md ${net.mode === 'online' ? 'text-green-400' : 'text-gray-200'}`}>
                    {net.mode === 'online' ? 'Online' : 'Solo'}
                </div>

                <HUD state={hudState} combat={FEATURES.combat} />

                {/* Hover Toast */}
                {gameState.isBuilding && activeHover && gameState.showTooltips && (
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
                        getGame={() => gameRef.current} 
                        combat={FEATURES.combat}
                        onInteract={handleInteract} 
                        onBuild={toggleBuild} 
                        onZoom={(delta) => gameRef.current?.adjustZoom(delta)}
                    />
                )}

                {floatingTexts.map(ft => (
                    <div key={ft.id} className={`absolute ${ft.color || 'text-yellow-300'} text-2xl font-bold pointer-events-none floating-text shadow-black drop-shadow-md`} style={{ left: ft.x, top: ft.y }}>
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
                        gameRef.current.resetToSpawn();
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
