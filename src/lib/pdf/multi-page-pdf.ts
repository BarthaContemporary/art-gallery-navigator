
export { MultiPagePDFBuilder } from './pdf-builder';
export { convertHTMLToMultiPagePDF } from './multi-page-converter';
export type { PageOptions, MultiPagePDFOptions } from './pdf-types';
// The splitHTMLIntoPages function is an internal utility for convertHTMLToMultiPagePDF
// and is not intended for direct external use, so it's not re-exported here.
