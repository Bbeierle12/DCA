
import React from 'react';
import { ThreeGame } from '../services/ThreeGame';

interface Props {
    game: ThreeGame | null;
    onInteract: () => void;
    onBuild: () => void;
    onZoom: (amount: number) => void;
}

export default function Controls({ game, onInteract, onBuild, onZoom }: Props) {
    const handleStart = (key: string) => {
        if (game) game.setKey(key, true);
    };
    
    const handleEnd = (key: string) => {
        if (game) game.setKey(key, false);
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

    return (
        <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-end pointer-events-none font-vt323 z-20">
            <div className="flex flex-col gap-2 pointer-events-auto">
                <div className="flex justify-center"><ArrowBtn dir="ArrowUp" symbol="▲" /></div>
                <div className="flex gap-2">
                    <ArrowBtn dir="ArrowLeft" symbol="◀" />
                    <ArrowBtn dir="ArrowDown" symbol="▼" />
                    <ArrowBtn dir="ArrowRight" symbol="▶" />
                </div>
            </div>

            <div className="flex flex-col gap-2 pointer-events-auto">
                <button onClick={() => onZoom(-10)} className="bg-white/20 border-2 border-white rounded-full w-12 h-12 text-white text-2xl flex items-center justify-center active:bg-white/40 hover:bg-white/30 shadow-lg">➕</button>
                <button onClick={() => onZoom(10)} className="bg-white/20 border-2 border-white rounded-full w-12 h-12 text-white text-2xl flex items-center justify-center active:bg-white/40 hover:bg-white/30 shadow-lg">➖</button>
            </div>

            <div className="flex flex-col gap-4 pointer-events-auto">
                <button 
                    onClick={onBuild}
                    className="bg-white/20 border-2 border-white rounded-lg text-white px-6 py-4 text-2xl active:bg-white/40 select-none"
                >
                    🔨 Build
                </button>
                <button 
                    onClick={onInteract}
                    className="bg-white/20 border-2 border-white rounded-lg text-white px-6 py-4 text-2xl active:bg-white/40 select-none"
                >
                    ✋ Interact
                </button>
            </div>
        </div>
    );
}
