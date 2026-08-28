import type { DesignDocument, EditorElement, ShapeElement, TextElement } from '@/types';

export type DesignAuditCategory = 'overflow' | 'contrast' | 'safe_area' | 'missing_alt' | 'brand_consistency';
export type DesignAuditSeverity = 'error' | 'warning';

export interface DesignAuditIssue {
  category: DesignAuditCategory;
  severity: DesignAuditSeverity;
  pageIndex: number;
  pageName: string;
  elementId?: string;
  message: string;
}

export interface DesignAuditReport {
  checkedPages: number;
  summary: {
    issueCount: number;
    errorCount: number;
    warningCount: number;
    byCategory: Record<DesignAuditCategory, number>;
  };
  issues: DesignAuditIssue[];
}

const hexRgb = (value: string): [number, number, number] | null => {
  const match = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  const full = match[1].length === 3 ? [...match[1]].map((char) => char + char).join('') : match[1];
  return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16)) as [number, number, number];
};

const luminance = ([red, green, blue]: [number, number, number]) => {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground: string, background: string) => {
  const foregroundRgb = hexRgb(foreground);
  const backgroundRgb = hexRgb(background);
  if (!foregroundRgb || !backgroundRgb) return null;
  const foregroundLuminance = luminance(foregroundRgb);
  const backgroundLuminance = luminance(backgroundRgb);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
};

const containsCenter = (candidate: EditorElement, element: EditorElement) => {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  return candidate.x <= centerX && candidate.y <= centerY
    && candidate.x + candidate.width >= centerX && candidate.y + candidate.height >= centerY;
};

const textBackground = (page: DesignDocument, text: TextElement) => {
  const textIndex = page.elements.findIndex((element) => element.id === text.id);
  const beneath = page.elements.slice(0, textIndex).filter((element): element is ShapeElement => (
    element.type === 'shape' && !element.hidden && containsCenter(element, text)
  ));
  return beneath.at(-1)?.fill ?? page.background;
};

const issue = (
  category: DesignAuditCategory,
  severity: DesignAuditSeverity,
  page: DesignDocument,
  pageIndex: number,
  message: string,
  elementId?: string,
): DesignAuditIssue => ({ category, severity, pageIndex, pageName: page.name, elementId, message });

export const auditDesignPages = (pages: DesignDocument[], pageIndices = pages.map((_, index) => index)): DesignAuditReport => {
  const issues: DesignAuditIssue[] = [];
  const selectedPages = pageIndices.map((pageIndex) => ({ page: pages[pageIndex], pageIndex })).filter(({ page }) => Boolean(page));

  for (const { page, pageIndex } of selectedPages) {
    const safeArea = page.metadata?.safeArea ?? {
      top: page.height * 0.05, right: page.width * 0.05, bottom: page.height * 0.05, left: page.width * 0.05,
    };
    for (const element of page.elements) {
      if (element.hidden) continue;
      if (element.x < 0 || element.y < 0 || element.x + element.width > page.width || element.y + element.height > page.height) {
        issues.push(issue('overflow', 'error', page, pageIndex, `${element.name} extends beyond the page bounds.`, element.id));
      }
      if (element.type === 'image' && !element.alt?.trim()) {
        issues.push(issue('missing_alt', 'warning', page, pageIndex, `${element.name} is missing alternative text.`, element.id));
      }
      if (['text', 'image', 'video'].includes(element.type)) {
        const outsideSafeArea = element.x < safeArea.left || element.y < safeArea.top
          || element.x + element.width > page.width - safeArea.right
          || element.y + element.height > page.height - safeArea.bottom;
        if (outsideSafeArea) issues.push(issue('safe_area', 'warning', page, pageIndex, `${element.name} crosses the page safe area.`, element.id));
      }
      if (element.type === 'text') {
        const background = textBackground(page, element);
        const ratio = contrastRatio(element.fill, background);
        const largeText = element.fontSize >= 24 || (element.fontSize >= 19 && (element.fontStyle.includes('bold') || (element.fontWeight ?? 0) >= 700));
        const required = largeText ? 3 : 4.5;
        if (ratio !== null && ratio < required) {
          issues.push(issue('contrast', 'error', page, pageIndex, `${element.name} has ${ratio.toFixed(2)}:1 contrast; ${required}:1 is required.`, element.id));
        }
      }
    }
  }

  const tokenValues = new Map<string, Array<{ value: string; page: DesignDocument; pageIndex: number; element: EditorElement }>>();
  const roleFonts = new Map<string, Array<{ value: string; page: DesignDocument; pageIndex: number; element: TextElement }>>();
  for (const { page, pageIndex } of selectedPages) {
    for (const element of page.elements) {
      const token = typeof element.metadata?.brandToken === 'string' ? element.metadata.brandToken : undefined;
      if (token && 'fill' in element && typeof element.fill === 'string') {
        tokenValues.set(token, [...(tokenValues.get(token) ?? []), { value: element.fill, page, pageIndex, element }]);
      }
      const role = typeof element.metadata?.semanticRole === 'string' ? element.metadata.semanticRole : undefined;
      if (role && element.type === 'text') {
        roleFonts.set(role, [...(roleFonts.get(role) ?? []), { value: element.fontFamily, page, pageIndex, element }]);
      }
    }
  }
  for (const [token, values] of tokenValues) {
    if (new Set(values.map(({ value }) => value.toLowerCase())).size <= 1) continue;
    const target = values[0];
    issues.push(issue('brand_consistency', 'warning', target.page, target.pageIndex, `Brand token “${token}” uses inconsistent colors across pages.`, target.element.id));
  }
  for (const [role, values] of roleFonts) {
    if (new Set(values.map(({ value }) => value.toLowerCase())).size <= 1) continue;
    const target = values[0];
    issues.push(issue('brand_consistency', 'warning', target.page, target.pageIndex, `Semantic role “${role}” uses inconsistent fonts across pages.`, target.element.id));
  }

  const categories: DesignAuditCategory[] = ['overflow', 'contrast', 'safe_area', 'missing_alt', 'brand_consistency'];
  return {
    checkedPages: selectedPages.length,
    summary: {
      issueCount: issues.length,
      errorCount: issues.filter(({ severity }) => severity === 'error').length,
      warningCount: issues.filter(({ severity }) => severity === 'warning').length,
      byCategory: Object.fromEntries(categories.map((category) => [category, issues.filter((item) => item.category === category).length])) as Record<DesignAuditCategory, number>,
    },
    issues,
  };
};
