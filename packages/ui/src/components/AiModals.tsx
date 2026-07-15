import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PROVIDER_PRESETS,
  AiError,
  textToResumeDraft,
  draftToDoc,
  polishBullets,
  type AiConfig,
} from '@inkcv/ai';
import { isFreeform, type ResumeDoc } from '@inkcv/core';
import { useAppServices } from '../services';
import { useEditorStore } from '../store';
import { Modal, IconSparkles } from '../primitives';

// ---------------------------------------------------------------------------
// Shared error mapping

function useAiErrorText(): (err: unknown) => string {
  const { t } = useTranslation();
  return (err: unknown) => {
    if (err instanceof AiError) {
      if (err.kind === 'auth') return t('ai.errorAuth');
      if (err.kind === 'network') return t('ai.errorNetwork');
      return t('ai.errorGeneric', { msg: err.message });
    }
    return t('ai.errorGeneric', { msg: err instanceof Error ? err.message : String(err) });
  };
}

// ---------------------------------------------------------------------------
// Settings

export function AiSettingsModal({ onClose }: { onClose: () => void }): ReactNode {
  const { t } = useTranslation();
  const { aiCredentials, credentialPersistence } = useAppServices();
  const existing = aiCredentials.get();
  const existingProfile = aiCredentials.getProfile();
  const initialPreset =
    existingProfile?.providerId ??
    PROVIDER_PRESETS.find((p) => p.baseUrl === existingProfile?.baseUrl)?.id ??
    (existingProfile ? 'custom' : 'openai');

  const [presetId, setPresetId] = useState(initialPreset);
  const [kind, setKind] = useState<AiConfig['kind']>(existingProfile?.kind ?? 'openai-compatible');
  const [baseUrl, setBaseUrl] = useState(existingProfile?.baseUrl ?? PROVIDER_PRESETS[0]!.baseUrl);
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [model, setModel] = useState(existingProfile?.model ?? PROVIDER_PRESETS[0]!.defaultModel);

  const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);

  const applyPreset = (id: string) => {
    setPresetId(id);
    const p = PROVIDER_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setKind(p.kind);
    if (p.id !== 'custom') {
      setBaseUrl(p.baseUrl);
      setModel(p.defaultModel);
    }
  };

  const save = () => {
    void aiCredentials.set({ providerId: presetId, kind, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() });
    onClose();
  };

  const clear = () => {
    void aiCredentials.set(null);
    onClose();
  };

  const canSave = baseUrl.trim() !== '' && apiKey.trim() !== '' && model.trim() !== '';

  return (
    <Modal
      title={t('ai.settingsTitle')}
      onClose={onClose}
      footer={
        <>
          {existingProfile && (
            <button className="ink-btn ink-btn-ghost danger" onClick={clear}>
              {t('ai.clear')}
            </button>
          )}
          <div className="ink-spacer" />
          <button className="ink-btn ink-btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button data-testid="ai-settings-save" className="ink-btn ink-btn-primary" onClick={save} disabled={!canSave}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <p className="ink-modal-intro">
        {t(credentialPersistence === 'memory' ? 'ai.settingsIntroWeb' : 'ai.settingsIntroDesktop')}
      </p>
      {credentialPersistence === 'session-fallback' && (
        <div className="ink-inline-error">{t('ai.keyringFallback')}</div>
      )}

      <label className="ink-field">
        <span className="ink-field-label">{t('ai.provider')}</span>
        <select data-testid="ai-provider" className="ink-input" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="ink-field">
        <span className="ink-field-label">{t('ai.baseUrl')}</span>
        <input data-testid="ai-base-url" className="ink-input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
      </label>

      <label className="ink-field">
        <span className="ink-field-label">{t('ai.apiKey')}</span>
        <input
          data-testid="ai-api-key"
          className="ink-input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={preset?.keyHint ?? 'sk-...'}
          autoComplete="off"
        />
      </label>

      <label className="ink-field">
        <span className="ink-field-label">{t('ai.model')}</span>
        <input data-testid="ai-model" className="ink-input" value={model} onChange={(e) => setModel(e.target.value)} placeholder={preset?.defaultModel} />
      </label>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Smart import

export function AiImportModal({
  onClose,
  onReplace,
}: {
  onClose: () => void;
  onReplace: (doc: ResumeDoc) => void;
}): ReactNode {
  const { t } = useTranslation();
  const { aiCredentials, aiTransport } = useAppServices();
  const errText = useAiErrorText();
  const currentDoc = useEditorStore((s) => s.doc);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeDoc | null>(null);

  const convert = async () => {
    const cfg = aiCredentials.get();
    if (!cfg) {
      setError(t('ai.notConfigured'));
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const draft = await textToResumeDraft(cfg, text, aiTransport);
      const doc = draftToDoc(draft, currentDoc ?? undefined);
      setResult(doc);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('ai.importTitle')}
      onClose={onClose}
      wide
      footer={
        result ? (
          <>
            <div className="ink-spacer" />
            <button className="ink-btn ink-btn-ghost" onClick={() => setResult(null)}>
              {t('common.cancel')}
            </button>
            <button
              data-testid="ai-import-replace"
              className="ink-btn ink-btn-primary"
              onClick={() => {
                onReplace(result);
                onClose();
              }}
            >
              {t('ai.replace')}
            </button>
          </>
        ) : (
          <>
            <div className="ink-spacer" />
            <button className="ink-btn ink-btn-ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button data-testid="ai-import-convert" className="ink-btn ink-btn-primary" onClick={convert} disabled={busy || text.trim() === ''}>
              {busy ? (
                <>
                  <span className="ink-spinner" /> {t('ai.converting')}
                </>
              ) : (
                <>
                  <IconSparkles /> {t('ai.convert')}
                </>
              )}
            </button>
          </>
        )
      }
    >
      {!result && (
        <>
          <p className="ink-modal-intro">{t('ai.importIntro')}</p>
          <textarea
            data-testid="ai-import-text"
            className="ink-input ink-import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('ai.importPlaceholder')}
            disabled={busy}
          />
        </>
      )}

      {result && (
        <div className="ink-import-summary">
          <div className="ink-summary-row">
            <IconSparkles size={16} />
            <span>{t('ai.summarySections', { count: result.sections.length })}</span>
          </div>
          <div className="ink-summary-row">
            {result.basics.name
              ? t('ai.summaryName', { name: result.basics.name })
              : t('ai.summaryNoName')}
          </div>
          <ul className="ink-summary-list">
            {result.sections.map((s) => (
              <li key={s.id}>
                <span className="ink-badge">{t(`kind.${s.kind}`)}</span> {s.title}
                {!isFreeform(s) && <em className="ink-summary-count"> · {s.entries.length}</em>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="ink-inline-error">{error}</div>}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bullet polish

export function AiPolishModal({
  sectionId,
  entryId,
  onClose,
}: {
  sectionId: string;
  entryId: string;
  onClose: () => void;
}): ReactNode {
  const { t } = useTranslation();
  const { aiCredentials, aiTransport } = useAppServices();
  const errText = useAiErrorText();
  const doc = useEditorStore((s) => s.doc);
  const updateDoc = useEditorStore((s) => s.updateDoc);

  const entry = useMemo(() => {
    const section = doc?.sections.find((s) => s.id === sectionId);
    if (!section || isFreeform(section)) return null;
    return section.entries.find((e) => e.id === entryId) ?? null;
  }, [doc, sectionId, entryId]);

  const original = entry?.bullets ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polished, setPolished] = useState<string[] | null>(null);

  const run = async () => {
    const cfg = aiCredentials.get();
    if (!cfg || !doc) {
      setError(t('ai.notConfigured'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await polishBullets(cfg, {
        bullets: original,
        role: entry?.secondary ?? '',
        locale: doc.settings.locale,
      }, aiTransport);
      setPolished(out);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!polished) return;
    updateDoc((d) => {
      const s = d.sections.find((x) => x.id === sectionId);
      if (!s || isFreeform(s)) return;
      const e = s.entries.find((x) => x.id === entryId);
      if (e) e.bullets = polished;
    });
    onClose();
  };

  return (
    <Modal
      title={t('ai.polishTitle')}
      onClose={onClose}
      wide
      footer={
        <>
          <div className="ink-spacer" />
          <button className="ink-btn ink-btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          {polished ? (
            <button data-testid="ai-polish-apply" className="ink-btn ink-btn-primary" onClick={apply}>
              {t('common.apply')}
            </button>
          ) : (
            <button data-testid="ai-polish-run" className="ink-btn ink-btn-primary" onClick={run} disabled={busy || original.length === 0}>
              {busy ? (
                <>
                  <span className="ink-spinner" /> {t('ai.polishing')}
                </>
              ) : (
                <>
                  <IconSparkles /> {t('entry.aiPolish')}
                </>
              )}
            </button>
          )}
        </>
      }
    >
      {original.length === 0 ? (
        <p className="ink-modal-intro">{t('ai.needBullets')}</p>
      ) : (
        <ol className="ink-diff">
          {original.map((before, i) => {
            const after = polished?.[i];
            return (
              <li key={i} className="ink-diff-item">
                <div className="ink-diff-before">
                  <span className="ink-diff-tag">{t('ai.before')}</span>
                  {before}
                </div>
                {polished && (
                  <div className={`ink-diff-after${after === before ? ' same' : ''}`}>
                    <span className="ink-diff-tag">{t('ai.after')}</span>
                    {after === before ? <em>{t('ai.noChange')}</em> : after}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {error && <div className="ink-inline-error">{error}</div>}
    </Modal>
  );
}
