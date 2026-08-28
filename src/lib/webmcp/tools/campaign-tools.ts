import { CAMPAIGN_FORMATS } from '@/lib/campaign';
import type { BrandUpdate, CampaignBrief, CampaignFormat } from '@/lib/campaign';
import { useEditorStore } from '@/store/editor-store';
import type { WebMcpTool } from '../types';
import { booleanField, fail, inputBoolean, inputText, objectSchema, readOnlyTool, stringField, success } from './shared';

const formatNames = Object.keys(CAMPAIGN_FORMATS) as CampaignFormat[];
const optionalText = (input: Record<string, unknown>, key: string, maxLength = 512) => (
  typeof input[key] === 'string' ? String(input[key]).trim().slice(0, maxLength) : undefined
);

const brandFields = (input: Record<string, unknown>): BrandUpdate => ({
  brandName: optionalText(input, 'brandName', 120),
  headline: optionalText(input, 'headline', 280),
  subheadline: optionalText(input, 'subheadline', 500),
  cta: optionalText(input, 'cta', 100),
  primaryColor: optionalText(input, 'primaryColor', 64),
  secondaryColor: optionalText(input, 'secondaryColor', 64),
  accentColor: optionalText(input, 'accentColor', 64),
  textColor: optionalText(input, 'textColor', 64),
  fontFamily: optionalText(input, 'fontFamily', 120),
});

const fieldsSchema = {
  brandName: stringField('Brand name used consistently across campaign formats.', { maxLength: 120 }),
  headline: stringField('Primary campaign headline.', { maxLength: 280 }),
  subheadline: stringField('Supporting campaign message.', { maxLength: 500 }),
  cta: stringField('Call-to-action label.', { maxLength: 100 }),
  primaryColor: stringField('Primary CSS color, preferably hex.', { maxLength: 64 }),
  secondaryColor: stringField('Secondary or page-background CSS color, preferably hex.', { maxLength: 64 }),
  accentColor: stringField('Accent CSS color, preferably hex.', { maxLength: 64 }),
  textColor: stringField('Campaign text CSS color, preferably hex.', { maxLength: 64 }),
  fontFamily: stringField('Campaign font family.', { maxLength: 120 }),
};

export const createCampaignTools = (): WebMcpTool[] => [
  {
    name: 'visually_create_campaign',
    title: 'Create a multi-format campaign',
    description: 'Create coordinated, semantically tagged campaign pages from one brief. Replaces the open project only with confirm=true and records one undo step.',
    inputSchema: objectSchema({
      ...fieldsSchema,
      formats: {
        type: 'array',
        description: 'Unique output formats. Defaults to all five supported campaign formats.',
        items: { type: 'string', enum: formatNames },
        minItems: 1,
        maxItems: formatNames.length,
        uniqueItems: true,
      },
      confirm: booleanField('Must be true to replace the open project with the generated campaign.'),
    }, ['brandName', 'headline', 'confirm']),
    execute: (input) => {
      if (!inputBoolean(input, 'confirm')) return fail('Campaign creation was not confirmed. Pass confirm=true only after the user has approved replacing the open project.');
      const brandName = inputText(input, 'brandName').trim().slice(0, 120);
      const headline = inputText(input, 'headline').trim().slice(0, 280);
      if (!brandName || !headline) return fail('brandName and headline must be non-empty strings.');
      const rawFormats = input.formats ?? formatNames;
      if (!Array.isArray(rawFormats) || !rawFormats.length || rawFormats.some((format) => typeof format !== 'string' || !formatNames.includes(format as CampaignFormat))) {
        return fail(`formats must contain supported values: ${formatNames.join(', ')}.`);
      }
      const formats = [...new Set(rawFormats as CampaignFormat[])];
      if (formats.length !== rawFormats.length) return fail('formats must not contain duplicates.');
      const brief = { ...brandFields(input), brandName, headline } satisfies CampaignBrief;
      useEditorStore.getState().createCampaign(brief, formats);
      const state = useEditorStore.getState();
      return success(`Created a coordinated ${state.pages.length}-format campaign.`, {
        pageCount: state.pages.length,
        formats,
        pages: state.pages.map((page, pageIndex) => ({ pageIndex, name: page.name, width: page.width, height: page.height })),
        semanticRoles: ['brandName', 'headline', 'subheadline', 'cta'],
      });
    },
  },
  {
    name: 'visually_apply_brand_update',
    title: 'Apply a campaign-wide brand update',
    description: 'Update tagged brand copy, colors, and typography across every campaign page in one semantic, undoable operation.',
    inputSchema: objectSchema(fieldsSchema),
    execute: (input) => {
      const update = brandFields(input);
      const supplied = Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined));
      if (!Object.keys(supplied).length) return fail('Provide at least one brand or campaign field to update.');
      if (Object.values(supplied).some((value) => value === '')) return fail('Brand update fields cannot be empty strings.');
      const result = useEditorStore.getState().applyBrandUpdate(supplied);
      if (!result.updatedPages) return fail('No tagged campaign elements needed this update. Create a campaign first or provide different values.');
      return success(`Applied the brand update across ${result.updatedPages} page${result.updatedPages === 1 ? '' : 's'}.`, result);
    },
  },
  {
    name: 'visually_audit_design',
    title: 'Audit design quality',
    description: 'Read-only audit for overflow, text contrast, safe-area crossings, missing image alt text, and cross-page brand consistency.',
    inputSchema: objectSchema({
      scope: stringField('Audit the active page or the full project.', { enum: ['active_page', 'all_pages'] }),
    }),
    annotations: readOnlyTool,
    execute: (input) => {
      const scope = optionalText(input, 'scope') ?? 'all_pages';
      if (scope !== 'active_page' && scope !== 'all_pages') return fail('scope must be active_page or all_pages.');
      const report = useEditorStore.getState().auditDesign(scope);
      return success(`Audited ${report.checkedPages} page${report.checkedPages === 1 ? '' : 's'} and found ${report.summary.issueCount} issue${report.summary.issueCount === 1 ? '' : 's'}.`, report);
    },
  },
];
