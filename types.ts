
export interface PlayerData {
  x: number;
  y: number;
  z: number;
  skin: string;
  hair: string;
  eyes: string;
  shirt: string;
  pants: string;
  name: string;
  pet: string | null;
  facing: string;
  lastActive?: number;
}

export interface HouseBlock {
  id?: string;
  x: number;
  y: number;
  z: number;
  type: string;
  builder: string;
}

export interface GameConfig {
  skin: string;
  hair: string;
  eyes: string;
  shirt: string;
  pants: string;
  name: string;
  pet: string | null;
}

export interface GameState {
  money: number;
  energy: number;
  zone: string;
  level: number; // 0 = ground, 1 = 2nd floor
  isBuilding: boolean;
  buildItem: string;
  showMobileControls: boolean;
  alwaysRun: boolean;
}

export type GamePhase = 'MENU' | 'CREATOR' | 'PLAYING';

export interface FloatingTextData {
  id: number;
  x: number; // screen x
  y: number; // screen y
  text: string;
  color?: string; // CSS class for text color
}
