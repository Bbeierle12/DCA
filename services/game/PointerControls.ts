/**
 * Mouse, wheel and touch on the canvas. Right-drag (or any drag in free-fly) and one-finger
 * touch drag orbit the camera; left click acts; the wheel zooms. Document-level mousemove and
 * mouseup keep drags working when the pointer leaves the canvas.
 */
export interface PointerHandlers {
    isFreeFly(): boolean;
    orbit(dx: number, dy: number, perPixel: number): void;
    freeLook(dx: number, dy: number, perPixel: number): void;
    wheel(deltaY: number): void;
    primaryClick(): void;
    /** Pointer position in normalised device coords (-1..1) and CSS pixels. */
    aim(ndcX: number, ndcY: number, clientX: number, clientY: number): void;
}

export class PointerControls {
    private drag: { button: number } | null = null;
    private touch: { id: number; x: number; y: number } | null = null;

    constructor(private canvas: HTMLCanvasElement, private h: PointerHandlers) {
        canvas.style.touchAction = 'none';
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('wheel', this.onWheel, { passive: true });
        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerUp);
        canvas.addEventListener('pointercancel', this.onPointerUp);
        canvas.addEventListener('contextmenu', this.onContextMenu);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    private onContextMenu = (e: Event) => e.preventDefault();

    private onMouseMove = (e: MouseEvent) => {
        this.h.aim((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1, e.clientX, e.clientY);
        if (!this.drag) return;
        if (this.h.isFreeFly()) this.h.freeLook(e.movementX, e.movementY, 0.005);
        else if (this.drag.button === 2) this.h.orbit(e.movementX, e.movementY, 0.005);
    };

    private onMouseDown = (e: MouseEvent) => {
        if (this.h.isFreeFly() || e.button === 2) {
            this.drag = { button: e.button };
        } else if (e.button === 0) {
            this.h.primaryClick();
        }
    };

    private onMouseUp = () => {
        this.drag = null;
    };

    private onWheel = (e: WheelEvent) => this.h.wheel(e.deltaY);

    private onPointerDown = (e: PointerEvent) => {
        if (e.pointerType !== 'touch' || this.touch) return;
        this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };

    private onPointerMove = (e: PointerEvent) => {
        if (!this.touch || e.pointerId !== this.touch.id) return;
        const dx = e.clientX - this.touch.x;
        const dy = e.clientY - this.touch.y;
        this.touch.x = e.clientX;
        this.touch.y = e.clientY;
        if (this.h.isFreeFly()) this.h.freeLook(dx, dy, 0.008);
        else this.h.orbit(dx, dy, 0.008);
    };

    private onPointerUp = (e: PointerEvent) => {
        if (this.touch && this.touch.id === e.pointerId) this.touch = null;
    };

    dispose() {
        const c = this.canvas;
        c.removeEventListener('mousedown', this.onMouseDown);
        c.removeEventListener('wheel', this.onWheel);
        c.removeEventListener('pointerdown', this.onPointerDown);
        c.removeEventListener('pointermove', this.onPointerMove);
        c.removeEventListener('pointerup', this.onPointerUp);
        c.removeEventListener('pointercancel', this.onPointerUp);
        c.removeEventListener('contextmenu', this.onContextMenu);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }
}
