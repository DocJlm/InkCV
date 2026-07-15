import * as React from 'react';
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Entry, FreeformSection, ResumeDoc, StructuredSection } from '../../../core/src/schema';
import { PRESENT, isFreeform } from '../../../core/src/schema';
import { type FreeformStyles, renderFreeform, renderInline } from '../inlineMd';
import type { ResolvedTheme } from '../tokens';

export function buildTemplateStyles(t: ResolvedTheme) {
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
      paddingBottom: t.layout.headerVariant === 'rule' ? t.space.titlePad * 1.6 : 0,
      borderBottomWidth: t.layout.headerVariant === 'rule' ? t.space.rule : 0,
      borderBottomColor: t.color.accent,
      borderLeftWidth: t.layout.headerVariant === 'profile' ? t.space.rule * 4 : 0,
      borderLeftColor: t.color.accent,
      paddingTop: t.layout.headerVariant === 'profile' ? t.space.titlePad * 2 : 0,
      paddingLeft: t.layout.headerVariant === 'profile' ? t.space.titlePad * 2 : 0,
      paddingRight: t.layout.headerVariant === 'profile' ? t.space.titlePad * 2 : 0,
      ...(t.layout.headerVariant === 'profile' ? { backgroundColor: t.color.subtle } : {}),
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
      fontFamily: t.displayFontFamily,
      color: t.profile === 'compact-tech' ? t.color.accent : t.color.text,
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
      position: 'relative',
      paddingLeft: t.layout.sectionVariant === 'rail' ? t.layout.sectionRailWidth : 0,
    },
    sectionRailTitle: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: t.layout.sectionRailWidth - t.space.titlePad,
      borderTopWidth: t.space.rule * 2,
      borderTopColor: t.color.accent,
      paddingTop: t.space.titlePad,
    },
    sectionTitleBoxed: {
      backgroundColor: t.color.subtle,
      borderLeftWidth: t.space.rule,
      borderLeftColor: t.color.accent,
      paddingTop: t.space.titlePad,
      paddingBottom: t.space.titlePad,
      paddingLeft: t.space.titlePad * 1.6,
      marginBottom: t.space.entry,
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
      color: t.profile === 'minimal-ats' ? t.color.text : t.color.accent,
      lineHeight: t.lineHeight.title,
    },
    entry: {
      marginBottom: t.space.entry,
    },
    entryRail: {
      position: 'relative',
      flexDirection: 'row',
      marginBottom: t.space.entry,
    },
    entryRailDate: {
      width: t.layout.dateRailWidth,
      paddingRight: t.space.titlePad,
      fontSize: t.size.small,
      color: t.color.muted,
      lineHeight: t.lineHeight.body,
    },
    entryRailDateTimeline: {
      borderRightWidth: t.space.rule,
      borderRightColor: t.color.accent,
    },
    entryRailBody: {
      flexGrow: 1,
      flexShrink: 1,
      paddingLeft: t.space.titlePad * 1.6,
    },
    timelineDot: {
      position: 'absolute',
      left: t.layout.dateRailWidth - t.space.rule * 2.4,
      top: t.size.small * 0.2,
      width: t.space.rule * 3.6,
      height: t.space.rule * 3.6,
      borderRadius: t.space.rule * 1.8,
      backgroundColor: t.color.accent,
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

export type TemplateStyles = ReturnType<typeof buildTemplateStyles>;

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
  styles: TemplateStyles;
  theme: ResolvedTheme;
}): React.ReactElement {
  const dates = dateRange(entry, theme);
  const meta = metaLine(entry);
  const secondaryBelow = theme.layout.secondaryPlacement === 'below';
  const hasHead = !!entry.primary || (!secondaryBelow && !!entry.secondary) || dates.length > 0;

  const body = (
    <>
      {hasHead ? (
        <View style={styles.entryHeadRow} wrap={false}>
          <Text style={styles.entryPrimaryLine}>
            {entry.primary ? <Text style={styles.entryPrimary}>{entry.primary}</Text> : null}
            {!secondaryBelow && entry.primary && entry.secondary ? '  ' : ''}
            {!secondaryBelow && entry.secondary ? <Text style={styles.entrySecondary}>{entry.secondary}</Text> : null}
          </Text>
          {dates.length > 0 && theme.layout.entryVariant === 'standard' ? <Text style={styles.entryDates}>{dates}</Text> : null}
        </View>
      ) : null}

      {secondaryBelow && entry.secondary ? <Text style={styles.entrySecondaryBelow}>{entry.secondary}</Text> : null}
      {meta.length > 0 ? <Text style={styles.entryMeta}>{meta}</Text> : null}

      {entry.bullets.length > 0 ? (
        <View style={styles.bulletList}>
          {entry.bullets.map((bullet, index) => (
            <View key={`${entryKey}-b${index}`} style={styles.bulletRow} wrap={false}>
              <Text style={styles.bulletMark}>{theme.layout.bulletGlyph}</Text>
              <Text style={styles.bulletText}>{renderInline(bullet, `${entryKey}-b${index}`)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  if (theme.layout.entryVariant !== 'standard') {
    const timeline = theme.layout.entryVariant === 'timeline';
    return (
      <View style={styles.entryRail} wrap={false}>
        <Text style={timeline ? [styles.entryRailDate, styles.entryRailDateTimeline] : styles.entryRailDate}>{dates}</Text>
        {timeline ? <View style={styles.timelineDot} /> : null}
        <View style={styles.entryRailBody}>{body}</View>
      </View>
    );
  }

  return (
    <View style={styles.entry}>
      {body}
    </View>
  );
}

function SectionTitle({
  title,
  styles,
  theme,
}: {
  title: string;
  styles: TemplateStyles;
  theme: ResolvedTheme;
}): React.ReactElement {
  if (theme.layout.sectionVariant === 'rail') {
    return <View style={styles.sectionRailTitle} wrap={false}><Text style={styles.sectionTitle}>{title}</Text></View>;
  }
  if (theme.layout.sectionVariant === 'boxed') {
    return <View style={styles.sectionTitleBoxed} wrap={false}><Text style={styles.sectionTitle}>{title}</Text></View>;
  }
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
  styles: TemplateStyles;
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
  styles: TemplateStyles;
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
  styles: TemplateStyles;
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

export function TemplatePageContents({
  doc,
  theme,
  styles,
}: {
  doc: ResumeDoc;
  theme: ResolvedTheme;
  styles: TemplateStyles;
}): React.ReactElement {
  return (
    <>
      <Header doc={doc} styles={styles} theme={theme} />
      {doc.sections.filter((section) => section.visible).map((section) =>
        isFreeform(section) ? (
          <FreeformSectionView key={section.id} section={section} styles={styles} theme={theme} />
        ) : (
          <StructuredSectionView key={section.id} section={section} styles={styles} theme={theme} />
        ),
      )}
    </>
  );
}
