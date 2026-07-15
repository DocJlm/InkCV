import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
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
  resolveResumeLocale,
  serializeInkCvBackup,
  serializeResumeToMarkdown,
  type ResumeColorPresetId,
  type ResumeDoc,
} from '@inkcv/core';
import { useEditorStore } from '../store';
import { DropdownMenu, IconClose, IconDownload, IconSliders, type MenuItem } from '../primitives';
import { useAppServices } from '../services';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type ZoomMode = 'fit' | number;
const PDF_TO_CSS = 96 / 72;

const TEMPLATE_PREVIEWS = {
  onyx: {
    zh: new URL('../assets/template-previews/onyx-zh.png', import.meta.url).href,
    en: new URL('../assets/template-previews/onyx-en.png', import.meta.url).href,
  },
  lapis: {
    zh: new URL('../assets/template-previews/lapis-zh.png', import.meta.url).href,
    en: new URL('../assets/template-previews/lapis-en.png', import.meta.url).href,
  },
  'minimal-ats': {
    zh: new URL('../assets/template-previews/minimal-ats-zh.png', import.meta.url).href,
    en: new URL('../assets/template-previews/minimal-ats-en.png', import.meta.url).href,
  },
  'compact-tech': {
    zh: new URL('../assets/template-previews/compact-tech-zh.png', import.meta.url).href,
    en: new URL('../assets/template-previews/compact-tech-en.png', import.meta.url).href,
  },
} as const;

const TEMPLATE_DESCRIPTION_KEYS = {
  onyx: 'template.onyx.description',
  lapis: 'template.lapis.description',
  'minimal-ats': 'template.minimalAts.description',
  'compact-tech': 'template.compactTech.description',
} as const;

