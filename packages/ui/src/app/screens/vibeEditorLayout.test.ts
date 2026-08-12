import { describe, expect, it } from 'vitest';
import { vibeEditorContentSize, vibeEditorScale } from './vibeEditorLayout.js';

describe('vibeEditorContentSize', () => {
  it('subtracts the nav rail, screen padding, header, and footer', () => {
    expect(vibeEditorContentSize({ width: 80, height: 24 }, false)).toEqual({
      width: 62,
      height: 22,
    });
    expect(vibeEditorContentSize({ width: 60, height: 20 }, true)).toEqual({
      width: 54,
      height: 18,
    });
  });
});

describe('vibeEditorScale', () => {
  it('stacks fields and action rows on a narrow terminal', () => {
    const scale = vibeEditorScale(48, 24);
    expect(scale.layout).toBe('compact');
    expect(scale.stackFields).toBe(true);
    expect(scale.stackActionRows).toBe(true);
    expect(scale.compactActionControls).toBe(true);
    expect(scale.shortFooter).toBe(true);
  });

  it('keeps the regular treatment when there is room', () => {
    const scale = vibeEditorScale(72, 24);
    expect(scale.layout).toBe('regular');
    expect(scale.stackFields).toBe(false);
    expect(scale.stackActionRows).toBe(false);
    expect(scale.compactActionControls).toBe(false);
    expect(scale.shortFooter).toBe(false);
  });

  it('tightens gaps when height is scarce even if width is fine', () => {
    const scale = vibeEditorScale(80, 16);
    expect(scale.layout).toBe('compact');
    expect(scale.tightGaps).toBe(true);
    expect(scale.stackFields).toBe(false);
  });
});
