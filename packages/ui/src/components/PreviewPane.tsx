import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  templates,
  PdfPreviewController,
  renderPdfToCanvas,
  compileResume,
} from '@inkcv/renderer';
import { exportTexBundle, texTemplates } from '@inkcv/exporters';
import {
  RESUME_COLOR_PRESETS,
  serializeInkCvBackup,
  serializeResumeToMarkdown,
  type ResumeColorPresetId,
  type ResumeDoc,
} from '@inkcv/core';
import { useEditorStore } from '../store';
import { DropdownMenu, IconClose, IconDownload, IconSliders, type MenuItem } from '../primitives';
import { useAppServices } from '../services';

const ZOOMS = [0.75, 1, 1.25] as const;
const RENDER_SCALE = 1.6;

const TEMPLATE_PREVIEWS = {
  onyx: {
    zh: new URL('../assets/template-previews/onyx-zh.png', import.meta.url).href,
    en: new URL('../assets/template-previews/onyx-en.png', import.meta.url).href,
  },
  lapis: {
    zh: new URL('../assets/template-previews/lapis-zh.png', import.meta.url).href,
    en: new URL('../assets/template-previews/lapis-en.png', import.meta.url).href,
  },
  classic: {
    zh: new URL('../assets/template-previews/classic-zh.png', import.meta.url).href,
    en: new URL('../assets/template-previews/classic-en.png', import.meta.url).href,
  },
  'minimal-ats': {
    zh: new URL('../assets/template-previews/minimal-ats-zh.png', import.meta.url).href,
    en: new URL('../assets/template-previews/minimal-ats-en.png', import.meta.url).href,
  },
} as const;

const TEMPLATE_DESCRIPTION_KEYS = {
  onyx: 'template.onyx.description',
  lapis: 'template.lapis.description',
  classic: 'template.classic.description',
  'minimal-ats': 'template.minimalAts.description',
} as const;

