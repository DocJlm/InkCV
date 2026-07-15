import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { useEditorStore } from '../store';
import { usePrefersDark } from '../primitives';

const COMMIT_DEBOUNCE_MS = 800;

export function MarkdownEditor(): ReactNode {
  const { t } = useTranslation();
  const mdBuffer = useEditorStore((s) => s.mdBuffer);
  const mdWarnings = useEditorStore((s) => s.mdWarnings);
  const mdError = useEditorStore((s) => s.mdError);
  const setMdBuffer = useEditorStore((s) => s.setMdBuffer);
  const commitMd = useEditorStore((s) => s.commitMd);
  const discardMd = useEditorStore((s) => s.discardMd);
  const dark = usePrefersDark();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const scheduleCommit = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commitMd();
    }, COMMIT_DEBOUNCE_MS);
  };

  const commitNow = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    commitMd();
  };

  return (
    <div className="ink-md">
      <div className="ink-md-editor" onBlur={commitNow}>
        <CodeMirror
          value={mdBuffer}
          height="100%"
          theme={dark ? 'dark' : 'light'}
          extensions={[markdown()]}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
          onChange={(value) => {
            setMdBuffer(value);
            scheduleCommit();
          }}
        />
      </div>

      {mdError && (
        <div className="ink-md-error" role="alert">
          <div className="ink-md-error-text">
            <strong>{t('md.errorTitle')}</strong>
            <span>
              {t('md.line', { line: mdError.line })} · {mdError.message}
            </span>
          </div>
          <button className="ink-btn ink-btn-sm" onClick={discardMd}>
            {t('md.discard')}
          </button>
        </div>
      )}

      {mdWarnings.length > 0 && (
        <div className="ink-md-warnings">
          <div className="ink-md-warnings-head">{t('md.warningsTitle')}</div>
          <ul>
            {mdWarnings.map((w, i) => (
              <li key={i}>
                <span className="ink-md-warn-line">{t('md.line', { line: w.line })}</span>
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
