import { ClassicTemplate } from './classic';
import { LapisTemplate } from './lapis';
import { MinimalAtsTemplate } from './minimalAts';
import { OnyxTemplate } from './onyx';
import { CompactTechTemplate } from './compactTech';
import { ProfileTemplate } from './profile';
import { SectionRailTemplate } from './sectionRail';
import { TimelineTemplate } from './timeline';
import type { TemplateDescriptor } from './types';

export type { TemplateDescriptor, TemplateProps } from './types';

export const templates: TemplateDescriptor[] = [
  {
    id: 'onyx',
    nameZh: '玄墨',
    nameEn: 'Onyx',
    profile: 'onyx',
    component: OnyxTemplate,
    audience: 'general', density: 'balanced', atsFriendly: true, photoTreatment: 'inline',
    layoutZh: '现代单栏', layoutEn: 'Modern single column',
  },
  {
    id: 'lapis',
    nameZh: '青石',
    nameEn: 'Lapis',
    profile: 'lapis',
    component: LapisTemplate,
    audience: 'tech', density: 'compact', atsFriendly: true, photoTreatment: 'optional',
    layoutZh: '中文紧凑', layoutEn: 'Compact Chinese-first',
  },
  {
    id: 'classic',
    nameZh: '经典',
    nameEn: 'Classic',
    profile: 'classic',
    component: ClassicTemplate,
    audience: 'general', density: 'spacious', atsFriendly: true, photoTreatment: 'optional',
    layoutZh: '居中经典', layoutEn: 'Centered classic',
  },
  {
    id: 'minimal-ats',
    nameZh: '极简 ATS',
    nameEn: 'Minimal ATS',
    profile: 'minimal-ats',
    component: MinimalAtsTemplate,
    audience: 'ats', density: 'balanced', atsFriendly: true, photoTreatment: 'inline',
    layoutZh: '线性 ATS', layoutEn: 'Linear ATS',
  },
  {
    id: 'compact-tech', nameZh: '技术密排', nameEn: 'Compact Tech', profile: 'compact-tech',
    component: CompactTechTemplate,
    audience: 'tech', density: 'compact', atsFriendly: true, photoTreatment: 'inline',
    layoutZh: '高密度技术', layoutEn: 'Dense technical',
  },
  {
    id: 'section-rail', nameZh: '侧标', nameEn: 'Section Rail', profile: 'section-rail',
    component: SectionRailTemplate,
    audience: 'tech', density: 'balanced', atsFriendly: true, photoTreatment: 'optional',
    layoutZh: '侧标网格', layoutEn: 'Section-label rail',
  },
  {
    id: 'timeline', nameZh: '脉络', nameEn: 'Timeline', profile: 'timeline',
    component: TimelineTemplate,
    audience: 'experienced', density: 'balanced', atsFriendly: false, photoTreatment: 'optional',
    layoutZh: '经历时间轴', layoutEn: 'Experience timeline',
  },
  {
    id: 'profile', nameZh: '名片', nameEn: 'Profile', profile: 'profile',
    component: ProfileTemplate,
    audience: 'general', density: 'spacious', atsFriendly: false, photoTreatment: 'portrait',
    layoutZh: '名片式页眉', layoutEn: 'Profile header',
  },
];

export function getTemplate(id: string): TemplateDescriptor {
  return templates.find((template) => template.id === id) ?? templates[0]!;
}
