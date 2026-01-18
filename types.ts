
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
  // Combat sync data
  combat?: {
    isAttacking: boolean;
    attackType: string | null;
    attackStartTime: number;
    health: number;
    weapon: string | null;
    isDead: boolean;
  };
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
  // Combat state
  health: number;
  maxHealth: number;
  weapon: string | null;
  isDead: boolean;
  // Controls settings
  invertYCamera: boolean;
  cameraSensitivity: number;        // 0.1 to 2.0
  cameraRelativeMovement: boolean;
  // Graphics settings
  renderDistance: number;           // 300 to 1000
  shadowQuality: 'low' | 'medium' | 'high';
  showOtherPlayers: boolean;
  // Audio settings
  masterVolume: number;             // 0 to 100
  musicVolume: number;
  sfxVolume: number;
  // Gameplay settings
  showDamageNumbers: boolean;
  showTooltips: boolean;
}

export type GamePhase = 'MENU' | 'CREATOR' | 'PLAYING';

export interface FloatingTextData {
  id: number;
  x: number; // screen x
  y: number; // screen y
  text: string;
  color?: string; // CSS class for text color
}
