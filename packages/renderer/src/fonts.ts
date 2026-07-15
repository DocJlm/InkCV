import { Font } from '@react-pdf/renderer';
import type { ThemeTokens } from '../../core/src/schema';

/**
 * Font registration for @react-pdf/renderer.
 *
 * Two font families are registered, each with an explicit Regular (400) and
 * Bold (700) face:
 *   - 'InkSans'  -> Noto Sans SC
 *   - 'InkSerif' -> Noto Serif SC
 *
 * KNOWN PITFALL: react-pdf resolves `fontWeight: 700` against the *nearest*
 * registered face. If only the Regular face is registered, bold CJK text is
 * rendered by synthetically re-using the 400 glyphs (no real bold), and in some
 * builds the weight resolver throws. Registering the Bold face under the *same*
 * family at fontWeight 700 is what makes `<Text style={{fontWeight:'bold'}}>`
 * pick up genuinely bold glyphs. This is why the Bold OTFs are downloaded and
 * registered here rather than relying on faux-bold.
 */

// jsdelivr URLs — react-pdf fetches these directly in the browser.
const CDN = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main';
const CDN_SRC = {
  sansRegular: `${CDN}/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf`,
  sansBold: `${CDN}/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf`,
  serifRegular: `${CDN}/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf`,
  serifBold: `${CDN}/Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf`,
} as const;

export const SANS_FAMILY = 'InkSans';
export const SERIF_FAMILY = 'InkSerif';

let registered = false;

/**
 * True when running under Node (tests / desktop main process), false in the
 * browser — including Web Workers, where `window` is undefined but
 * `process.versions.node` is too.
 */
export function isNodeEnv(): boolean {
  const g = globalThis as unknown as { process?: { versions?: { node?: string } } };
  const hasProcess = typeof g.process !== 'undefined' && !!g.process?.versions?.node;
  const hasWindow = typeof window !== 'undefined' && typeof document !== 'undefined';
  return hasProcess && !hasWindow;
}

/** Resolve an absolute filesystem path to a bundled font, relative to this module. */
function localFontPath(file: string): string {
  // In Node, fontkit.open() expects a plain filesystem path (not a file:// URL).
  const url = new URL(`../assets/fonts/${file}`, import.meta.url);
  const pathname = decodeURIComponent(url.pathname);
  // WHATWG file URLs expose Windows drive paths as /C:/..., but fontkit treats
  // that leading slash as a relative root and prefixes the drive a second time.
  return /^\/[A-Za-z]:\//.test(pathname) ? pathname.slice(1) : pathname;
}

function sources(node: boolean) {
  if (node) {
    return {
      sansRegular: localFontPath('NotoSansSC-Regular.otf'),
      sansBold: localFontPath('NotoSansSC-Bold.otf'),
      serifRegular: localFontPath('NotoSerifSC-Regular.otf'),
      serifBold: localFontPath('NotoSerifSC-Bold.otf'),
    };
  }
  return CDN_SRC;
}

/**
 * Register the InkSans / InkSerif families. Idempotent: safe to await on every
 * compile. Also disables react-pdf's Latin hyphenation, which otherwise inserts
 * hyphens inside CJK runs.
 */
export async function registerFonts(): Promise<void> {
  if (registered) return;

  const src = sources(isNodeEnv());

  Font.register({
    family: SANS_FAMILY,
    fonts: [
      { src: src.sansRegular, fontWeight: 400 },
      { src: src.sansBold, fontWeight: 700 },
    ],
  });
  Font.register({
    family: SERIF_FAMILY,
    fonts: [
      { src: src.serifRegular, fontWeight: 400 },
      { src: src.serifBold, fontWeight: 700 },
    ],
  });

  // CJK must not be hyphenated: return the word unchanged as a single chunk.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}

/** Map the theme's abstract fontFamily token to a concrete registered family. */
export function fontFamilyFor(tokens: Pick<ThemeTokens, 'fontFamily'>): string {
  return tokens.fontFamily === 'serif' ? SERIF_FAMILY : SANS_FAMILY;
}
