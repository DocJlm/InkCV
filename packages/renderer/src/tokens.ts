import type { Settings } from '../../core/src/schema';
import { fontFamilyFor } from './fonts';

export type TemplateProfile =
  | 'onyx'
  | 'lapis'
  | 'minimal-ats'
  | 'compact-tech';

export interface ResolvedTheme {
  profile: TemplateProfile;
  locale: 'zh' | 'en';
  presentLabel: string;
  page: {
    size: 'A4' | 'Letter';
    width: number;
    height: number;
    margin: number;
  };
  fontFamily: string;
  displayFontFamily: string;
  color: {
    text: string;
    accent: string;
    muted: string;
    subtle: string;
  };
  size: {
    base: number;
    name: number;
    headline: number;
    sectionTitle: number;
    small: number;
  };
  lineHeight: {
    body: number;
    name: number;
    title: number;
  };
  space: {
    header: number;
    section: number;
    entry: number;
    bullet: number;
    afterHeadline: number;
    titlePad: number;
    meta: number;
    paragraph: number;
    bulletMark: number;
    photoGap: number;
    rule: number;
  };
  media: {
    photoSize: number;
    photoRadius: number;
  };
  layout: {
    headerAlign: 'left' | 'center';
    sectionRule: 'bottom' | 'trailing';
    secondaryPlacement: 'inline' | 'below';
    headerVariant: 'plain' | 'rule';
    sectionVariant: 'standard' | 'boxed';
    bulletGlyph: '•' | '–' | '▪';
  };
}

interface ProfileSpec {
  name: number;
  headline: number;
  sectionTitle: number;
  small: number;
  header: number;
  section: number;
  entry: number;
  bullet: number;
  afterHeadline: number;
  titlePad: number;
  meta: number;
  paragraph: number;
  bulletMark: number;
  photoGap: number;
  rule: number;
  photoSize: number;
  photoRadius: number;
  headerAlign: 'left' | 'center';
  sectionRule: 'bottom' | 'trailing';
  secondaryPlacement: 'inline' | 'below';
  headerVariant: ResolvedTheme['layout']['headerVariant'];
  sectionVariant: ResolvedTheme['layout']['sectionVariant'];
  bulletGlyph: ResolvedTheme['layout']['bulletGlyph'];
}

const PROFILE_SPECS: Record<TemplateProfile, ProfileSpec> = {
  onyx: {
    name: 2.2,
    headline: 1.15,
    sectionTitle: 1.15,
    small: 0.85,
    header: 12,
    section: 12,
    entry: 7,
    bullet: 2.5,
    afterHeadline: 3,
    titlePad: 2.5,
    meta: 2.5,
    paragraph: 2.5,
    bulletMark: 1.4,
    photoGap: 12,
    rule: 1,
    photoSize: 6.4,
    photoRadius: 0.2,
    headerAlign: 'left',
    sectionRule: 'bottom',
    secondaryPlacement: 'inline',
    headerVariant: 'rule', sectionVariant: 'standard', bulletGlyph: '•',
  },
  lapis: {
    name: 2.05,
    headline: 1.08,
    sectionTitle: 1.12,
    small: 0.82,
    header: 9,
    section: 10,
    entry: 5.5,
    bullet: 2,
    afterHeadline: 2.5,
    titlePad: 2,
    meta: 2,
    paragraph: 2,
    bulletMark: 1.3,
    photoGap: 10,
    rule: 0.8,
    photoSize: 5.8,
    photoRadius: 2.9,
    headerAlign: 'center',
    sectionRule: 'trailing',
    secondaryPlacement: 'inline',
    headerVariant: 'plain', sectionVariant: 'standard', bulletGlyph: '▪',
  },
  'minimal-ats': {
    name: 2,
    headline: 1.05,
    sectionTitle: 1.08,
    small: 0.86,
    header: 10,
    section: 10,
    entry: 6,
    bullet: 2,
    afterHeadline: 2.5,
    titlePad: 2,
    meta: 2,
    paragraph: 2,
    bulletMark: 1.3,
    photoGap: 10,
    rule: 0.55,
    photoSize: 5.4,
    photoRadius: 0,
    headerAlign: 'left',
    sectionRule: 'bottom',
    secondaryPlacement: 'below',
    headerVariant: 'plain', sectionVariant: 'standard', bulletGlyph: '–',
  },
  'compact-tech': {
    name: 2.05, headline: 1.02, sectionTitle: 1.08, small: 0.8,
    header: 7, section: 8, entry: 4.5, bullet: 1.6, afterHeadline: 2,
    titlePad: 1.6, meta: 1.5, paragraph: 1.6, bulletMark: 1.2, photoGap: 8,
    rule: 2.4, photoSize: 5.5, photoRadius: 0,
    headerAlign: 'left', sectionRule: 'bottom', secondaryPlacement: 'inline',
    headerVariant: 'rule', sectionVariant: 'boxed', bulletGlyph: '▪',
  },
};

const MM_TO_PT = 72 / 25.4;
const PAGE_DIMENSIONS: Record<'A4' | 'Letter', { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
};
const MIN_ZH_LINE_HEIGHT = 1.4;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return { r: 26, g: 26, b: 26 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const mix = (c: number) => clampByte(c + (255 - c) * amount);
  const to2 = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export function resolveTheme(
  settings: Settings,
  profile: TemplateProfile = 'onyx',
): ResolvedTheme {
  const t = settings.tokens;
  const spec = PROFILE_SPECS[profile];
  const isZh = settings.locale === 'zh';
  const base = t.fontSize;
  const spacing = t.spacing;
  const dims = PAGE_DIMENSIONS[settings.page.size];

  return {
    profile,
    locale: settings.locale,
    presentLabel: isZh ? '至今' : 'Present',
    page: {
      size: settings.page.size,
      width: dims.width,
      height: dims.height,
      margin: settings.page.margin * MM_TO_PT,
    },
    fontFamily: fontFamilyFor(t),
    displayFontFamily: fontFamilyFor(t),
    color: {
      text: t.textColor,
      accent: t.accentColor,
      muted: lighten(t.textColor, 0.45),
      subtle: lighten(t.accentColor, 0.92),
    },
    size: {
      base,
      name: base * spec.name,
      headline: base * spec.headline,
      sectionTitle: base * spec.sectionTitle,
      small: base * spec.small,
    },
    lineHeight: {
      body: isZh ? Math.max(t.lineHeight, MIN_ZH_LINE_HEIGHT) : t.lineHeight,
      name: 1.2,
      title: isZh ? 1.4 : 1.2,
    },
    space: {
      header: spec.header * spacing,
      section: spec.section * spacing,
      entry: spec.entry * spacing,
      bullet: spec.bullet * spacing,
      afterHeadline: spec.afterHeadline * spacing,
      titlePad: spec.titlePad * spacing,
      meta: spec.meta * spacing,
      paragraph: spec.paragraph * spacing,
      bulletMark: base * spec.bulletMark,
      photoGap: spec.photoGap * spacing,
      rule: spec.rule,
    },
    media: {
      photoSize: base * spec.photoSize,
      photoRadius: base * spec.photoRadius,
    },
    layout: {
      headerAlign: spec.headerAlign,
      sectionRule: spec.sectionRule,
      secondaryPlacement: spec.secondaryPlacement,
      headerVariant: spec.headerVariant,
      sectionVariant: spec.sectionVariant,
      bulletGlyph: spec.bulletGlyph,
    },
  };
}
