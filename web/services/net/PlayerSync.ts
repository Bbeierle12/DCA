import { PlayerData } from '../../types';
import { CombatState } from '../CombatSystem';
import { PlayerState } from '../game/PlayerController';

/** The part of PlayerData we broadcast every 100 ms (positions rounded to centimetres). */
export function playerNetState(p: PlayerState, c: CombatState, now = Date.now()): Partial<PlayerData> {
    return {
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
        z: p.level,
        facing: p.facing,
        lastActive: now,
        combat: {
            isAttacking: c.isAttacking,
            attackType: c.attackType,
            attackStartTime: c.attackStartTime,
            health: c.health,
            weapon: c.weapon,
            isDead: c.isDead,
        },
    };
}
