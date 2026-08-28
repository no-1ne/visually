import { CURRENT_DOCUMENT_SCHEMA_VERSION } from '@/types';
import type { DesignDocument, EditorElement, TextElement } from '@/types';

export const CAMPAIGN_FORMATS = {
  instagram_post: { label: 'Instagram Post', width: 1080, height: 1080 },
  instagram_story: { label: 'Instagram Story', width: 1080, height: 1920 },
  youtube_thumbnail: { label: 'YouTube Thumbnail', width: 1280, height: 720 },
  poster: { label: 'Poster', width: 1200, height: 1600 },
  landscape_banner: { label: 'Landscape Banner', width: 1600, height: 900 },
} as const;

export type CampaignFormat = keyof typeof CAMPAIGN_FORMATS;
export type CampaignSemanticRole = 'background' | 'brandName' | 'headline' | 'subheadline' | 'ctaBackground' | 'cta';
export type CampaignBrandToken = 'primary' | 'secondary' | 'accent' | 'text';

export interface CampaignBrief {
  brandName: string;
  headline: string;
  subheadline?: string;
  cta?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  textColor?: string;
  fontFamily?: string;
}

export interface BrandUpdate {
  brandName?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  textColor?: string;
  fontFamily?: string;
}

export interface BrandUpdateResult {
  updatedElements: number;
  updatedPages: number;
  appliedFields: string[];
}

const id = () => crypto.randomUUID();
const metadata = (semanticRole: CampaignSemanticRole, brandToken?: CampaignBrandToken) => ({
  semanticRole,
  ...(brandToken ? { brandToken } : {}),
});

const textElement = (
  semanticRole: CampaignSemanticRole,
  name: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  fill: string,
  fontFamily: string,
  brandToken: CampaignBrandToken,
  align: TextElement['align'] = 'left',
): TextElement => ({
  id: id(), type: 'text', name, text, x, y, width, height, rotation: 0, opacity: 1,
  fontSize, fontFamily, fontStyle: 'bold', fill, align, letterSpacing: 0,
  lineHeight: 1, metadata: metadata(semanticRole, brandToken),
});

export const createCampaignPages = (
  brief: CampaignBrief,
  formats: CampaignFormat[] = Object.keys(CAMPAIGN_FORMATS) as CampaignFormat[],
): DesignDocument[] => {
  const primary = brief.primaryColor ?? '#172034';
  const secondary = brief.secondaryColor ?? '#F6F1E8';
  const accent = brief.accentColor ?? '#C7F65C';
  const text = brief.textColor ?? '#FFF9ED';
  const font = brief.fontFamily ?? 'Manrope';
  const subheadline = brief.subheadline ?? 'Made for what comes next.';
  const cta = brief.cta ?? 'DISCOVER MORE';

  return formats.map((format) => {
    const { label, width, height } = CAMPAIGN_FORMATS[format];
    const short = Math.min(width, height);
    const margin = Math.round(short * 0.055);
    const inset = Math.round(short * 0.085);
    const innerWidth = width - inset * 2;
    const landscape = width / height > 1.25;
    const headlineY = Math.round(height * (landscape ? 0.25 : 0.28));
    const headlineSize = Math.round(short * (landscape ? 0.105 : 0.115));
    const headlineHeight = Math.round(height * (landscape ? 0.29 : 0.25));
    const buttonWidth = Math.min(Math.round(short * 0.42), innerWidth);
    const buttonHeight = Math.round(short * 0.09);
    const buttonY = height - inset - buttonHeight;
    const accentSize = Math.round(short * (landscape ? 0.3 : 0.34));
    const elements: EditorElement[] = [
      {
        id: id(), type: 'shape', name: 'Brand background', shape: 'rect', x: margin, y: margin,
        width: width - margin * 2, height: height - margin * 2, rotation: 0, opacity: 1,
        fill: primary, cornerRadius: Math.round(short * 0.035), metadata: metadata('background', 'primary'),
      },
      {
        id: id(), type: 'shape', name: 'Brand accent', shape: 'circle',
        x: width - margin - accentSize - Math.round(short * 0.04), y: margin + Math.round(short * 0.035),
        width: accentSize, height: accentSize, rotation: 0, opacity: 1, fill: accent,
        cornerRadius: 0, metadata: metadata('background', 'accent'),
      },
      textElement('brandName', 'Brand name', brief.brandName, inset, Math.round(height * 0.105), innerWidth * 0.72,
        Math.round(short * 0.07), Math.round(short * 0.027), text, font, 'text'),
      textElement('headline', 'Campaign headline', brief.headline, inset, headlineY, innerWidth * (landscape ? 0.72 : 1),
        headlineHeight, headlineSize, text, font, 'text'),
      textElement('subheadline', 'Campaign subheadline', subheadline, inset, headlineY + headlineHeight + Math.round(short * 0.025),
        innerWidth * (landscape ? 0.62 : 0.82), Math.round(short * 0.11), Math.round(short * 0.032), text, font, 'text'),
      {
        id: id(), type: 'shape', name: 'CTA background', shape: 'rect', x: inset, y: buttonY,
        width: buttonWidth, height: buttonHeight, rotation: 0, opacity: 1, fill: accent,
        cornerRadius: Math.round(buttonHeight / 2), metadata: metadata('ctaBackground', 'accent'),
      },
      textElement('cta', 'CTA', cta, inset + Math.round(buttonWidth * 0.06), buttonY + Math.round(buttonHeight * 0.29),
        Math.round(buttonWidth * 0.88), Math.round(buttonHeight * 0.45), Math.round(short * 0.025), primary, font, 'primary', 'center'),
    ];
    return {
      schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
      name: `${brief.brandName} — ${label}`,
      width,
      height,
      background: secondary,
      elements,
      metadata: {
        description: `${brief.brandName} campaign adaptation for ${label}`,
        tags: ['campaign', format, 'agent-created'],
        safeArea: { top: inset, right: inset, bottom: inset, left: inset },
      },
    };
  });
};

