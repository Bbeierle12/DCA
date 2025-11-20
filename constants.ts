export const TILE_SIZE = 40;
export const WORLD_SCALE = 0.2;
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;

export const COLORS = {
  WOOD: 0x8B4513,
  STONE: 0x808080,
  FLOOR: 0xD2B48C,
  FLOWER: 0x90EE90,
  TABLE: 0xA0522D,
  BED: 0xADD8E6,
  STAIRS: 0xaa8866,
  SKY: 0x87CEEB,
  GROUND: 0x4CA64C,
  ROAD: 0x555555,
};

export const PET_COSTS: Record<string, number> = {
  dog: 10,
  cat: 10,
  horse: 25,
  none: 0
};

export const SPAWN_POINT = { x: 200, y: 200 };