import { describe, expect, it } from 'vitest';
import { formFieldLabel } from './FormField.js';

describe('formFieldLabel', () => {
  it('pads inline labels to twelve columns', () => {
    expect(formFieldLabel('Name', false)).toBe('Name        ');
  });

  it('leaves stacked labels unpadded', () => {
    expect(formFieldLabel('Name', true)).toBe('Name');
  });
});