export function PreviewPane(): ReactNode {
  const { t } = useTranslation();
  const doc = useEditorStore((s) => s.doc);
  const docRevision = useEditorStore((s) => s.docRevision);
  const setPreviewBytes = useEditorStore((s) => s.setPreviewBytes);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const styleButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreenReturnFocusRef = useRef<HTMLElement | null>(null);
  const styleReturnFocusRef = useRef<HTMLElement | null>(null);
  const controllerRef = useRef<PdfPreviewController | null>(null);
  const pendingRevision = useRef(0);
  const freshRevision = useRef(-1);
  const latestDoc = useRef<ResumeDoc | null>(null);
  const fallbackRevision = useRef(-1);
  const rasterRevision = useRef(0);

  const [zoom, setZoom] = useState<ZoomMode>('fit');
  const [availableWidth, setAvailableWidth] = useState(640);
  const [frameBytes, setFrameBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const closeStyle = useCallback(() => setStyleOpen(false), []);

  const pageWidth = (doc?.settings.page.size === 'Letter' ? 612 : 595.28) * PDF_TO_CSS;
  // Fit mode may go below the explicit 50% control on narrow phones so the
  // page truly fits without horizontal scrolling.
  const fitZoom = Math.max(0.25, Math.min(2, (availableWidth - 32) / pageWidth));
  const effectiveZoom = zoom === 'fit' ? fitZoom : zoom;

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const update = () => setAvailableWidth(scroll.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Fullscreen is the top-most layer. Consume Escape here so an open
        // theme drawer underneath is not closed by the same key press.
        event.preventDefault();
        event.stopImmediatePropagation();
        setFullscreen(false);
        requestAnimationFrame(() => fullscreenReturnFocusRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [fullscreen]);

  // Create the controller once.
  useEffect(() => {
    // Paint a compiled frame: mark it fresh, then rasterise onto the canvases.
    const paint = (bytes: Uint8Array, revision: number) => {
      setPreviewBytes(bytes);
      setFrameBytes(bytes);
      setCompiling(false);
      setError(null);
      freshRevision.current = revision;
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

  useEffect(() => {
    const container = containerRef.current;
    if (!frameBytes || !container) return;
    const revision = ++rasterRevision.current;
    const abortController = new AbortController();
    const staging = document.createElement('div');
    void renderPdfToCanvas(frameBytes, staging, {
      scale: PDF_TO_CSS * effectiveZoom,
      signal: abortController.signal,
    })
      .then(() => {
        if (revision !== rasterRevision.current) return;
        container.replaceChildren(...Array.from(staging.childNodes));
        setPageCount(container.childElementCount);
      })
      .catch((value: unknown) => {
        if (!abortController.signal.aborted && revision === rasterRevision.current) {
          setError(value instanceof Error ? value.message : String(value));
        }
      });
    return () => abortController.abort();
  }, [frameBytes, effectiveZoom]);

  const isPreviewFresh = () => freshRevision.current === docRevision;

  return (
    <div className={`ink-preview${fullscreen ? ' ink-preview-fullscreen' : ''}`}>
      <div className="ink-preview-toolbar">
        <TemplateGallery />

        <button className="ink-icon-btn ink-zoom-btn" aria-label={t('preview.zoomOut')} onClick={() => setZoom(previousZoom(effectiveZoom))}>−</button>
        <select
          data-testid="preview-zoom"
          className="ink-input ink-select-sm"
          value={zoom}
          onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
          aria-label={t('preview.zoom')}
        >
          <option value="fit">{t('preview.fit')}</option>
          {ZOOMS.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>
        <button className="ink-icon-btn ink-zoom-btn" aria-label={t('preview.zoomIn')} onClick={() => setZoom(nextZoom(effectiveZoom))}>+</button>
        <button className="ink-btn ink-btn-sm ink-preview-actual" onClick={() => setZoom(1)}>{t('preview.actualSize')}</button>

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

        <div className="ink-preview-secondary">
          <button
            ref={fullscreenButtonRef}
            data-testid="preview-fullscreen"
            className="ink-btn ink-btn-sm"
            aria-pressed={fullscreen}
            onClick={(event) => {
              fullscreenReturnFocusRef.current = event.currentTarget;
              setFullscreen((value) => !value);
            }}
          >
            {fullscreen ? t('preview.exitFullscreen') : t('preview.fullscreen')}
          </button>

          <button
            ref={styleButtonRef}
            data-testid="style-toggle"
            className={`ink-btn ink-btn-sm${styleOpen ? ' active' : ''}`}
            aria-expanded={styleOpen}
            aria-controls="ink-theme-drawer"
            onClick={(event) => {
              styleReturnFocusRef.current = event.currentTarget;
              setStyleOpen((v) => !v);
            }}
          >
            <IconSliders /> {t('preview.style')}
          </button>
        </div>

        <div className="ink-preview-more">
          <DropdownMenu
            align="right"
            trigger={(open, isOpen) => (
              <button
                ref={mobileMoreButtonRef}
                className="ink-icon-btn"
                aria-label={t('common.moreActions')}
                aria-expanded={isOpen}
                onClick={open}
              >
                ⋯
              </button>
            )}
            items={[
              {
                key: 'fullscreen',
                label: fullscreen ? t('preview.exitFullscreen') : t('preview.fullscreen'),
                onSelect: () => {
                  fullscreenReturnFocusRef.current = mobileMoreButtonRef.current;
                  setFullscreen((value) => !value);
                },
              },
              {
                key: 'style',
                label: t('preview.style'),
                onSelect: () => {
                  styleReturnFocusRef.current = mobileMoreButtonRef.current;
                  setStyleOpen(true);
                },
              },
            ]}
          />
        </div>

        <ExportMenu isPreviewFresh={isPreviewFresh} />
      </div>

      {styleOpen && <ThemeDrawer onClose={closeStyle} returnFocus={styleReturnFocusRef} />}

      <div className="ink-preview-scroll" ref={scrollRef}>
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
            '--ink-desktop-preview-width': `${Math.round(effectiveZoom * pageWidth)}px`,
            '--ink-mobile-preview-width': `${Math.round(effectiveZoom * pageWidth)}px`,
          } as CSSProperties}
        />
      </div>
    </div>
  );
}

function previousZoom(current: number): number {
  return [...ZOOMS].reverse().find((value) => value < current - 0.01) ?? ZOOMS[0]!;
}

function nextZoom(current: number): number {
  return ZOOMS.find((value) => value > current + 0.01) ?? ZOOMS[ZOOMS.length - 1]!;
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
  const uiZh = i18n.language.toLowerCase().startsWith('zh');
  const resumeDoc = useEditorStore((state) => state.doc);
  const documentLocale = resumeDoc ? resolveResumeLocale(resumeDoc) : 'zh';
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
    const columns = Math.max(1, getComputedStyle(event.currentTarget).gridTemplateColumns.split(' ').length);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % cards.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + cards.length) % cards.length;
    else if (event.key === 'ArrowDown') next = (index + columns) % cards.length;
    else if (event.key === 'ArrowUp') next = (index - columns + cards.length) % cards.length;
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
        <strong>{localeName(current, uiZh)}</strong>
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
              const selected = template.id === current.id;
              const preview = TEMPLATE_PREVIEWS[template.id][documentLocale];
              return (
                <button
                  data-testid={`template-${template.id}`}
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
                    <strong>{localeName(template, uiZh)}</strong>
                    <small>{t(TEMPLATE_DESCRIPTION_KEYS[template.id])}</small>
                    <span className="ink-template-tags" aria-hidden="true">
                      <span>{uiZh ? template.layoutZh : template.layoutEn}</span>
                      <span>{t(`templateGallery.density.${template.density}`)}</span>
                      {template.atsFriendly && <span>ATS</span>}
                      {template.photoTreatment === 'portrait' && <span>{t('templateGallery.photo')}</span>}
                      <span>{t(documentLocale === 'zh' ? 'templateGallery.sampleZh' : 'templateGallery.sampleEn')}</span>
                    </span>
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

  const exportLatex = async (templateId: string) => {
    const doc = useEditorStore.getState().doc;
    if (!doc) return;
    const base = fileBase(doc);
    const exportDoc = { ...doc, settings: { ...doc.settings, texTemplate: templateId } };
    useEditorStore.getState().updateDoc((draft) => void (draft.settings.texTemplate = templateId));
    const bundle = exportTexBundle(exportDoc, base);
    await files.save(bundle.data, `${base}.${bundle.extension}`, bundle.mime);
  };

  const exportBackup = async () => {
    const doc = useEditorStore.getState().doc;
    if (!doc) return;
    await files.save(serializeInkCvBackup(doc), `${fileBase(doc)}.inkcv`, 'application/json');
  };

  const zh = i18n.language.toLowerCase().startsWith('zh');

  const items: MenuItem[] = [
    { key: 'pdf', label: t('export.pdf'), testId: 'export-pdf', onSelect: () => void exportPdf() },
    { key: 'md', label: t('export.md'), testId: 'export-md', onSelect: () => void exportMd() },
    ...texTemplates.map((template) => ({
      key: `tex-${template.id}`,
      label: t('export.texWith', { name: zh ? template.nameZh : template.nameEn }),
      testId: template.id === 'moderncv-like' ? 'export-tex' : `export-tex-${template.id}`,
      onSelect: () => void exportLatex(template.id),
    })),
    { key: 'inkcv', label: t('export.inkcv'), testId: 'export-inkcv', onSelect: () => void exportBackup() },
  ];

  return (
    <DropdownMenu
      align="right"
      items={items}
      trigger={(open) => (
        <button data-testid="export-menu" className="ink-btn ink-btn-sm ink-btn-primary" onClick={open}>
          <IconDownload /> {t('preview.export')}
        </button>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Theme drawer

function ThemeDrawer({
  onClose,
  returnFocus,
}: {
  onClose: () => void;
  returnFocus: { current: HTMLElement | null };
}): ReactNode {
  const { t } = useTranslation();
  const doc = useEditorStore((s) => s.doc);
  const updateDoc = useEditorStore((s) => s.updateDoc);
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        returnFocus.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const frame = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('button, select, input')?.focus());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, returnFocus]);
  if (!doc) return null;
  const { tokens, page, localeMode } = doc.settings;
  const resolvedLocale = resolveResumeLocale(doc);
  const lhMin = resolvedLocale === 'zh' ? 1.4 : 1.1;
  const activePreset = (Object.keys(RESUME_COLOR_PRESETS) as ResumeColorPresetId[]).find(
    (id) => {
      const preset = RESUME_COLOR_PRESETS[id];
      return tokens.accentColor.toLowerCase() === preset.accentColor
        && tokens.textColor.toLowerCase() === preset.textColor;
    },
  );

  return (
    <>
      <button className="ink-theme-backdrop" aria-label={t('common.close')} onClick={onClose} />
      <div
        id="ink-theme-drawer"
        ref={drawerRef}
        className="ink-theme-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('style.title')}
        data-testid="style-drawer"
      >
      <header className="ink-theme-head">
        <strong>{t('style.title')}</strong>
        <button className="ink-icon-btn" aria-label={t('common.close')} onClick={() => {
          onClose();
          returnFocus.current?.focus();
        }}><IconClose /></button>
      </header>
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
              data-testid={`color-${id}`}
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
      <label className="ink-theme-field ink-language-mode">
        <span>{t('style.languageMode')}</span>
        <select
          data-testid="locale-mode"
          className="ink-input ink-select-sm"
          value={localeMode}
          onChange={(event) => updateDoc((draft) => {
            draft.settings.localeMode = event.target.value as 'auto' | 'zh' | 'en';
          })}
        >
          <option value="auto">{t('style.languageAuto')}</option>
          <option value="zh">{t('documentLanguage.zh')}</option>
          <option value="en">{t('documentLanguage.en')}</option>
        </select>
        <small>{t('style.languageHint')}</small>
      </label>
      </div>
    </>
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
