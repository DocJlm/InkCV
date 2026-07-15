import * as React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Entry, FreeformSection, ResumeDoc, StructuredSection } from '../../../core/src/schema';
import { PRESENT, isFreeform } from '../../../core/src/schema';
import { type FreeformStyles, renderFreeform, renderInline } from '../inlineMd';
import type { ResolvedTheme } from '../tokens';
import type { TemplateProps } from './types';

function buildStyles(t: ResolvedTheme) {
  const centered = t.layout.headerAlign === 'center';
  return StyleSheet.create({
    page: {
      paddingTop: t.page.margin,
      paddingBottom: t.page.margin,
      paddingLeft: t.page.margin,
      paddingRight: t.page.margin,
      fontFamily: t.fontFamily,
      fontSize: t.size.base,
      color: t.color.text,
      lineHeight: t.lineHeight.body,
    },
    header: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: t.space.header,
    },
    headerMain: {
      flexGrow: 1,
      flexShrink: 1,
      alignItems: centered ? 'center' : 'flex-start',
    },
    headerMainWithPhoto: {
      paddingLeft: t.media.photoSize + t.space.photoGap,
      paddingRight: t.media.photoSize + t.space.photoGap,
    },
    name: {
      fontSize: t.size.name,
      fontWeight: 700,
      color: t.color.text,
      lineHeight: t.lineHeight.name,
      textAlign: centered ? 'center' : 'left',
    },
    headline: {
      fontSize: t.size.headline,
      color: t.color.muted,
      marginTop: t.space.afterHeadline,
      textAlign: centered ? 'center' : 'left',
    },
    contacts: {
      fontSize: t.size.small,
      color: t.color.text,
      marginTop: t.space.afterHeadline,
      textAlign: centered ? 'center' : 'left',
    },
    customFields: {
      fontSize: t.size.small,
      color: t.color.muted,
      marginTop: t.space.meta,
      textAlign: centered ? 'center' : 'left',
    },
    photo: {
      width: t.media.photoSize,
      height: t.media.photoSize,
      borderRadius: t.media.photoRadius,
      objectFit: 'cover',
    },
    photoFlow: {
      marginLeft: t.space.photoGap,
    },
    photoCentered: {
      position: 'absolute',
      right: 0,
      top: 0,
    },
    section: {
      marginBottom: t.space.section,
    },
    sectionTitleBottom: {
      borderBottomWidth: t.space.rule,
      borderBottomColor: t.color.accent,
      paddingBottom: t.space.titlePad,
      marginBottom: t.space.entry,
    },
    sectionTitleTrailing: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: t.space.entry,
    },
    trailingRule: {
      flexGrow: 1,
      borderTopWidth: t.space.rule,
      borderTopColor: t.color.accent,
      marginLeft: t.space.titlePad,
    },
    sectionTitle: {
      fontSize: t.size.sectionTitle,
      fontWeight: 700,
      color: t.color.accent,
      lineHeight: t.lineHeight.title,
    },
    entry: {
      marginBottom: t.space.entry,
    },
    entryHeadRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    entryPrimaryLine: {
      flexGrow: 1,
      flexShrink: 1,
      paddingRight: t.size.base,
    },
    entryPrimary: {
      fontWeight: 700,
    },
    entrySecondary: {
      fontWeight: 400,
    },
    entrySecondaryBelow: {
      color: t.color.muted,
      marginTop: t.space.meta,
    },
    entryDates: {
      fontSize: t.size.small,
      color: t.color.muted,
      flexShrink: 0,
    },
    entryMeta: {
      fontSize: t.size.small,
      color: t.color.muted,
      marginTop: t.space.meta,
    },
    bulletList: {
      marginTop: t.space.bullet,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: t.space.bullet,
    },
    bulletMark: {
      width: t.space.bulletMark,
      color: t.profile === 'minimal-ats' ? t.color.text : t.color.accent,
    },
    bulletText: {
      flexGrow: 1,
      flexShrink: 1,
    },
    paragraph: {
      marginTop: t.space.paragraph,
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

function dateRange(entry: Entry, t: ResolvedTheme): string {
  const endLabel = entry.end === PRESENT ? t.presentLabel : entry.end;
  return [entry.start, endLabel]
    .filter((part): part is string => !!part && part.length > 0)
    .join(' - ');
}

function metaLine(entry: Entry): string {
  return [entry.location, entry.url, ...entry.tags]
    .filter((part): part is string => !!part && part.length > 0)
    .join(' | ');
}

function EntryView({
  entry,
  entryKey,
  styles,
  theme,
}: {
  entry: Entry;
  entryKey: string;
  styles: Styles;
  theme: ResolvedTheme;
}): React.ReactElement {
  const dates = dateRange(entry, theme);
  const meta = metaLine(entry);
  const secondaryBelow = theme.layout.secondaryPlacement === 'below';
  const hasHead = !!entry.primary || (!secondaryBelow && !!entry.secondary) || dates.length > 0;

  return (
    <View style={styles.entry}>
      {hasHead ? (
        <View style={styles.entryHeadRow} wrap={false}>
          <Text style={styles.entryPrimaryLine}>
            {entry.primary ? <Text style={styles.entryPrimary}>{entry.primary}</Text> : null}
            {!secondaryBelow && entry.primary && entry.secondary ? '  ' : ''}
            {!secondaryBelow && entry.secondary ? (
              <Text style={styles.entrySecondary}>{entry.secondary}</Text>
            ) : null}
          </Text>
          {dates.length > 0 ? <Text style={styles.entryDates}>{dates}</Text> : null}
        </View>
      ) : null}

      {secondaryBelow && entry.secondary ? (
        <Text style={styles.entrySecondaryBelow}>{entry.secondary}</Text>
      ) : null}
      {meta.length > 0 ? <Text style={styles.entryMeta}>{meta}</Text> : null}

      {entry.bullets.length > 0 ? (
        <View style={styles.bulletList}>
          {entry.bullets.map((bullet, index) => (
            <View key={`${entryKey}-b${index}`} style={styles.bulletRow} wrap={false}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>
                {renderInline(bullet, `${entryKey}-b${index}`)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SectionTitle({
  title,
  styles,
  theme,
}: {
  title: string;
  styles: Styles;
  theme: ResolvedTheme;
}): React.ReactElement {
  if (theme.layout.sectionRule === 'trailing') {
    return (
      <View style={styles.sectionTitleTrailing} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.trailingRule} />
      </View>
    );
  }
  return (
    <View style={styles.sectionTitleBottom} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function StructuredSectionView({
  section,
  styles,
  theme,
}: {
  section: StructuredSection;
  styles: Styles;
  theme: ResolvedTheme;
}): React.ReactElement {
  return (
    <View style={styles.section}>
      <SectionTitle title={section.title} styles={styles} theme={theme} />
      {section.entries.filter((entry) => entry.visible).map((entry) => (
        <EntryView key={entry.id} entry={entry} entryKey={entry.id} styles={styles} theme={theme} />
      ))}
    </View>
  );
}

function FreeformSectionView({
  section,
  styles,
  theme,
}: {
  section: FreeformSection;
  styles: Styles;
  theme: ResolvedTheme;
}): React.ReactElement {
  const freeformStyles: FreeformStyles = {
    paragraph: styles.paragraph,
    bulletRow: styles.bulletRow,
    bulletMark: styles.bulletMark,
    bulletText: styles.bulletText,
  };
  return (
    <View style={styles.section}>
      <SectionTitle title={section.title} styles={styles} theme={theme} />
      {renderFreeform(section.markdown, freeformStyles)}
    </View>
  );
}

function Header({
  doc,
  styles,
  theme,
}: {
  doc: ResumeDoc;
  styles: Styles;
  theme: ResolvedTheme;
}): React.ReactElement {
  const contacts = doc.basics.contacts.filter((contact) => contact.visible).map((contact) => contact.value);
  const customFields = doc.basics.customFields.map((field) => `${field.label}: ${field.value}`);
  const showPhoto = !!doc.basics.photo?.visible;
  const centered = theme.layout.headerAlign === 'center';
  const headerMainStyle = showPhoto && centered
    ? [styles.headerMain, styles.headerMainWithPhoto]
    : styles.headerMain;
  const photoStyle = centered
    ? [styles.photo, styles.photoCentered]
    : [styles.photo, styles.photoFlow];

  return (
    <View style={styles.header} wrap={false}>
      <View style={headerMainStyle}>
        <Text style={styles.name}>{doc.basics.name}</Text>
        {doc.basics.headline ? <Text style={styles.headline}>{doc.basics.headline}</Text> : null}
        {contacts.length > 0 ? <Text style={styles.contacts}>{contacts.join(' | ')}</Text> : null}
        {customFields.length > 0 ? (
          <Text style={styles.customFields}>{customFields.join(' | ')}</Text>
        ) : null}
      </View>
      {showPhoto && doc.basics.photo ? <Image style={photoStyle} src={doc.basics.photo.src} /> : null}
    </View>
  );
}

export function SingleColumnTemplate({ doc, theme }: TemplateProps): React.ReactElement {
  const styles = buildStyles(theme);
  return (
    <Document>
      <Page size={[theme.page.width, theme.page.height]} style={styles.page}>
        <Header doc={doc} styles={styles} theme={theme} />
        {doc.sections.filter((section) => section.visible).map((section) =>
          isFreeform(section) ? (
            <FreeformSectionView key={section.id} section={section} styles={styles} theme={theme} />
          ) : (
            <StructuredSectionView key={section.id} section={section} styles={styles} theme={theme} />
          ),
        )}
      </Page>
    </Document>
  );
}
