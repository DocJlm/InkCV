import * as React from 'react';
import { SingleColumnTemplate } from './singleColumn';
import type { TemplateProps } from './types';

export const ClassicTemplate: React.FC<TemplateProps> = (props) => (
  <SingleColumnTemplate {...props} />
);

export default ClassicTemplate;
