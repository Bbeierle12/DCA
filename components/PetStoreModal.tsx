import React from 'react';
import { PET_COSTS } from '../constants';

interface Props {
    onClose: () => void;
    onBuy: (type: string, cost: number) => void;
}

export default function PetStoreModal({ onClose, onBuy }: Props) {
    const PetRow = ({ type, icon, label }: { type: string, icon: string, label: string }) => {
        const cost = PET_COSTS[type];
        return (
            <button 
                onClick={() => onBuy(type, cost)}
                className={`flex justify-between items-center w-full p-4 rounded-lg mb-3 transition-colors border border-gray-600 ${type === 'none' ? 'bg-red-900/50 hover:bg-red-800/50' : 'bg-gray-900/50 hover:bg-gray-700/50'}`}
            >
                <div className="flex items-center gap-4">
                    <span className="text-4xl">{icon}</span>
                    <span className="text-2xl text-white">{label}</span>
                </div>
                <span className="text-yellow-400 text-2xl font-bold">{cost}💰</span>
            </button>
        );
    };

    return (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 font-vt323">
            <div className="bg-gray-800 border-4 border-white rounded-lg w-[90%] max-w-md shadow-2xl flex flex-col">
                <div className="flex justify-between items-center p-4 bg-gray-700 text-white">
                    <span className="text-2xl font-bold">PET STORE</span>
                    <button onClick={onClose} className="text-red-400 text-2xl hover:text-red-300">✖</button>
                </div>
                <div className="p-6">
                    <PetRow type="dog" icon="🐶" label="Dog" />
                    <PetRow type="cat" icon="🐱" label="Cat" />
                    <PetRow type="horse" icon="🐴" label="Horse" />
                    <div className="border-t border-gray-600 my-4"></div>
                    <PetRow type="none" icon="❌" label="No Pet" />
                </div>
            </div>
        </div>
    );
}