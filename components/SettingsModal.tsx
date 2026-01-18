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

// Reusable Toggle Component
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <div className="flex justify-between items-center">
            <span>{label}</span>
            <button
                onClick={() => onChange(!value)}
                className={`w-12 h-6 rounded-full relative transition-colors ${value ? 'bg-green-500' : 'bg-gray-500'}`}
            >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${value ? 'left-7' : 'left-1'}`} />
            </button>
        </div>
    );
}

// Reusable Slider Component
function Slider({
    value,
    onChange,
    label,
    min,
    max,
    step = 1,
    displayValue,
}: {
    value: number;
    onChange: (v: number) => void;
    label: string;
    min: number;
    max: number;
    step?: number;
    displayValue?: string;
}) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <span>{label}</span>
                <span className="text-gray-400">{displayValue ?? value}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
        </div>
    );
}

// Reusable Select Component
function Select<T extends string>({
    value,
    onChange,
    label,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    label: string;
    options: { value: T; label: string }[];
}) {
    return (
        <div className="flex justify-between items-center">
            <span>{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
                className="bg-gray-700 border border-gray-500 px-3 py-1 rounded text-white cursor-pointer"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

type TabId = 'controls' | 'graphics' | 'audio' | 'gameplay' | 'profile';

export default function SettingsModal({ onClose, config, setConfig, gameState, setGameState, onUnstuck }: Props) {
    const [activeTab, setActiveTab] = useState<TabId>('controls');

    const tabs: { id: TabId; label: string }[] = [
        { id: 'controls', label: 'Controls' },
        { id: 'graphics', label: 'Graphics' },
        { id: 'audio', label: 'Audio' },
        { id: 'gameplay', label: 'Gameplay' },
        { id: 'profile', label: 'Profile' },
    ];

    const TabButton = ({ id, label }: { id: TabId; label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-base font-bold border-b-4 transition-colors ${
                activeTab === id
                    ? 'border-blue-500 text-white bg-gray-700'
                    : 'border-transparent text-gray-400 hover:text-white'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 font-vt323">
            <div className="bg-gray-800 border-4 border-white rounded-lg w-[90%] max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center p-4 bg-gray-700 text-white">
                    <span className="text-2xl font-bold">SETTINGS</span>
                    <button onClick={onClose} className="text-red-400 text-2xl hover:text-red-300">
                        ✖
                    </button>
                </div>

                <div className="flex bg-gray-800 border-b border-gray-600 overflow-x-auto">
                    {tabs.map((tab) => (
                        <TabButton key={tab.id} id={tab.id} label={tab.label} />
                    ))}
                </div>

                <div className="p-6 overflow-y-auto text-white text-lg flex-1">
                    {/* CONTROLS TAB */}
                    {activeTab === 'controls' && (
                        <div className="space-y-4">
                            <Toggle
                                label="Mobile Controls"
                                value={gameState.showMobileControls}
                                onChange={(v) => setGameState((p) => ({ ...p, showMobileControls: v }))}
                            />
                            <Toggle
                                label="Always Run"
                                value={gameState.alwaysRun}
                                onChange={(v) => setGameState((p) => ({ ...p, alwaysRun: v }))}
                            />
                            <Toggle
                                label="Invert Y Camera"
                                value={gameState.invertYCamera}
                                onChange={(v) => setGameState((p) => ({ ...p, invertYCamera: v }))}
                            />
                            <Toggle
                                label="Camera-Relative Movement"
                                value={gameState.cameraRelativeMovement}
                                onChange={(v) => setGameState((p) => ({ ...p, cameraRelativeMovement: v }))}
                            />
                            <Slider
                                label="Camera Sensitivity"
                                value={gameState.cameraSensitivity}
                                onChange={(v) => setGameState((p) => ({ ...p, cameraSensitivity: v }))}
                                min={0.1}
                                max={2.0}
                                step={0.1}
                                displayValue={gameState.cameraSensitivity.toFixed(1)}
                            />

                            <div className="border-t border-gray-600 pt-4 mt-4">
                                <p className="text-yellow-400 mb-2">Keyboard Controls</p>
                                <p className="text-gray-300 text-base">WASD / Arrows - Move</p>
                                <p className="text-gray-300 text-base">SPACE / ENTER - Interact</p>
                                <p className="text-gray-300 text-base">B - Toggle Build Mode</p>
                                <p className="text-gray-300 text-base">J/Z - Punch, K/X - Kick, L/C - Weapon</p>
                                <p className="text-gray-300 text-base">Q - Drop Weapon</p>
                                <p className="text-gray-300 text-base">Right Click + Drag - Rotate Camera</p>
                                <p className="text-gray-300 text-base">Scroll - Zoom</p>
                            </div>

                            <button onClick={onUnstuck} className="w-full bg-red-600 hover:bg-red-500 py-2 rounded font-bold mt-4">
                                UNSTUCK
                            </button>
                        </div>
                    )}

                    {/* GRAPHICS TAB */}
                    {activeTab === 'graphics' && (
                        <div className="space-y-4">
                            <Slider
                                label="Render Distance"
                                value={gameState.renderDistance}
                                onChange={(v) => setGameState((p) => ({ ...p, renderDistance: v }))}
                                min={300}
                                max={1000}
                                step={50}
                            />
                            <Select
                                label="Shadow Quality"
                                value={gameState.shadowQuality}
                                onChange={(v) => setGameState((p) => ({ ...p, shadowQuality: v }))}
                                options={[
                                    { value: 'low', label: 'Low' },
                                    { value: 'medium', label: 'Medium' },
                                    { value: 'high', label: 'High' },
                                ]}
                            />
                            <Toggle
                                label="Show Other Players"
                                value={gameState.showOtherPlayers}
                                onChange={(v) => setGameState((p) => ({ ...p, showOtherPlayers: v }))}
                            />

                            <div className="border-t border-gray-600 pt-4 mt-4 text-gray-400 text-base">
                                <p>Lower render distance and shadow quality can improve performance on slower devices.</p>
                            </div>
                        </div>
                    )}

                    {/* AUDIO TAB */}
                    {activeTab === 'audio' && (
                        <div className="space-y-4">
                            <Slider
                                label="Master Volume"
                                value={gameState.masterVolume}
                                onChange={(v) => setGameState((p) => ({ ...p, masterVolume: v }))}
                                min={0}
                                max={100}
                                displayValue={`${gameState.masterVolume}%`}
                            />
                            <Slider
                                label="Music Volume"
                                value={gameState.musicVolume}
                                onChange={(v) => setGameState((p) => ({ ...p, musicVolume: v }))}
                                min={0}
                                max={100}
                                displayValue={`${gameState.musicVolume}%`}
                            />
                            <Slider
                                label="SFX Volume"
                                value={gameState.sfxVolume}
                                onChange={(v) => setGameState((p) => ({ ...p, sfxVolume: v }))}
                                min={0}
                                max={100}
                                displayValue={`${gameState.sfxVolume}%`}
                            />

                            <div className="border-t border-gray-600 pt-4 mt-4 text-gray-400 text-base italic">
                                <p>Audio system coming soon. These settings are saved for future use.</p>
                            </div>
                        </div>
                    )}

                    {/* GAMEPLAY TAB */}
                    {activeTab === 'gameplay' && (
                        <div className="space-y-4">
                            <Toggle
                                label="Show Damage Numbers"
                                value={gameState.showDamageNumbers}
                                onChange={(v) => setGameState((p) => ({ ...p, showDamageNumbers: v }))}
                            />
                            <Toggle
                                label="Show Tooltips"
                                value={gameState.showTooltips}
                                onChange={(v) => setGameState((p) => ({ ...p, showTooltips: v }))}
                            />

                            <div className="border-t border-gray-600 pt-4 mt-4 text-gray-400 text-base">
                                <p>Damage numbers appear when hitting other players in combat.</p>
                                <p className="mt-2">Tooltips show information when hovering over objects in build mode.</p>
                            </div>
                        </div>
                    )}

                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span>Name</span>
                                <input
                                    value={config.name}
                                    onChange={(e) => setConfig((p) => ({ ...p, name: e.target.value }))}
                                    className="bg-gray-900 border border-gray-500 px-3 py-1 text-white w-36 rounded"
                                    maxLength={16}
                                />
                            </div>
                            {(['skin', 'hair', 'eyes', 'shirt', 'pants'] as const).map((attr) => (
                                <div key={attr} className="flex justify-between items-center">
                                    <span className="capitalize">{attr}</span>
                                    <input
                                        type="color"
                                        value={config[attr]}
                                        onChange={(e) => setConfig((p) => ({ ...p, [attr]: e.target.value }))}
                                        className="bg-transparent border-none h-8 w-12 cursor-pointer rounded"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
