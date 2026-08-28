import { describe, expect, it } from 'vitest';
import { createInitialDocument, templates } from './templates';

describe('design templates', () => {
  it('exposes a useful catalogue with unique metadata', () => {
    expect(templates.length).toBeGreaterThanOrEqual(18);
    expect(new Set(templates.map((template) => template.id)).size).toBe(templates.length);
    expect(new Set(templates.map((template) => template.name)).size).toBe(templates.length);
    expect(templates.every((template) => template.category.length > 0)).toBe(true);
  });

  it.each(templates.map((template) => [template.name, template] as const))('%s has a valid document size', (_name, template) => {
    const document = template.document;
    expect(document.width).toBeGreaterThanOrEqual(1080);
    expect(document.height).toBeGreaterThanOrEqual(1080);
    expect(document.background).toMatch(/^#[0-9A-F]{6}$/i);
    expect(document.elements.length).toBeGreaterThan(2);
  });

  it('includes square, portrait, and landscape starting points across useful categories', () => {
    const ratios = templates.map(({ document }) => document.width / document.height);
    expect(ratios.some((ratio) => Math.abs(ratio - 1) < .01)).toBe(true);
    expect(ratios.some((ratio) => ratio < .8)).toBe(true);
    expect(ratios.some((ratio) => ratio > 1.5)).toBe(true);
    expect(new Set(templates.map((template) => template.category)).size).toBeGreaterThanOrEqual(10);
  });

  it.each(templates.map((template) => [template.name, template] as const))('%s uses valid, unique elements', (_name, template) => {
    const { document } = template;
    const ids = document.elements.map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const element of document.elements) {
      expect(['text', 'shape', 'image', 'line']).toContain(element.type);
      expect(element.name.trim().length).toBeGreaterThan(0);
      expect(element.width).toBeGreaterThan(0);
      expect(element.height).toBeGreaterThan(0);
      expect(Number.isFinite(element.x)).toBe(true);
      expect(Number.isFinite(element.y)).toBe(true);
      expect(element.opacity).toBeGreaterThanOrEqual(0);
      expect(element.opacity).toBeLessThanOrEqual(1);
      expect(Number.isFinite(element.rotation)).toBe(true);
    }
  });

  it('creates fresh initial documents rather than sharing mutable element IDs', () => {
    const first = createInitialDocument();
    const second = createInitialDocument();
    expect(first).not.toBe(second);
    expect(first.elements).not.toBe(second.elements);
    expect(first.elements.map((element) => element.id)).not.toEqual(second.elements.map((element) => element.id));
  });

  it('creates a balanced initial design with text and shape content', () => {
    const document = createInitialDocument();
    expect(document.name).toBe('Untitled summer post');
    expect(document.width).toBe(1080);
    expect(document.height).toBe(1080);
    expect(document.elements.filter((element) => element.type === 'text').length).toBeGreaterThanOrEqual(4);
    expect(document.elements.filter((element) => element.type === 'shape').length).toBeGreaterThanOrEqual(4);
  });
});
