import { describe, it, expect } from 'vitest';
import { createLondonWorldConfig } from '../../services/world/WorldConfigV2';
import { placeNameAt, streetName, PlaceNamer, DISTRICTS } from '../../services/world/Places';

const config = createLondonWorldConfig();

describe('placeNameAt', () => {
  it('names the big junctions', () => {
    expect(placeNameAt(config, 430, 260)).toBe('Oxford Circus');
    expect(placeNameAt(config, 430, 390)).toBe('Piccadilly Circus');
    expect(placeNameAt(config, 530, 490)).toBe('Trafalgar Square');
    expect(placeNameAt(config, 240, 400)).toBe('Hyde Park Corner');
    expect(placeNameAt(config, 240, 260)).toBe('Marble Arch');
  });

  it('names the street you are on, without direction suffixes', () => {
    expect(placeNameAt(config, 600, 262)).toBe('Oxford Street');
    expect(placeNameAt(config, 430, 160)).toBe('Regent Street');
    expect(placeNameAt(config, 240, 180)).toBe('Park Lane');
  });

  it('falls back to districts away from streets', () => {
    expect(placeNameAt(config, 100, 200)).toBe('Hyde Park');
    expect(placeNameAt(config, 285, 330)).toBe('Mayfair');
    expect(placeNameAt(config, 470, 330)).toBe('Soho');
    expect(placeNameAt(config, 780, 780)).toBe('Westminster');
    expect(DISTRICTS.length).toBeGreaterThan(5);
  });

  it('strips bracketed suffixes', () => {
    expect(streetName('Oxford Street (West)')).toBe('Oxford Street');
    expect(streetName('Piccadilly')).toBe('Piccadilly');
  });

  it('caches while the player barely moves', () => {
    const namer = new PlaceNamer(config);
    expect(namer.at(430, 260)).toBe('Oxford Circus');
    expect(namer.at(430.5, 260.5)).toBe('Oxford Circus');
    expect(namer.at(100, 200)).toBe('Hyde Park');
  });
});
