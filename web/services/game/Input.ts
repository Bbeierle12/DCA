/**
 * Keyboard + virtual (on-screen) + analog input, keyed by KeyboardEvent.code so modifier keys
 * never change which key is held (Shift+W used to leave 'w' stuck down).
 */

export interface MoveAxis {
    x: number; // -1 left .. 1 right
    y: number; // -1 forward .. 1 back
    analog: boolean;
}

const FORWARD = ['KeyW', 'ArrowUp'];
const BACK = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const RUN = ['ShiftLeft', 'ShiftRight'];

/** True when the event comes from a place where the user is typing text. */
export function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || typeof el.tagName !== 'string') return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
}

export class Input {
    private held = new Set<string>();
    private virtual = new Set<string>();
    private analog = { x: 0, y: 0 };
    private target: Window | null = null;
    private actionHandler: ((code: string, e: KeyboardEvent) => void) | null = null;

    /** Called once per fresh key press (not on auto-repeat). */
    onAction(handler: (code: string, e: KeyboardEvent) => void) {
        this.actionHandler = handler;
    }

    attach(target: Window = window) {
        this.target = target;
        target.addEventListener('keydown', this.handleKeyDown);
        target.addEventListener('keyup', this.handleKeyUp);
        target.addEventListener('blur', this.clear);
        target.document?.addEventListener('visibilitychange', this.handleVisibility);
    }

    detach() {
        const t = this.target;
        if (!t) return;
        t.removeEventListener('keydown', this.handleKeyDown);
        t.removeEventListener('keyup', this.handleKeyUp);
        t.removeEventListener('blur', this.clear);
        t.document?.removeEventListener('visibilitychange', this.handleVisibility);
        this.target = null;
    }

    handleKeyDown = (e: KeyboardEvent) => {
        if (isTypingTarget(e.target)) return;
        const fresh = !this.held.has(e.code);
        this.held.add(e.code);
        if (fresh && !e.repeat && this.actionHandler) this.actionHandler(e.code, e);
    };

    handleKeyUp = (e: KeyboardEvent) => {
        this.held.delete(e.code);
    };

    private handleVisibility = () => {
        if (document.visibilityState === 'hidden') this.clear();
    };

    clear = () => {
        this.held.clear();
        this.virtual.clear();
        this.analog = { x: 0, y: 0 };
    };

    isDown(code: string): boolean {
        return this.held.has(code) || this.virtual.has(code);
    }

    anyDown(codes: string[]): boolean {
        return codes.some(c => this.isDown(c));
    }

    /** On-screen buttons press codes such as 'ArrowUp'. */
    setVirtual(code: string, pressed: boolean) {
        if (pressed) this.virtual.add(code);
        else this.virtual.delete(code);
    }

    /** Joystick vector; magnitude is clamped to 1. */
    setAnalog(x: number, y: number) {
        const len = Math.hypot(x, y);
        if (len > 1) {
            x /= len;
            y /= len;
        }
        this.analog = { x, y };
    }

    get running(): boolean {
        return this.anyDown(RUN);
    }

    /** Movement intent. Analog input wins when the stick is deflected. */
    moveAxis(): MoveAxis {
        if (Math.hypot(this.analog.x, this.analog.y) > 0.05) {
            return { x: this.analog.x, y: this.analog.y, analog: true };
        }
        let x = 0;
        let y = 0;
        if (this.anyDown(FORWARD)) y -= 1;
        if (this.anyDown(BACK)) y += 1;
        if (this.anyDown(LEFT)) x -= 1;
        if (this.anyDown(RIGHT)) x += 1;
        const len = Math.hypot(x, y);
        if (len > 1) {
            x /= len;
            y /= len;
        }
        return { x, y, analog: false };
    }
}
