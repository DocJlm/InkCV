import * as React from 'react';
import { SingleColumnTemplate } from './singleColumn';
import type { TemplateProps } from './types';

export const OnyxTemplate: React.FC<TemplateProps> = (props) => (
  <SingleColumnTemplate {...props} />
);

export default OnyxTemplate;
