import { LapisTemplate } from './lapis';
import { MinimalAtsTemplate } from './minimalAts';
import { OnyxTemplate } from './onyx';
import { CompactTechTemplate } from './compactTech';
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
];

export function getTemplate(id: string): TemplateDescriptor {
  return templates.find((template) => template.id === id) ?? templates[0]!;
}
