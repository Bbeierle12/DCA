import React from 'react';
import { GameConfig } from '../types';

interface Props {
    config: GameConfig;
    setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
    onFinish: () => void;
}

const ColorRow = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
    <div className="flex justify-between items-center my-2 text-2xl">
        <span>{label}</span>
        <input 
            type="color" 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            className="w-12 h-10 border-none bg-transparent cursor-pointer"
        />
    </div>
);

export default function CharacterCreator({ config, setConfig, onFinish }: Props) {
    const update = (key: keyof GameConfig, val: string) => setConfig(prev => ({ ...prev, [key]: val }));

    return (
        <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-40 font-vt323 text-gray-800">
            <div className="bg-white p-8 border-4 border-gray-800 rounded-lg shadow-2xl w-full max-w-md">
                <h2 className="text-4xl font-bold mb-6 text-center">Create Citizen</h2>
                
                <div className="mb-4">
                    <label className="block text-2xl mb-1">Name</label>
                    <input 
                        type="text" 
                        maxLength={10}
                        value={config.name}
                        onChange={(e) => update('name', e.target.value)}
                        className="w-full bg-gray-200 border-2 border-gray-400 p-2 text-2xl font-vt323 focus:border-blue-500 outline-none"
                    />
                </div>

                <ColorRow label="Skin" value={config.skin} onChange={(v) => update('skin', v)} />
                <ColorRow label="Hair" value={config.hair} onChange={(v) => update('hair', v)} />
                <ColorRow label="Eyes" value={config.eyes} onChange={(v) => update('eyes', v)} />
                <ColorRow label="Shirt" value={config.shirt} onChange={(v) => update('shirt', v)} />
                <ColorRow label="Pants" value={config.pants} onChange={(v) => update('pants', v)} />

                <button 
                    onClick={onFinish}
                    className="w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded text-3xl border-b-4 border-green-700 active:border-b-0 active:mt-7 active:mb-[-4px] transition-all"
                >
                    ENTER 3D CITY
                </button>
            </div>
        </div>
    );
}