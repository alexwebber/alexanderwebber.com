// The file schemas the CV's data is validated against (schemas/<name>.schema.json, $ids
// https://alexanderwebber.com/schemas/cv/<name>.schema.json). gen-types writes their TypeScript
// types into ./generated/. cv/export is the career record's export, read only by scripts/import-cv.ts.
// Kept free of imports, so gen-types can read it before the types exist.
export const CV_SCHEMAS = ['cv/page', 'cv/blocks', 'cv/timeline', 'cv/downloads', 'cv/export'] as const;
export type CvSchema = (typeof CV_SCHEMAS)[number];