export function PreviewPane(): ReactNode {
  const { t } = useTranslation();
  const doc = useEditorStore((s) => s.doc);
  const docRevision = useEditorStore((s) => s.docRevision);
  const setPreviewBytes = useEditorStore((s) => s.setPreviewBytes);

  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<PdfPreviewController | null>(null);
  const pendingRevision = useRef(0);
  const freshRevision = useRef(-1);
  const latestDoc = useRef<ResumeDoc | null>(null);
  const fallbackRevision = useRef(-1);

  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);

  // Create the controller once.
  useEffect(() => {
    // Paint a compiled frame: mark it fresh, then rasterise onto the canvases.
    const paint = (bytes: Uint8Array, revision: number) => {
      setPreviewBytes(bytes);
      setCompiling(false);
      setError(null);
      freshRevision.current = revision;
      const container = containerRef.current;
      if (!container) return;
      void renderPdfToCanvas(bytes, container, { scale: RENDER_SCALE })
        .then(() => setPageCount(container.childElementCount))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    };

    const controller = new PdfPreviewController({
      debounceMs: 300,
      onFrame: (bytes) => paint(bytes, pendingRevision.current),
      onError: (msg) => {
        setCompiling(false);
        // Resilience / design-doc risk #5 ("worker 挂掉降级主线程"): if the worker
        // path fails, retry once on the main thread — where compileResume is
        // known-good — before surfacing the error. Dormant when the worker works.
        const rev = pendingRevision.current;
        const doc0 = latestDoc.current;
        if (doc0 && fallbackRevision.current !== rev) {
          fallbackRevision.current = rev;
          setCompiling(true);
          compileResume(doc0).then(
            (bytes) => {
              if (rev === pendingRevision.current) paint(bytes, rev);
              else setCompiling(false);
            },
            () => {
              setCompiling(false);
              setError(msg);
            },
          );
        } else {
          setError(msg);
        }
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [setPreviewBytes]);

  // Push doc changes into the controller.
  useEffect(() => {
    if (!doc || !controllerRef.current) return;
    latestDoc.current = doc;
    pendingRevision.current = docRevision;
    setCompiling(true);
    controllerRef.current.setDoc(doc);
  }, [doc, docRevision]);

  const isPreviewFresh = () => freshRevision.current === docRevision;

  return (
    <div className="ink-preview">
      <div className="ink-preview-toolbar">
        <TemplateGallery />

        <select
          className="ink-input ink-select-sm"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label={t('preview.zoom')}
        >
          {ZOOMS.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>

        <span className="ink-page-count">
          {pageCount > 0 ? t('preview.pages', { count: pageCount }) : '-'}
        </span>

        {compiling && (
          <span className="ink-compiling">
            <span className="ink-spinner" /> {t('preview.compiling')}
          </span>
        )}
        {!compiling && error && <span className="ink-preview-err" title={error}>{t('preview.error')}</span>}

        <div className="ink-spacer" />

        <button
          className={`ink-btn ink-btn-sm${styleOpen ? ' active' : ''}`}
          onClick={() => setStyleOpen((v) => !v)}
        >
          <IconSliders /> {t('preview.style')}
        </button>

        <ExportMenu isPreviewFresh={isPreviewFresh} />
      </div>

      {styleOpen && <ThemeDrawer />}

      <div className="ink-preview-scroll">
        {pageCount === 0 && (
          <div className="ink-preview-placeholder">{error ? t('preview.error') : t('preview.empty')}</div>
        )}
        {/* renderPdfToCanvas() owns this node's children (replaceChildren); it must
            stay React-empty so React never reconciles a canvas it didn't create. */}
        <div
          className="ink-preview-pages"
          data-testid="preview"
          ref={containerRef}
          style={{
            '--ink-desktop-preview-width': `${Math.round(zoom * 640)}px`,
            '--ink-mobile-preview-width': `calc(${zoom * 100}vw - ${Math.round(zoom * 16)}px)`,
          } as CSSProperties}
        />
      </div>
    </div>
  );
}

function localeName(tpl: { nameZh: string; nameEn: string }, zh: boolean): string {
  return zh ? tpl.nameZh : tpl.nameEn;
}

function TemplateGallery(): ReactNode {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentTemplate = useEditorStore((state) => state.doc?.settings.template ?? 'onyx');
  const zh = i18n.language.toLowerCase().startsWith('zh');
  const current = templates.find((template) => template.id === currentTemplate) ?? templates[0]!;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    const frame = requestAnimationFrame(() => {
      const selected = rootRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      selected?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const cards = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('.ink-template-card'),
    );
    const index = cards.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % cards.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + cards.length) % cards.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = cards.length - 1;
    else return;
    event.preventDefault();
    cards[next]?.focus();
  };

  return (
    <div className="ink-template-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`ink-btn ink-btn-sm ink-template-trigger${open ? ' active' : ''}`}
        data-testid="template-picker"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ink-template-trigger-label">{t('preview.template')}</span>
        <strong>{localeName(current, zh)}</strong>
      </button>

      {open && (
        <div
          className="ink-template-popover"
          role="dialog"
          aria-label={t('templateGallery.title')}
        >
          <div className="ink-template-popover-head">
            <span>{t('templateGallery.title')}</span>
            <button
              className="ink-icon-btn ink-template-close"
              aria-label={t('common.close')}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <IconClose />
            </button>
          </div>
          <div className="ink-template-grid" role="listbox" onKeyDown={moveFocus}>
            {templates.map((template) => {
              const selected = template.id === currentTemplate;
              const preview = TEMPLATE_PREVIEWS[template.id][zh ? 'zh' : 'en'];
              return (
                <button
                  key={template.id}
                  className={`ink-template-card${selected ? ' active' : ''}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    useEditorStore.getState().updateDoc((draft) => {
                      draft.settings.template = template.id;
                    });
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="ink-template-preview">
                    <img
                      src={preview}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span className="ink-template-card-copy">
                    <strong>{localeName(template, zh)}</strong>
                    <small>{t(TEMPLATE_DESCRIPTION_KEYS[template.id])}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export menu

function ExportMenu({ isPreviewFresh }: { isPreviewFresh: () => boolean }): ReactNode {
  const { t, i18n } = useTranslation();
  const { files } = useAppServices();

  const fileBase = (doc: ResumeDoc) => doc.basics.name.trim() || 'resume';

  const exportPdf = async () => {
    const { doc, previewBytes } = useEditorStore.getState();
    if (!doc) return;
    const bytes = previewBytes && isPreviewFresh() ? previewBytes : await compileResume(doc);
    await files.save(bytes, `${fileBase(doc)}.pdf`, 'application/pdf');
  };

  const exportMd = async () => {
    const doc = useEditorStore.getState().doc;
    if (!doc) return;
    await files.save(serializeResumeToMarkdown(doc), `${fileBase(doc)}.md`, 'text/markdown');
  };

  const exportLatex = async () => {
    const doc = useEditorStore.getState().doc;
    if (!doc) return;
    const base = fileBase(doc);
    const bundle = exportTexBundle(doc, base);
    await files.save(bundle.data, `${base}.${bundle.extension}`, bundle.mime);
  };

  const exportBackup = async () => {
    const doc = useEditorStore.getState().doc;
    if (!doc) return;
    await files.save(serializeInkCvBackup(doc), `${fileBase(doc)}.inkcv`, 'application/json');
  };

  const texTemplate = useEditorStore((s) => s.doc?.settings.texTemplate ?? 'moderncv-like');
  const zh = i18n.language.toLowerCase().startsWith('zh');

  const items: MenuItem[] = [
    { key: 'pdf', label: t('export.pdf'), testId: 'export-pdf', onSelect: () => void exportPdf() },
    { key: 'md', label: t('export.md'), testId: 'export-md', onSelect: () => void exportMd() },
    { key: 'tex', label: t('export.tex'), testId: 'export-tex', onSelect: () => void exportLatex() },
    { key: 'inkcv', label: t('export.inkcv'), testId: 'export-inkcv', onSelect: () => void exportBackup() },
  ];

  return (
    <DropdownMenu
      align="right"
      items={items}
      trigger={(open) => (
        <div className="ink-export-wrap">
          <button className="ink-btn ink-btn-sm ink-btn-primary" onClick={open}>
            <IconDownload /> {t('preview.export')}
          </button>
          <select
            className="ink-input ink-select-sm ink-tex-select"
            value={texTemplate}
            title={t('export.texTemplate')}
            onChange={(e) =>
              useEditorStore.getState().updateDoc((d) => void (d.settings.texTemplate = e.target.value))
            }
          >
            {texTemplates.map((tp) => (
              <option key={tp.id} value={tp.id}>
                .tex · {zh ? tp.nameZh : tp.nameEn}
              </option>
            ))}
          </select>
        </div>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Theme drawer

function ThemeDrawer(): ReactNode {
  const { t } = useTranslation();
  const doc = useEditorStore((s) => s.doc);
  const updateDoc = useEditorStore((s) => s.updateDoc);
  if (!doc) return null;
  const { tokens, page, locale } = doc.settings;
  const lhMin = locale === 'zh' ? 1.4 : 1.1;
  const activePreset = (Object.keys(RESUME_COLOR_PRESETS) as ResumeColorPresetId[]).find(
    (id) => {
      const preset = RESUME_COLOR_PRESETS[id];
      return tokens.accentColor.toLowerCase() === preset.accentColor
        && tokens.textColor.toLowerCase() === preset.textColor;
    },
  );

  return (
    <div className="ink-theme-drawer">
      <div className="ink-theme-row">
        <label className="ink-theme-field">
          <span>{t('style.font')}</span>
          <select
            className="ink-input ink-select-sm"
            value={tokens.fontFamily}
            onChange={(e) =>
              updateDoc((d) => void (d.settings.tokens.fontFamily = e.target.value as 'sans' | 'serif'))
            }
          >
            <option value="sans">{t('style.fontSans')}</option>
            <option value="serif">{t('style.fontSerif')}</option>
          </select>
        </label>

        <label className="ink-theme-field">
          <span>{t('style.pageSize')}</span>
          <select
            className="ink-input ink-select-sm"
            value={page.size}
            onChange={(e) => updateDoc((d) => void (d.settings.page.size = e.target.value as 'A4' | 'Letter'))}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
        </label>
      </div>

      <Slider label={t('style.fontSize')} min={8} max={14} step={0.5} value={tokens.fontSize} suffix="pt" onChange={(v) => updateDoc((d) => void (d.settings.tokens.fontSize = v))} />
      <Slider label={t('style.lineHeight')} min={lhMin} max={2.2} step={0.05} value={tokens.lineHeight} onChange={(v) => updateDoc((d) => void (d.settings.tokens.lineHeight = v))} />
      <Slider label={t('style.spacing')} min={0.6} max={1.8} step={0.05} value={tokens.spacing} onChange={(v) => updateDoc((d) => void (d.settings.tokens.spacing = v))} />
      <Slider label={t('style.margin')} min={8} max={30} step={1} value={page.margin} suffix="mm" onChange={(v) => updateDoc((d) => void (d.settings.page.margin = v))} />

      <div className="ink-theme-preset-row">
        <span className="ink-theme-preset-label">{t('style.colorPreset')}</span>
        {(Object.keys(RESUME_COLOR_PRESETS) as ResumeColorPresetId[]).map((id) => {
          const preset = RESUME_COLOR_PRESETS[id];
          return (
            <button
              key={id}
              className={`ink-color-preset${activePreset === id ? ' active' : ''}`}
              aria-pressed={activePreset === id}
              onClick={() => updateDoc((draft) => {
                draft.settings.tokens.accentColor = preset.accentColor;
                draft.settings.tokens.textColor = preset.textColor;
              })}
            >
              <span className="ink-color-swatch" style={{ backgroundColor: preset.accentColor }} />
              {t(id === 'black' ? 'style.presetBlack' : 'style.presetBlue')}
            </button>
          );
        })}
        {!activePreset && <span className="ink-custom-color-state">{t('style.presetCustom')}</span>}
      </div>

      <div className="ink-theme-row ink-custom-colors">
        <div className="ink-custom-colors-label">{t('style.customColors')}</div>
        <label className="ink-theme-field">
          <span>{t('style.accent')}</span>
          <input
            type="color"
            className="ink-color"
            value={tokens.accentColor}
            onChange={(e) => updateDoc((d) => void (d.settings.tokens.accentColor = e.target.value))}
          />
        </label>
        <label className="ink-theme-field">
          <span>{t('style.textColor')}</span>
          <input
            type="color"
            className="ink-color"
            value={tokens.textColor}
            onChange={(e) => updateDoc((d) => void (d.settings.tokens.textColor = e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  suffix,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}): ReactNode {
  const clamped = Math.min(max, Math.max(min, value));
  return (
    <label className="ink-slider">
      <span className="ink-slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={clamped} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="ink-slider-val">
        {clamped}
        {suffix ?? ''}
      </span>
    </label>
  );
}
