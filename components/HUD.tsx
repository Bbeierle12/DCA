import React from 'react';
import { GameState } from '../types';

export default function HUD({ state }: { state: GameState }) {
    const healthPercent = (state.health / state.maxHealth) * 100;
    const healthColor = healthPercent > 60 ? 'bg-green-500' :
                        healthPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="absolute top-20 left-4 flex flex-col gap-2 pointer-events-none font-vt323 z-10">
            {/* Health Bar */}
            <div className="bg-black/70 px-4 py-2 rounded-lg border-2 border-white w-48">
                <div className="flex items-center gap-2 text-white text-xl mb-1">
                    <span>❤️</span>
                    <span>{state.health} / {state.maxHealth}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4 border border-gray-500">
                    <div
                        className={`${healthColor} h-full rounded-full transition-all duration-200`}
                        style={{ width: `${healthPercent}%` }}
                    />
                </div>
            </div>

            {/* Weapon Indicator */}
            {state.weapon && (
                <div className="bg-orange-900/70 text-orange-300 px-4 py-1 rounded-full border-2 border-orange-400 text-2xl flex items-center gap-2 w-max">
                    <span>⚔️</span>
                    <span>{state.weapon.charAt(0).toUpperCase() + state.weapon.slice(1)}</span>
                    <span className="text-sm text-orange-200">(Q to drop)</span>
                </div>
            )}

            {/* Death Overlay */}
            {state.isDead && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 pointer-events-none">
                    <div className="text-center">
                        <div className="text-6xl text-red-500 font-bold mb-4">YOU DIED</div>
                        <div className="text-2xl text-white">Respawning...</div>
                    </div>
                </div>
            )}

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

            {/* Combat Controls Help */}
            <div className="bg-gray-900/70 text-gray-300 px-3 py-2 rounded-lg border border-gray-500 text-lg mt-2">
                <div className="text-white font-bold mb-1">Combat:</div>
                <div>J/Z - Punch</div>
                <div>K/X - Kick</div>
                <div>L/C - Weapon</div>
            </div>
        </div>
    );
}