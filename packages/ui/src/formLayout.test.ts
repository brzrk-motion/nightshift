import { describe, expect, it } from 'vitest';
import { formContentSize, formScale } from './formLayout.js';

describe('formContentSize', () => {
  it('subtracts the nav rail, screen padding, header, and footer', () => {
    expect(formContentSize({ width: 80, height: 24 }, false)).toEqual({
      width: 62,
      height: 22,
    });
    expect(formContentSize({ width: 60, height: 20 }, true)).toEqual({
      width: 54,
      height: 18,
    });
  });
});

describe('formScale', () => {
  it('stacks fields and action rows on a narrow terminal', () => {
    const scale = formScale(48, 24);
    expect(scale.layout).toBe('compact');
    expect(scale.stackFields).toBe(true);
    expect(scale.stackActionRows).toBe(true);
    expect(scale.compactActionControls).toBe(true);
    expect(scale.shortFooter).toBe(true);
  });

  it('keeps the regular treatment when there is room', () => {
    const scale = formScale(72, 24);
    expect(scale.layout).toBe('regular');
    expect(scale.stackFields).toBe(false);
    expect(scale.stackActionRows).toBe(false);
    expect(scale.compactActionControls).toBe(false);
    expect(scale.shortFooter).toBe(false);
  });

  it('tightens gaps when height is scarce even if width is fine', () => {
    const scale = formScale(80, 16);
    expect(scale.layout).toBe('compact');
    expect(scale.tightGaps).toBe(true);
    expect(scale.stackFields).toBe(false);
  });

  it('flips stackFields at the 52-column boundary', () => {
    expect(formScale(51, 24).stackFields).toBe(true);
    expect(formScale(52, 24).stackFields).toBe(false);
  });

  it('flips stackActionRows at the 58-column boundary', () => {
    expect(formScale(57, 24).stackActionRows).toBe(true);
    expect(formScale(58, 24).stackActionRows).toBe(false);
  });

  it('flips compactActionControls at the 64-column boundary', () => {
    expect(formScale(63, 24).compactActionControls).toBe(true);
    expect(formScale(64, 24).compactActionControls).toBe(false);
  });

  it('flips shortFooter at the 68-column boundary', () => {
    expect(formScale(67, 24).shortFooter).toBe(true);
    expect(formScale(68, 24).shortFooter).toBe(false);
  });

  it('flips tightGaps at the 20-row boundary', () => {
    expect(formScale(80, 19).tightGaps).toBe(true);
    expect(formScale(80, 20).tightGaps).toBe(false);
  });
});
