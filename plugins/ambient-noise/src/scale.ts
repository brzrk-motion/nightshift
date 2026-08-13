export type AmbientLayout = 'compact' | 'regular' | 'wide';

export function resolveLayout(width: number, height: number): AmbientLayout {
  if (width < 36 || height < 8) return 'compact';
  if (width >= 56 && height >= 10) return 'wide';
  return 'regular';
}

export function useCompactSkipGlyphs(width: number, layout: AmbientLayout): boolean {
  return layout === 'regular' && width < 44;
}