const semanticRole = (element: EditorElement) => element.metadata?.semanticRole as CampaignSemanticRole | undefined;
const brandToken = (element: EditorElement) => element.metadata?.brandToken as CampaignBrandToken | undefined;

export const applyBrandUpdateToPages = (pages: DesignDocument[], update: BrandUpdate) => {
  const appliedFields = Object.entries(update).filter(([, value]) => typeof value === 'string').map(([key]) => key);
  let updatedElements = 0;
  let updatedPages = 0;
  const nextPages = structuredClone(pages);

  for (const page of nextPages) {
    let pageChanged = false;
    for (const element of page.elements) {
      const role = semanticRole(element);
      const token = brandToken(element);
      const changes: Record<string, string> = {};
      if (element.type === 'text') {
        if (role === 'brandName' && update.brandName !== undefined) changes.text = update.brandName;
        if (role === 'headline' && update.headline !== undefined) changes.text = update.headline;
        if (role === 'subheadline' && update.subheadline !== undefined) changes.text = update.subheadline;
        if (role === 'cta' && update.cta !== undefined) changes.text = update.cta;
        if (update.fontFamily !== undefined) changes.fontFamily = update.fontFamily;
      }
      const color = token === 'primary' ? update.primaryColor
        : token === 'secondary' ? update.secondaryColor
          : token === 'accent' ? update.accentColor
            : token === 'text' ? update.textColor : undefined;
      if (color !== undefined && ('fill' in element)) changes.fill = color;
      const changed = Object.entries(changes).some(([key, value]) => (element as unknown as Record<string, unknown>)[key] !== value);
      if (!changed) continue;
      Object.assign(element, changes);
      updatedElements += 1;
      pageChanged = true;
    }
    if (update.secondaryColor !== undefined && page.background !== update.secondaryColor) {
      page.background = update.secondaryColor;
      pageChanged = true;
    }
    if (update.brandName !== undefined && page.metadata?.tags?.includes('campaign')) {
      const suffix = page.name.includes(' — ') ? page.name.slice(page.name.indexOf(' — ')) : '';
      page.name = `${update.brandName}${suffix}`;
    }
    if (pageChanged) updatedPages += 1;
  }

  return { pages: nextPages, result: { updatedElements, updatedPages, appliedFields } satisfies BrandUpdateResult };
};
