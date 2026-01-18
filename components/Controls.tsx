
import React from 'react';
import { ThreeGame } from '../services/ThreeGame';

interface Props {
    game: ThreeGame | null;
    onInteract: () => void;
    onBuild: () => void;
    onZoom: (amount: number) => void;
    onAttack?: (type: 'punch' | 'kick' | 'weapon') => void;
    onDropWeapon?: () => void;
}

export default function Controls({ game, onInteract, onBuild, onZoom, onAttack, onDropWeapon }: Props) {
    const handleStart = (key: string) => {
        if (game) game.setKey(key, true);
    };

    const handleEnd = (key: string) => {
        if (game) game.setKey(key, false);
    };

    const handleAttack = (type: 'punch' | 'kick' | 'weapon') => {
        if (onAttack) {
            onAttack(type);
        } else if (game) {
            game.handleAttack(type);
        }
    };

    const handleDrop = () => {
        if (onDropWeapon) {
            onDropWeapon();
        } else if (game) {
            game.handleDropWeapon();
        }
    };

    const ArrowBtn = ({ dir, symbol }: { dir: string, symbol: string }) => (
        <button
            className="w-16 h-16 bg-white/20 border-2 border-white rounded-full text-white text-2xl flex items-center justify-center active:bg-white/40 select-none touch-none"
            onMouseDown={() => handleStart(dir)}
            onMouseUp={() => handleEnd(dir)}
            onMouseLeave={() => handleEnd(dir)}
            onTouchStart={(e) => { e.preventDefault(); handleStart(dir); }}
            onTouchEnd={(e) => { e.preventDefault(); handleEnd(dir); }}
        >
            {symbol}
        </button>
    );

    const AttackBtn = ({ type, symbol, label, color }: { type: 'punch' | 'kick' | 'weapon', symbol: string, label: string, color: string }) => (
        <button
            className={`w-16 h-16 ${color} border-2 border-white rounded-full text-white text-xl flex flex-col items-center justify-center active:brightness-150 select-none touch-none shadow-lg`}
            onMouseDown={(e) => { e.preventDefault(); handleAttack(type); }}
            onTouchStart={(e) => { e.preventDefault(); handleAttack(type); }}
        >
            <span className="text-2xl">{symbol}</span>
            <span className="text-xs">{label}</span>
        </button>
    );

    return (
        <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-end pointer-events-none font-vt323 z-20">
            {/* Movement Controls - Left Side */}
            <div className="flex flex-col gap-2 pointer-events-auto">
                <div className="flex justify-center"><ArrowBtn dir="ArrowUp" symbol="▲" /></div>
                <div className="flex gap-2">
                    <ArrowBtn dir="ArrowLeft" symbol="◀" />
                    <ArrowBtn dir="ArrowDown" symbol="▼" />
                    <ArrowBtn dir="ArrowRight" symbol="▶" />
                </div>
            </div>

            {/* Zoom Controls - Center */}
            <div className="flex flex-col gap-2 pointer-events-auto">
                <button onClick={() => onZoom(-10)} className="bg-white/20 border-2 border-white rounded-full w-12 h-12 text-white text-2xl flex items-center justify-center active:bg-white/40 hover:bg-white/30 shadow-lg">➕</button>
                <button onClick={() => onZoom(10)} className="bg-white/20 border-2 border-white rounded-full w-12 h-12 text-white text-2xl flex items-center justify-center active:bg-white/40 hover:bg-white/30 shadow-lg">➖</button>
            </div>

            {/* Attack Controls - Right Side Bottom */}
            <div className="flex flex-col gap-3 pointer-events-auto">
                {/* Attack Buttons Row */}
                <div className="flex gap-2">
                    <AttackBtn type="punch" symbol="👊" label="Punch" color="bg-red-600/70" />
                    <AttackBtn type="kick" symbol="🦶" label="Kick" color="bg-orange-600/70" />
                    <AttackBtn type="weapon" symbol="⚔️" label="Weapon" color="bg-purple-600/70" />
                </div>

                {/* Drop Weapon Button */}
                <button
                    onClick={handleDrop}
                    className="bg-gray-600/70 border-2 border-gray-400 rounded-lg text-white px-4 py-2 text-lg active:bg-gray-500/70 select-none flex items-center justify-center gap-2"
                >
                    <span>🔽</span> Drop Weapon
                </button>

                {/* Action Buttons Row */}
                <div className="flex gap-2">
                    <button
                        onClick={onBuild}
                        className="bg-white/20 border-2 border-white rounded-lg text-white px-4 py-3 text-xl active:bg-white/40 select-none flex-1"
                    >
                        🔨 Build
                    </button>
                    <button
                        onClick={onInteract}
                        className="bg-white/20 border-2 border-white rounded-lg text-white px-4 py-3 text-xl active:bg-white/40 select-none flex-1"
                    >
                        ✋ Interact
                    </button>
                </div>
            </div>
        </div>
    );
}
