import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  newId,
  isFreeform,
  STRUCTURED_KINDS,
  type ResumeDoc,
  type Section,
  type StructuredSection,
  type Entry,
  type StructuredKind,
} from '@inkcv/core';
import { useEditorStore } from '../store';
import {
  AutoTextarea,
  DropdownMenu,
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSparkles,
  IconTrash,
  useAiConfigured,
  type MenuItem,
} from '../primitives';
import { AiPolishModal } from './AiModals';
import { PhotoCropModal } from './PhotoCropModal';
import { useAppServices } from '../services';

const CONTACT_TYPES = ['email', 'phone', 'github', 'wechat', 'url', 'custom'] as const;
const NEW_SECTION_KINDS = [...STRUCTURED_KINDS, 'freeform'] as const;

type Mutate = (mutate: (draft: ResumeDoc) => void) => void;

// ---------------------------------------------------------------------------

export function FormEditor(): ReactNode {
  const doc = useEditorStore((s) => s.doc);
  const updateDoc = useEditorStore((s) => s.updateDoc);
  const { t } = useTranslation();
  const [polish, setPolish] = useState<{ sectionId: string; entryId: string } | null>(null);

  if (!doc) return null;

  const addSection = (kind: StructuredKind | 'freeform') => {
    updateDoc((d) => {
      const title = t(`newSection.${kind}`);
      if (kind === 'freeform') {
        d.sections.push({ id: newId(), kind: 'freeform', title, visible: true, markdown: '' });
      } else {
        d.sections.push({ id: newId(), kind, title, visible: true, entries: [] });
      }
    });
  };

  return (
    <div className="ink-form">
      <BasicsCard doc={doc} updateDoc={updateDoc} />

      {doc.sections.map((section, idx) => (
        <SectionCard
          key={section.id}
          section={section}
          index={idx}
          total={doc.sections.length}
          updateDoc={updateDoc}
          onPolish={(entryId) => setPolish({ sectionId: section.id, entryId })}
        />
      ))}

      <DropdownMenu
        align="left"
        items={NEW_SECTION_KINDS.map<MenuItem>((k) => ({
          key: k,
          label: t(`newSection.${k}`),
          onSelect: () => addSection(k),
        }))}
        trigger={(open) => (
          <button className="ink-btn ink-btn-dashed ink-add-section" onClick={open}>
            <IconPlus /> {t('section.add')}
          </button>
        )}
      />

      {polish && (
        <AiPolishModal
          sectionId={polish.sectionId}
          entryId={polish.entryId}
          onClose={() => setPolish(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Basics

function BasicsCard({ doc, updateDoc }: { doc: ResumeDoc; updateDoc: Mutate }): ReactNode {
  const { t } = useTranslation();
  const { files } = useAppServices();
  const [open, setOpen] = useState(true);
  const [photoSource, setPhotoSource] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const b = doc.basics;

  return (
    <section className="ink-card">
      <CardHeader open={open} onToggle={() => setOpen((v) => !v)} title={t('basics.title')} />
      {open && (
        <div className="ink-card-body">
          <Field label={t('basics.name')}>
            <input
              data-testid="basics-name"
              className="ink-input"
              value={b.name}
              placeholder={t('basics.namePlaceholder')}
              onChange={(e) => updateDoc((d) => void (d.basics.name = e.target.value))}
            />
          </Field>
          <Field label={t('basics.headline')}>
            <input
              data-testid="basics-headline"
              className="ink-input"
              value={b.headline ?? ''}
              placeholder={t('basics.headlinePlaceholder')}
              onChange={(e) => updateDoc((d) => void (d.basics.headline = e.target.value))}
            />
          </Field>

          <Field label={t('basics.photo')}>
            <div className="ink-photo-field">
              {b.photo?.src && <img className="ink-photo-thumb" src={b.photo.src} alt="" />}
              <div className="ink-row ink-photo-controls">
              <input
                data-testid="photo-url"
                className="ink-input"
                value={b.photo?.src ?? ''}
                placeholder={t('basics.photoPlaceholder')}
                onChange={(e) =>
                  updateDoc((d) => {
                    const src = e.target.value;
                    if (src === '') delete d.basics.photo;
                    else d.basics.photo = { src, visible: d.basics.photo?.visible ?? true };
                  })
                }
              />
              <button
                data-testid="photo-upload"
                type="button"
                className="ink-btn ink-btn-sm"
                onClick={() => {
                  void files.pickImage(10 * 1024 * 1024).then((selected) => {
                    if (!selected) return;
                    setPhotoError(null);
                    setPhotoSource(selected.dataUrl);
                  }).catch((error: unknown) => {
                    setPhotoError(error instanceof Error && error.message === 'file_too_large'
                      ? t('basics.photoFileTooLarge')
                      : t('basics.photoDecodeError'));
                  });
                }}
              >
                {b.photo?.src ? t('basics.photoChange') : t('basics.photoUpload')}
              </button>
              {b.photo && (
                <VisibilityToggle
                  visible={b.photo.visible}
                  onToggle={() =>
                    updateDoc((d) => {
                      if (d.basics.photo) d.basics.photo.visible = !d.basics.photo.visible;
                    })
                  }
                />
              )}
              {b.photo && (
                <button className="ink-btn ink-btn-sm ink-btn-ghost danger" onClick={() => updateDoc((d) => void delete d.basics.photo)}>
                  {t('basics.photoRemove')}
                </button>
              )}
              </div>
              {photoError && <div className="ink-inline-error">{photoError}</div>}
            </div>
          </Field>

          {/* Contacts */}
          <div className="ink-subhead">{t('basics.contacts')}</div>
          <div className="ink-list">
            {b.contacts.map((c) => (
              <div className="ink-row" key={c.id}>
                <select
                  className="ink-input ink-select-sm"
                  value={CONTACT_TYPES.includes(c.type as (typeof CONTACT_TYPES)[number]) ? c.type : 'custom'}
                  onChange={(e) =>
                    updateDoc((d) => {
                      const ct = d.basics.contacts.find((x) => x.id === c.id);
                      if (ct) ct.type = e.target.value;
                    })
                  }
                >
                  {CONTACT_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`contact.${ty}`)}
                    </option>
                  ))}
                </select>
                <input
                  className="ink-input"
                  value={c.value}
                  placeholder={t('basics.valuePlaceholder')}
                  onChange={(e) =>
                    updateDoc((d) => {
                      const ct = d.basics.contacts.find((x) => x.id === c.id);
                      if (ct) ct.value = e.target.value;
                    })
                  }
                />
                <VisibilityToggle
                  visible={c.visible}
                  onToggle={() =>
                    updateDoc((d) => {
                      const ct = d.basics.contacts.find((x) => x.id === c.id);
                      if (ct) ct.visible = !ct.visible;
                    })
                  }
                />
                <IconBtn label={t('common.delete')} danger onClick={() => updateDoc((d) => void (d.basics.contacts = d.basics.contacts.filter((x) => x.id !== c.id)))}>
                  <IconTrash />
                </IconBtn>
              </div>
            ))}
          </div>
          <button
            className="ink-btn ink-btn-ghost ink-btn-sm"
            onClick={() =>
              updateDoc((d) =>
                void d.basics.contacts.push({ id: newId(), type: 'email', value: '', visible: true }),
              )
            }
          >
            <IconPlus /> {t('basics.addContact')}
          </button>

          {/* Custom fields */}
          <div className="ink-subhead">{t('basics.customFields')}</div>
          <div className="ink-list">
            {b.customFields.map((f) => (
              <div className="ink-row" key={f.id}>
                <input
                  className="ink-input ink-input-narrow"
                  value={f.label}
                  placeholder={t('basics.fieldLabel')}
                  onChange={(e) =>
                    updateDoc((d) => {
                      const cf = d.basics.customFields.find((x) => x.id === f.id);
                      if (cf) cf.label = e.target.value;
                    })
                  }
                />
                <input
                  className="ink-input"
                  value={f.value}
                  placeholder={t('basics.fieldValue')}
                  onChange={(e) =>
                    updateDoc((d) => {
                      const cf = d.basics.customFields.find((x) => x.id === f.id);
                      if (cf) cf.value = e.target.value;
                    })
                  }
                />
                <IconBtn label={t('common.delete')} danger onClick={() => updateDoc((d) => void (d.basics.customFields = d.basics.customFields.filter((x) => x.id !== f.id)))}>
                  <IconTrash />
                </IconBtn>
              </div>
            ))}
          </div>
          <button
            className="ink-btn ink-btn-ghost ink-btn-sm"
            onClick={() => updateDoc((d) => void d.basics.customFields.push({ id: newId(), label: '', value: '' }))}
          >
            <IconPlus /> {t('basics.addCustomField')}
          </button>
        </div>
      )}
      {photoSource && (
        <PhotoCropModal
          sourceUrl={photoSource}
          onClose={() => setPhotoSource(null)}
          onConfirm={(dataUrl) => {
            updateDoc((d) => void (d.basics.photo = { src: dataUrl, visible: true }));
            setPhotoSource(null);
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section card

function SectionCard({
  section,
  index,
  total,
  updateDoc,
  onPolish,
}: {
  section: Section;
  index: number;
  total: number;
  updateDoc: Mutate;
  onPolish: (entryId: string) => void;
}): ReactNode {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const move = (dir: -1 | 1) =>
    updateDoc((d) => {
      const i = d.sections.findIndex((s) => s.id === section.id);
      const j = i + dir;
      const a = d.sections[i];
      const b = d.sections[j];
      if (i < 0 || !a || !b) return;
      d.sections[i] = b;
      d.sections[j] = a;
    });

  const patch = (fn: (s: Section) => void) =>
    updateDoc((d) => {
      const s = d.sections.find((x) => x.id === section.id);
      if (s) fn(s);
    });

  return (
    <section className={`ink-card${section.visible ? '' : ' ink-hidden-section'}`}>
      <header className="ink-card-head ink-section-head">
        <button className="ink-collapse" onClick={() => setOpen((v) => !v)} aria-label={t(open ? 'common.collapse' : 'common.expand')}>
          {open ? <IconChevronDown /> : <IconChevronRight />}
        </button>
        <input
          className="ink-title-input"
          value={section.title}
          placeholder={t('section.titlePlaceholder')}
          onChange={(e) => patch((s) => void (s.title = e.target.value))}
        />
        <span className="ink-badge">{t(`kind.${section.kind}`)}</span>
        <div className="ink-section-actions">
          <IconBtn label={t('section.moveUp')} disabled={index === 0} onClick={() => move(-1)}>
            <IconArrowUp />
          </IconBtn>
          <IconBtn label={t('section.moveDown')} disabled={index === total - 1} onClick={() => move(1)}>
            <IconArrowDown />
          </IconBtn>
          <VisibilityToggle visible={section.visible} onToggle={() => patch((s) => void (s.visible = !s.visible))} />
          <IconBtn label={t('section.delete')} danger onClick={() => updateDoc((d) => void (d.sections = d.sections.filter((x) => x.id !== section.id)))}>
            <IconTrash />
          </IconBtn>
        </div>
      </header>

      {open && (
        <div className="ink-card-body">
          {isFreeform(section) ? (
            <AutoTextarea
              className="ink-input ink-freeform"
              value={section.markdown}
              placeholder={t('section.freeformPlaceholder')}
              onChange={(e) => patch((s) => { if (isFreeform(s)) s.markdown = e.target.value; })}
            />
          ) : (
            <StructuredBody section={section} updateDoc={updateDoc} onPolish={onPolish} />
          )}
        </div>
      )}
    </section>
  );
}

function StructuredBody({
  section,
  updateDoc,
  onPolish,
}: {
  section: StructuredSection;
  updateDoc: Mutate;
  onPolish: (entryId: string) => void;
}): ReactNode {
  const { t } = useTranslation();

  const addEntry = () =>
    updateDoc((d) => {
      const s = d.sections.find((x) => x.id === section.id);
      if (s && !isFreeform(s)) s.entries.push({ id: newId(), tags: [], bullets: [], visible: true, extra: {} });
    });

  return (
    <>
      {section.entries.length === 0 && <p className="ink-empty">{t('section.empty')}</p>}
      {section.entries.map((entry, i) => (
        <EntryEditor
          key={entry.id}
          sectionId={section.id}
          entry={entry}
          index={i}
          total={section.entries.length}
          updateDoc={updateDoc}
          onPolish={() => onPolish(entry.id)}
        />
      ))}
      <button className="ink-btn ink-btn-ghost ink-btn-sm" onClick={addEntry}>
        <IconPlus /> {t('section.addEntry')}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Entry editor

function EntryEditor({
  sectionId,
  entry,
  index,
  total,
  updateDoc,
  onPolish,
}: {
  sectionId: string;
  entry: Entry;
  index: number;
  total: number;
  updateDoc: Mutate;
  onPolish: () => void;
}): ReactNode {
  const { t } = useTranslation();
  const aiOn = useAiConfigured();

  // Mutate this specific entry by id.
  const patch = (fn: (e: Entry) => void) =>
    updateDoc((d) => {
      const s = d.sections.find((x) => x.id === sectionId);
      if (!s || isFreeform(s)) return;
      const e = s.entries.find((x) => x.id === entry.id);
      if (e) fn(e);
    });

  const moveEntry = (dir: -1 | 1) =>
    updateDoc((d) => {
      const s = d.sections.find((x) => x.id === sectionId);
      if (!s || isFreeform(s)) return;
      const i = s.entries.findIndex((x) => x.id === entry.id);
      const j = i + dir;
      const a = s.entries[i];
      const b = s.entries[j];
      if (i < 0 || !a || !b) return;
      s.entries[i] = b;
      s.entries[j] = a;
    });

  const removeEntry = () =>
    updateDoc((d) => {
      const s = d.sections.find((x) => x.id === sectionId);
      if (s && !isFreeform(s)) s.entries = s.entries.filter((x) => x.id !== entry.id);
    });

  const field = (key: 'primary' | 'secondary' | 'location' | 'start' | 'end' | 'url', value: string) =>
    patch((e) => {
      const rec = e as unknown as Record<string, string | undefined>;
      if (value === '') delete rec[key];
      else rec[key] = value;
    });

  return (
    <div className={`ink-entry${entry.visible ? '' : ' ink-hidden-entry'}`}>
      <div className="ink-entry-grid">
        <input className="ink-input" value={entry.primary ?? ''} placeholder={t('entry.primary')} onChange={(e) => field('primary', e.target.value)} />
        <input className="ink-input" value={entry.secondary ?? ''} placeholder={t('entry.secondary')} onChange={(e) => field('secondary', e.target.value)} />
        <input className="ink-input" value={entry.location ?? ''} placeholder={t('entry.location')} onChange={(e) => field('location', e.target.value)} />
        <input className="ink-input" value={entry.start ?? ''} placeholder={t('entry.start') + ' ' + t('entry.datePlaceholder')} onChange={(e) => field('start', e.target.value)} />
        <input className="ink-input" value={entry.end ?? ''} placeholder={t('entry.end') + ' / ' + t('entry.present')} onChange={(e) => field('end', e.target.value)} />
        <input className="ink-input" value={entry.url ?? ''} placeholder={t('entry.url')} onChange={(e) => field('url', e.target.value)} />
      </div>

      <input
        className="ink-input ink-tags"
        value={entry.tags.join(', ')}
        placeholder={t('entry.tagsPlaceholder')}
        onChange={(e) =>
          patch((en) => {
            en.tags = e.target.value.split(',').map((s) => s.trim()).filter((s) => s !== '');
          })
        }
      />

      {/* Bullets */}
      <div className="ink-bullets">
        {entry.bullets.map((bullet, bi) => (
          <div className="ink-bullet-row" key={bi}>
            <span className="ink-bullet-dot">•</span>
            <AutoTextarea
              className="ink-input ink-bullet-input"
              value={bullet}
              placeholder={t('entry.bulletPlaceholder')}
              onChange={(e) =>
                patch((en) => {
                  en.bullets[bi] = e.target.value;
                })
              }
            />
            <div className="ink-bullet-actions">
              <IconBtn label={t('entry.moveBulletUp')} disabled={bi === 0} onClick={() => patch((en) => swap(en.bullets, bi, bi - 1))}>
                <IconArrowUp />
              </IconBtn>
              <IconBtn label={t('entry.moveBulletDown')} disabled={bi === entry.bullets.length - 1} onClick={() => patch((en) => swap(en.bullets, bi, bi + 1))}>
                <IconArrowDown />
              </IconBtn>
              <IconBtn label={t('common.delete')} danger onClick={() => patch((en) => void (en.bullets = en.bullets.filter((_, k) => k !== bi)))}>
                <IconTrash />
              </IconBtn>
            </div>
          </div>
        ))}
        <button className="ink-btn ink-btn-ghost ink-btn-sm" onClick={() => patch((en) => void en.bullets.push(''))}>
          <IconPlus /> {t('entry.addBullet')}
        </button>
      </div>

      <div className="ink-entry-foot">
        {aiOn && entry.bullets.length > 0 && (
          <button data-testid="ai-polish-open" className="ink-btn ink-btn-sm ink-btn-ai" onClick={onPolish}>
            <IconSparkles /> {t('entry.aiPolish')}
          </button>
        )}
        <div className="ink-spacer" />
        <IconBtn label={t('entry.moveBulletUp')} disabled={index === 0} onClick={() => moveEntry(-1)}>
          <IconArrowUp />
        </IconBtn>
        <IconBtn label={t('entry.moveBulletDown')} disabled={index === total - 1} onClick={() => moveEntry(1)}>
          <IconArrowDown />
        </IconBtn>
        <VisibilityToggle visible={entry.visible} onToggle={() => patch((en) => void (en.visible = !en.visible))} />
        <IconBtn label={t('entry.delete')} danger onClick={removeEntry}>
          <IconTrash />
        </IconBtn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits

function swap<T>(arr: T[], i: number, j: number): void {
  const a = arr[i];
  const b = arr[j];
  if (a === undefined || b === undefined) return;
  arr[i] = b;
  arr[j] = a;
}

function CardHeader({ open, onToggle, title }: { open: boolean; onToggle: () => void; title: string }): ReactNode {
  const { t } = useTranslation();
  return (
    <header className="ink-card-head">
      <button className="ink-collapse" onClick={onToggle} aria-label={t(open ? 'common.collapse' : 'common.expand')}>
        {open ? <IconChevronDown /> : <IconChevronRight />}
      </button>
      <h3 className="ink-card-title">{title}</h3>
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label className="ink-field">
      <span className="ink-field-label">{label}</span>
      {children}
    </label>
  );
}

export function IconBtn({
  children,
  label,
  onClick,
  danger,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}): ReactNode {
  return (
    <button
      className={`ink-icon-btn${danger ? ' danger' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function VisibilityToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }): ReactNode {
  const { t } = useTranslation();
  return (
    <button
      className={`ink-icon-btn ink-vis${visible ? '' : ' off'}`}
      title={t(visible ? 'common.hide' : 'common.show')}
      aria-label={t(visible ? 'common.hide' : 'common.show')}
      onClick={onToggle}
      type="button"
    >
      {visible ? <IconEye /> : <IconEyeOff />}
    </button>
  );
}
