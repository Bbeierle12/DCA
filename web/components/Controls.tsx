
import React from 'react';
import { ThreeGame } from '../services/ThreeGame';
import Joystick from './Joystick';

interface Props {
    /** Read lazily so the controls work even if they rendered before the game existed. */
    getGame: () => ThreeGame | null;
    onInteract: () => void;
    onBuild: () => void;
    onZoom: (amount: number) => void;
    onAttack?: (type: 'punch' | 'kick' | 'weapon') => void;
    onDropWeapon?: () => void;
    /** Show attack and drop-weapon buttons (combat feature flag). */
    combat?: boolean;
}

export default function Controls({ getGame, onInteract, onBuild, onZoom, onAttack, onDropWeapon, combat = true }: Props) {
    const handleAttack = (type: 'punch' | 'kick' | 'weapon') => {
        if (onAttack) {
            onAttack(type);
        } else {
            getGame()?.handleAttack(type);
        }
    };

    const handleDrop = () => {
        if (onDropWeapon) {
            onDropWeapon();
        } else {
            getGame()?.handleDropWeapon();
        }
    };

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
            {/* Movement - Left Side */}
            <div className="pointer-events-auto">
                <Joystick onChange={(x, y) => getGame()?.setAnalogInput(x, y)} />
            </div>

            {/* Zoom Controls - Center */}
            <div className="flex flex-col gap-2 pointer-events-auto">
                <button onClick={() => onZoom(-2)} className="bg-white/20 border-2 border-white rounded-full w-12 h-12 text-white text-2xl flex items-center justify-center active:bg-white/40 hover:bg-white/30 shadow-lg">➕</button>
                <button onClick={() => onZoom(2)} className="bg-white/20 border-2 border-white rounded-full w-12 h-12 text-white text-2xl flex items-center justify-center active:bg-white/40 hover:bg-white/30 shadow-lg">➖</button>
            </div>

            {/* Attack Controls - Right Side Bottom */}
            <div className="flex flex-col gap-3 pointer-events-auto">
                {/* Attack Buttons Row */}
                {combat && <div className="flex gap-2" data-testid="attack-buttons">
                    <AttackBtn type="punch" symbol="👊" label="Punch" color="bg-red-600/70" />
                    <AttackBtn type="kick" symbol="🦶" label="Kick" color="bg-orange-600/70" />
                    <AttackBtn type="weapon" symbol="⚔️" label="Weapon" color="bg-purple-600/70" />
                </div>}

                {/* Drop Weapon Button */}
                {combat && <button
                    onClick={handleDrop}
                    className="bg-gray-600/70 border-2 border-gray-400 rounded-lg text-white px-4 py-2 text-lg active:bg-gray-500/70 select-none flex items-center justify-center gap-2"
                >
                    <span>🔽</span> Drop Weapon
                </button>}

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
