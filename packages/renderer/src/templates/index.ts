import { ClassicTemplate } from './classic';
import { LapisTemplate } from './lapis';
import { MinimalAtsTemplate } from './minimalAts';
import { OnyxTemplate } from './onyx';
import type { TemplateDescriptor } from './types';

export type { TemplateDescriptor, TemplateProps } from './types';

export const templates: TemplateDescriptor[] = [
  {
    id: 'onyx',
    nameZh: '玄墨',
    nameEn: 'Onyx',
    profile: 'onyx',
    component: OnyxTemplate,
  },
  {
    id: 'lapis',
    nameZh: '青石',
    nameEn: 'Lapis',
    profile: 'lapis',
    component: LapisTemplate,
  },
  {
    id: 'classic',
    nameZh: '经典',
    nameEn: 'Classic',
    profile: 'classic',
    component: ClassicTemplate,
  },
  {
    id: 'minimal-ats',
    nameZh: '极简 ATS',
    nameEn: 'Minimal ATS',
    profile: 'minimal-ats',
    component: MinimalAtsTemplate,
  },
];

export function getTemplate(id: string): TemplateDescriptor {
  return templates.find((template) => template.id === id) ?? templates[0]!;
}
