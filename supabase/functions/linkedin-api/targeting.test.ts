import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual nested builder without starting the edge function or
// loading its remote imports and secrets.
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const start = source.indexOf('const buildCriteria = (payload:');
const end = source.indexOf('// Step 6: Perform PATCH update.', start);
if (start < 0 || end < 0) throw new Error('Targeting builder not found');
const javascript = ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2020 });
const titlesFacet = 'urn:li:adTargetingFacet:titles';
const employerFacet = 'urn:li:adTargetingFacet:employers';
const build = new Function('mode', 'existingTargeting', 'FACET_EMPLOYERS', 'FACET_INDUSTRIES', 'payload', `${javascript}; return buildCriteria(payload);`);

describe('Campaign Editor exclusion serialization', () => {
  for (const mode of ['append', 'replace']) {
    for (const exclude of [undefined, {}]) {
      test(`${mode} supplies the required exclusion OR map for ${JSON.stringify(exclude)}`, () => {
        const criteria = build(mode, { include: { and: [] }, exclude }, employerFacet, 'urn:li:adTargetingFacet:industries', [[titlesFacet, ['urn:li:title:1']]]);
        expect(JSON.parse(JSON.stringify(criteria)).exclude).toEqual({ or: {} });
        expect(criteria.include.and[0].or[titlesFacet]).toEqual(['urn:li:title:1']);
      });
    }
    test(`${mode} preserves existing company exclusions`, () => {
      const exclude = { or: { [employerFacet]: ['urn:li:organization:123'] } };
      const criteria = build(mode, { include: { and: [] }, exclude }, employerFacet, 'urn:li:adTargetingFacet:industries', [[titlesFacet, ['urn:li:title:1']]]);
      expect(criteria.exclude).toEqual(exclude);
    });
  }
});