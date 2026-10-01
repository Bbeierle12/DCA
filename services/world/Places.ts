/** Placeholder place names until P1.6 derives them from the map. */
export function placeNameAt(x: number, y: number): string {
    if (x < 120 && y < 100) return 'City Center';
    if (x > 160 && y < 100) return 'Food Court';
    if (y > 120) return 'Home Lot';
    return 'Streets';
}
