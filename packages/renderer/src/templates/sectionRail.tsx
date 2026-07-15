import * as React from 'react';
import { Document, Page, StyleSheet } from '@react-pdf/renderer';
import { buildTemplateStyles, TemplatePageContents } from './singleColumn';
import type { TemplateProps } from './types';

const layout = StyleSheet.create({ page: { flexDirection: 'column' } });

export function SectionRailTemplate({ doc, theme }: TemplateProps): React.ReactElement {
  const styles = buildTemplateStyles(theme);
  return <Document><Page size={[theme.page.width, theme.page.height]} style={[styles.page, layout.page]}><TemplatePageContents doc={doc} theme={theme} styles={styles} /></Page></Document>;
}
