import * as React from 'react';
import { SingleColumnTemplate } from './singleColumn';
import type { TemplateProps } from './types';

export const MinimalAtsTemplate: React.FC<TemplateProps> = (props) => (
  <SingleColumnTemplate {...props} />
);

export default MinimalAtsTemplate;
