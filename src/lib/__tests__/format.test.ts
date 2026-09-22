import { formatBytes, formatBytesText, formatDuration, pluralize } from '../format';

describe('formatBytes', () => {
  it('uses base-1000 units so figures match what iOS Settings shows', () => {
    expect(formatBytesText(1_000)).toBe('1.0 KB');
    expect(formatBytesText(1_000_000)).toBe('1.0 MB');
    expect(formatBytesText(4_200_000_000)).toBe('4.2 GB');
  });

  it('drops decimals for bytes and for figures large enough that they are noise', () => {
    expect(formatBytesText(512)).toBe('512 B');
    expect(formatBytesText(250_000_000_000)).toBe('250 GB');
  });

  it('splits value and unit so the ring can style them separately', () => {
    expect(formatBytes(6_400_000_000)).toEqual({ value: '6.4', unit: 'GB', text: '6.4 GB' });
  });

  it('treats missing, negative and non-finite sizes as zero rather than throwing', () => {
    expect(formatBytesText(0)).toBe('0 B');
    expect(formatBytesText(-1)).toBe('0 B');
    expect(formatBytesText(Number.NaN)).toBe('0 B');
  });

  it('stops at the largest unit instead of running off the end of the scale', () => {
    expect(formatBytes(5_000_000_000_000_000).unit).toBe('TB');
  });
});

describe('pluralize', () => {
  it('handles the singular case', () => {
    expect(pluralize(1, 'photo')).toBe('1 photo');
  });

  it('groups thousands for readability', () => {
    expect(pluralize(1248, 'photo')).toBe('1,248 photos');
  });

  it('accepts an irregular plural', () => {
    expect(pluralize(2, 'entry', 'entries')).toBe('2 entries');
  });
});

describe('formatDuration', () => {
  it('pads seconds under a minute', () => {
    expect(formatDuration(47)).toBe('0:47');
    expect(formatDuration(3)).toBe('0:03');
  });

  it('carries into minutes past 60 seconds', () => {
    expect(formatDuration(723)).toBe('12:03');
  });

  it('rounds fractional seconds rather than truncating oddly', () => {
    expect(formatDuration(59.6)).toBe('1:00');
  });

  it('treats missing or non-finite durations as zero rather than throwing', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});
