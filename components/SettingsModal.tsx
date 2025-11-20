import React, { useState } from 'react';
import { GameConfig, GameState } from '../types';

interface Props {
    onClose: () => void;
    config: GameConfig;
    setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    onUnstuck: () => void;
}

export default function SettingsModal({ onClose, config, setConfig, gameState, setGameState, onUnstuck }: Props) {
    const [activeTab, setActiveTab] = useState<'controls' | 'profile' | 'audio'>('controls');

    const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-3 text-xl font-bold border-b-4 transition-colors ${activeTab === id ? 'border-blue-500 text-white bg-gray-700' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 font-vt323">
            <div className="bg-gray-800 border-4 border-white rounded-lg w-[90%] max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center p-4 bg-gray-700 text-white">
                    <span className="text-2xl font-bold">SETTINGS</span>
                    <button onClick={onClose} className="text-red-400 text-2xl hover:text-red-300">✖</button>
                </div>
                
                <div className="flex bg-gray-800 border-b border-gray-600">
                    <TabButton id="controls" label="Controls" />
                    <TabButton id="profile" label="Profile" />
                    <TabButton id="audio" label="Audio" />
                </div>

                <div className="p-6 overflow-y-auto text-white text-xl">
                    {activeTab === 'controls' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span>Mobile Controls</span>
                                <button 
                                    onClick={() => setGameState(p => ({...p, showMobileControls: !p.showMobileControls}))}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${gameState.showMobileControls ? 'bg-green-500' : 'bg-gray-500'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${gameState.showMobileControls ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Always Run</span>
                                <button 
                                    onClick={() => setGameState(p => ({...p, alwaysRun: !p.alwaysRun}))}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${gameState.alwaysRun ? 'bg-green-500' : 'bg-gray-500'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${gameState.alwaysRun ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            
                            <div className="border-t border-gray-600 pt-4 mt-4">
                                <p className="text-yellow-400 mb-2">Instructions</p>
                                <p className="text-gray-300 text-lg">WASD / Arrows to Move</p>
                                <p className="text-gray-300 text-lg">SPACE / ENTER to Interact</p>
                                <p className="text-gray-300 text-lg">B to Toggle Build Mode</p>
                                <p className="text-gray-300 text-lg">Right Click + Drag to Rotate</p>
                                <p className="text-gray-300 text-lg">Scroll to Zoom</p>
                            </div>

                            <button onClick={onUnstuck} className="w-full bg-red-600 hover:bg-red-500 py-2 rounded font-bold mt-4">⚠️ UNSTUCK</button>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span>Name</span>
                                <input 
                                    value={config.name} 
                                    onChange={e => setConfig(p => ({...p, name: e.target.value}))}
                                    className="bg-gray-900 border border-gray-500 px-2 py-1 text-white w-32" 
                                />
                            </div>
                             {['skin', 'hair', 'eyes', 'shirt', 'pants'].map(attr => (
                                <div key={attr} className="flex justify-between items-center">
                                    <span className="capitalize">{attr}</span>
                                    <input 
                                        type="color" 
                                        value={(config as any)[attr]} 
                                        onChange={e => setConfig(p => ({...p, [attr]: e.target.value}))}
                                        className="bg-transparent border-none h-8 w-10 cursor-pointer" 
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'audio' && (
                        <div className="text-center text-gray-400 italic mt-10">
                            Audio settings coming soon...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}