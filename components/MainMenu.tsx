import React from 'react';

interface Props {
    onStart: () => void;
    isReady: boolean;
}

export default function MainMenu({ onStart, isReady }: Props) {
    return (
        <div className="absolute inset-0 bg-pink-200 flex items-center justify-center z-50">
            <div className="bg-white/90 p-10 border-4 border-gray-800 rounded-lg shadow-[10px_10px_0_rgba(0,0,0,0.2)] transform -rotate-1 max-w-lg w-full text-center font-vt323">
                <h1 className="text-6xl font-bold mb-6 text-gray-800 hand-font">DCA City 3D</h1>
                <ul className="text-3xl text-left list-disc pl-10 mb-8 space-y-2 text-gray-700">
                    <li>Build 2-Story Houses! 🏠🏠</li>
                    <li>Dogs, cats, and horses 🐴</li>
                    <li>Restaurants and Jobs 💰</li>
                    <li>Explore in 3D! 🌍</li>
                </ul>
                <button 
                    onClick={onStart} 
                    disabled={!isReady}
                    className={`text-4xl px-10 py-2 text-white border-none shadow-[5px_5px_0_#666] transition-transform hover:scale-105 active:scale-95 ${isReady ? 'bg-gray-800 hover:bg-black cursor-pointer' : 'bg-gray-400 cursor-wait'}`}
                >
                    {isReady ? "Start Game" : "Loading..."}
                </button>
            </div>
        </div>
    );
}