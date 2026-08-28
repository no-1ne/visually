import type { RichTextRun } from '@/types';

export type RichTextStyle = Omit<RichTextRun, 'text'>;

function styleOf(run: RichTextRun): RichTextStyle {
  const style = { ...run } as Partial<RichTextRun>;
  delete style.text;
  return style;
}

function sameStyle(first: RichTextStyle, second: RichTextStyle) {
  const firstEntries = Object.entries(first).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b));
  const secondEntries = Object.entries(second).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(firstEntries) === JSON.stringify(secondEntries);
}

function stylesByCharacter(text: string, runs?: readonly RichTextRun[]): RichTextStyle[] {
  const styles = Array.from({ length: text.length }, () => ({} as RichTextStyle));
  let cursor = 0;
  for (const run of runs ?? []) {
    const style = styleOf(run);
    for (let index = 0; index < run.text.length && cursor + index < styles.length; index += 1) styles[cursor + index] = style;
    cursor += run.text.length;
    if (cursor >= styles.length) break;
  }
  return styles;
}

function compactRuns(text: string, styles: readonly RichTextStyle[]): RichTextRun[] {
  if (!text.length) return [];
  const runs: RichTextRun[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const style = styles[index] ?? {};
    const previous = runs.at(-1);
    if (previous && sameStyle(styleOf(previous), style)) previous.text += text[index];
    else runs.push({ text: text[index], ...style });
  }
  return runs;
}

export function styleTextRange(
  text: string,
  runs: readonly RichTextRun[] | undefined,
  start: number,
  end: number,
  style: RichTextStyle,
): RichTextRun[] {
  const from = Math.max(0, Math.min(text.length, Math.floor(Math.min(start, end))));
  const to = Math.max(from, Math.min(text.length, Math.ceil(Math.max(start, end))));
  const styles = stylesByCharacter(text, runs);
  for (let index = from; index < to; index += 1) styles[index] = { ...styles[index], ...style };
  return compactRuns(text, styles);
}

/** Keeps formatting around an edited range and inherits inserted text from its nearest neighbor. */
export function replaceTextKeepingRuns(oldText: string, runs: readonly RichTextRun[] | undefined, newText: string): RichTextRun[] {
  if (oldText === newText) return compactRuns(newText, stylesByCharacter(oldText, runs));
  let prefix = 0;
  while (prefix < oldText.length && prefix < newText.length && oldText[prefix] === newText[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < oldText.length - prefix
    && suffix < newText.length - prefix
    && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) suffix += 1;

  const oldStyles = stylesByCharacter(oldText, runs);
  const inherited = oldStyles[Math.max(0, prefix - 1)] ?? oldStyles[prefix] ?? {};
  const styles = Array.from({ length: newText.length }, (_, index) => {
    if (index < prefix) return oldStyles[index] ?? {};
    if (index >= newText.length - suffix) {
      const oldIndex = oldText.length - (newText.length - index);
      return oldStyles[oldIndex] ?? inherited;
    }
    return inherited;
  });
  return compactRuns(newText, styles);
}
