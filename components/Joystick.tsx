import React, { useRef, useState } from 'react';

interface Props {
    /** Called with a vector in [-1, 1]; y is negative when pushed up (forward). */
    onChange: (x: number, y: number) => void;
    radius?: number;
}

/** Virtual thumbstick driven by pointer events (touch, pen or mouse). */
export default function Joystick({ onChange, radius = 56 }: Props) {
    const baseRef = useRef<HTMLDivElement>(null);
    const pointerRef = useRef<number | null>(null);
    const [knob, setKnob] = useState({ x: 0, y: 0 });

    const update = (clientX: number, clientY: number) => {
        const base = baseRef.current;
        if (!base) return;
        const rect = base.getBoundingClientRect();
        let dx = clientX - (rect.left + rect.width / 2);
        let dy = clientY - (rect.top + rect.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > radius) {
            dx = (dx / len) * radius;
            dy = (dy / len) * radius;
        }
        setKnob({ x: dx, y: dy });
        onChange(dx / radius, dy / radius);
    };

    const release = () => {
        pointerRef.current = null;
        setKnob({ x: 0, y: 0 });
        onChange(0, 0);
    };

    return (
        <div
            ref={baseRef}
            data-testid="joystick"
            role="slider"
            aria-label="Move"
            aria-valuenow={0}
            className="relative rounded-full bg-white/15 border-2 border-white/70 touch-none select-none"
            style={{ width: radius * 2 + 24, height: radius * 2 + 24 }}
            onPointerDown={(e) => {
                if (pointerRef.current !== null) return;
                pointerRef.current = e.pointerId;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                update(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
                if (pointerRef.current === e.pointerId) update(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
                if (pointerRef.current === e.pointerId) release();
            }}
            onPointerCancel={(e) => {
                if (pointerRef.current === e.pointerId) release();
            }}
        >
            <div
                className="absolute rounded-full bg-white/70 border-2 border-white pointer-events-none"
                style={{
                    width: 48,
                    height: 48,
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
                }}
            />
        </div>
    );
}
