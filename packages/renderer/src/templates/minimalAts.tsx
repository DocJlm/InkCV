import * as React from 'react';
import { Document, Page, StyleSheet } from '@react-pdf/renderer';
import { buildTemplateStyles, TemplateHeader, TemplateSection } from './singleColumn';
import type { TemplateProps } from './types';

const layout = StyleSheet.create({ page: { flexDirection: 'column' } });

export function MinimalAtsTemplate({ doc, theme }: TemplateProps): React.ReactElement {
  const styles = buildTemplateStyles(theme);
  return (
    <Document>
      <Page size={[theme.page.width, theme.page.height]} style={[styles.page, layout.page]}>
        <TemplateHeader doc={doc} theme={theme} styles={styles} />
        {doc.sections.filter((section) => section.visible).map((section) => <TemplateSection key={section.id} section={section} theme={theme} styles={styles} />)}
      </Page>
    </Document>
  );
}

export default MinimalAtsTemplate;
