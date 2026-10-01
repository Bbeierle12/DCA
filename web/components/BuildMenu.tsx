import React from 'react';
import { COLORS } from '../constants';

interface Props {
    selected: string;
    onSelect: (item: string) => void;
    level: number;
    onLevelToggle: () => void;
    onHover: (info: { label: string, type: string, x: number, y: number } | null) => void;
}

const ITEMS = [
    { type: 'wood', icon: '🟫', color: '#8B4513', label: 'Wood Wall', category: 'Structure' },
    { type: 'stone', icon: '⬜', color: '#808080', label: 'Stone Wall', category: 'Structure' },
    { type: 'floor', icon: '🟨', color: '#D2B48C', label: 'Wood Floor', category: 'Floor' },
    { type: 'stairs', icon: '🪜', color: '#aa8866', label: 'Stairs', category: 'Structure' },
    { type: 'flower', icon: '🌹', color: 'lightgreen', label: 'Red Flower', category: 'Decor' },
    { type: 'table', icon: '┬─┬', color: '#A0522D', label: 'Wooden Table', category: 'Furniture' },
    { type: 'bed', icon: '🛏️', color: '#ADD8E6', label: 'Cozy Bed', category: 'Furniture' },
    { type: 'delete', icon: '❌', color: '#ffaaaa', label: 'Demolish', category: 'Tool' },
];

export default function BuildMenu({ selected, onSelect, level, onLevelToggle, onHover }: Props) {
    return (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-black/80 p-4 rounded-xl flex flex-col gap-2 w-[90%] max-w-md pointer-events-auto font-vt323 z-20 border border-gray-600">
            <div className="flex justify-between items-center text-white text-xl">
                <span>Build Mode</span>
                <button 
                    onClick={onLevelToggle}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded border border-white"
                >
                    Level: {level + 1}
                </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                {ITEMS.map(item => (
                    <button 
                        key={item.type}
                        onClick={() => onSelect(item.type)}
                        onMouseEnter={(e) => onHover({ label: item.label, type: item.category, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => onHover({ label: item.label, type: item.category, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => onHover(null)}
                        className={`w-12 h-12 flex items-center justify-center text-2xl border-2 rounded transition-all ${selected === item.type ? 'border-yellow-400 shadow-[0_0_10px_yellow]' : 'border-gray-500 opacity-80'}`}
                        style={{ backgroundColor: item.color }}
                    >
                        {item.icon}
                    </button>
                ))}
            </div>
        </div>
    );
}