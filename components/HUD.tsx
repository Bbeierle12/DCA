import React from 'react';
import { GameState } from '../types';

export default function HUD({ state }: { state: GameState }) {
    return (
        <div className="absolute top-20 left-4 flex flex-col gap-2 pointer-events-none font-vt323 z-10">
            <div className="bg-black/70 text-white px-4 py-1 rounded-full border-2 border-white text-2xl flex items-center gap-2 w-max">
                <span>💰</span> <span>{state.money}</span>
            </div>
            <div className="bg-black/70 text-white px-4 py-1 rounded-full border-2 border-white text-2xl flex items-center gap-2 w-max">
                <span>⚡</span> <span>{state.energy}</span>
            </div>
            {state.zone === 'Home Lot' && (
                 <div className="bg-purple-900/70 text-yellow-300 px-4 py-1 rounded-full border-2 border-white text-2xl flex items-center gap-2 w-max">
                    <span>👣</span> <span>{state.level === 0 ? "Ground" : "2nd Floor"}</span>
                </div>
            )}
            <div className="bg-blue-900/70 text-white px-4 py-1 rounded-full border-2 border-white text-2xl flex items-center gap-2 w-max">
                <span>📍</span> <span>{state.zone}</span>
            </div>
        </div>
    );
}