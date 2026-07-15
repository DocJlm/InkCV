import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { setLang, type Lang } from '../i18n';
import {
  DropdownMenu,
  IconCopy,
  IconGithub,
  IconGlobe,
  IconMore,
  IconPlus,
  IconSparkles,
  IconImport,
  IconInfo,
  IconTrash,
  useAiConfigured,
  type MenuItem,
} from '../primitives';
import type { DocMeta } from '../types';
import { useAppServices } from '../services';

const GITHUB_URL = 'https://github.com/DocJlm/InkCV';

export function LeftRail({
  docs,
  currentId,
  currentName,
  lang,
  onOpen,
  onNew,
  onDuplicate,
  onDelete,
  onOpenAiSettings,
  onOpenImport,
  onImportBackup,
  onOpenAbout,
}: {
  docs: DocMeta[];
  currentId: string | null;
  currentName: string;
  lang: Lang;
  onOpen: (id: string) => void;
  onNew: (kind: 'zh' | 'en' | 'blank') => void;
  onDuplicate: (id: string) => void;
  onDelete: (meta: DocMeta) => void;
  onOpenAiSettings: () => void;
  onOpenImport: () => void;
  onImportBackup: () => void;
  onOpenAbout: () => void;
}): ReactNode {
  const { t } = useTranslation();
  const { openExternal } = useAppServices();
  const aiOn = useAiConfigured();

  const newItems: MenuItem[] = [
    { key: 'zh', label: t('nav.newZh'), onSelect: () => onNew('zh') },
    { key: 'en', label: t('nav.newEn'), onSelect: () => onNew('en') },
    { key: 'blank', label: t('nav.newBlank'), onSelect: () => onNew('blank') },
  ];

  return (
    <aside className="ink-rail">
      <div className="ink-brand">
        <span className="ink-logo" aria-hidden="true">墨</span>
        <div className="ink-brand-text">
          <strong>{t('app.name')}</strong>
          <small>{t('app.nameZh') === 'InkCV' ? t('app.tagline') : t('app.nameZh')}</small>
        </div>
      </div>

      <div className="ink-rail-actions">
        <DropdownMenu
          items={newItems}
          trigger={(open) => (
            <button data-testid="new-resume" className="ink-btn ink-btn-primary ink-btn-block" onClick={open}>
              <IconPlus /> {t('nav.new')}
            </button>
          )}
        />
        <button className="ink-btn ink-btn-block" data-testid="ai-import" onClick={onOpenImport}>
          <IconSparkles /> {t('nav.import')}
        </button>
        <button className="ink-btn ink-btn-block" data-testid="backup-import" onClick={onImportBackup}>
          <IconImport /> {t('nav.importBackup')}
        </button>
      </div>

      <div className="ink-rail-list-head">{t('nav.resumes')}</div>
      <nav className="ink-rail-list">
        {docs.map((meta) => {
          const active = meta.id === currentId;
          const name = (active ? currentName : meta.name) || t('doc.untitled');
          return (
            <div key={meta.id} className={`ink-doc-item${active ? ' active' : ''}`}>
              <button className="ink-doc-open" onClick={() => onOpen(meta.id)} title={name}>
                <span className="ink-doc-name">{name}</span>
                <span className="ink-doc-date">{formatDate(meta.updatedAt)}</span>
              </button>
              <DropdownMenu
                align="left"
                items={[
                  { key: 'dup', label: t('menu.duplicate'), icon: <IconCopy />, onSelect: () => onDuplicate(meta.id) },
                  { key: 'del', label: t('menu.delete'), icon: <IconTrash />, danger: true, onSelect: () => onDelete(meta) },
                ]}
                trigger={(open, isOpen) => (
                  <button className={`ink-icon-btn ink-doc-more${isOpen ? ' active' : ''}`} onClick={open} aria-label="more">
                    <IconMore />
                  </button>
                )}
              />
            </div>
          );
        })}
      </nav>

      <div className="ink-rail-foot">
        <div className="ink-lang-toggle" role="group" aria-label={t('nav.language')}>
          <IconGlobe />
          <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>
            中
          </button>
          <span className="ink-lang-sep">/</span>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
        <button data-testid="ai-settings" className={`ink-btn ink-btn-ghost ink-btn-sm ink-btn-block${aiOn ? ' ai-on' : ''}`} onClick={onOpenAiSettings}>
          <IconSparkles /> {t('nav.aiSettings')}
          {aiOn && <span className="ink-dot" aria-hidden="true" />}
        </button>
        <button className="ink-btn ink-btn-ghost ink-btn-sm ink-btn-block" onClick={() => void openExternal(GITHUB_URL)}>
          <IconGithub /> {t('nav.github')}
        </button>
        <button className="ink-btn ink-btn-ghost ink-btn-sm ink-btn-block" onClick={onOpenAbout}>
          <IconInfo /> {t('nav.about')}
        </button>
      </div>
    </aside>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  const day = 86_400_000;
  if (diff < day && d.getDate() === new Date().getDate()) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
