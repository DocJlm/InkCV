import type { FC } from 'react';
import type { ResumeDoc } from '../../../core/src/schema';
import type { ResolvedTheme, TemplateProfile } from '../tokens';

export interface TemplateProps {
  doc: ResumeDoc;
  theme: ResolvedTheme;
}

export interface TemplateDescriptor {
  id: TemplateProfile;
  nameZh: string;
  nameEn: string;
  profile: TemplateProfile;
  component: FC<TemplateProps>;
  audience: 'general' | 'tech' | 'ats' | 'experienced';
  density: 'balanced' | 'compact' | 'spacious';
  atsFriendly: boolean;
  photoTreatment: 'inline' | 'portrait' | 'optional';
  layoutZh: string;
  layoutEn: string;
}
