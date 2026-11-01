import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { targetingCompatibilityError } from './targeting-compatibility';

// Exercise the actual nested builder without starting the edge function or
// loading its remote imports and secrets.
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const start = source.indexOf('const buildCriteria = (payload:');
const end = source.indexOf('const compatibilityError =', start);
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

describe('Company targeting compatibility', () => {
  const sizeFacet = 'urn:li:adTargetingFacet:staffCountRanges';
  const industryFacet = 'urn:li:adTargetingFacet:industries';
  for (const mode of ['append', 'replace']) {
    for (const attribute of [sizeFacet, industryFacet]) {
      test(`${mode} rejects a separate company attribute AND filter without modifying the original`, () => {
        const original = { include: { and: [{ or: { [attribute]: ['urn:li:staffCountRange:(51,200)'] } }] } };
        const saved = structuredClone(original);
        const criteria = build(mode, original, employerFacet, industryFacet, [[employerFacet, ['urn:li:organization:123']]]);
        // Append already widens an Industry OR clause; only separate clauses conflict.
        const expectedConflict = mode === 'replace' || attribute === sizeFacet;
        expect(Boolean(targetingCompatibilityError(criteria))).toBe(expectedConflict);
        expect(original).toEqual(saved);
      });
    }
  }
  test('company names OR company size is compatible', () => {
    expect(targetingCompatibilityError({ include: { and: [{ or: {
      [employerFacet]: ['urn:li:organization:123'], [sizeFacet]: ['urn:li:staffCountRange:(51,200)'],
    } }] } })).toBeUndefined();
  });
  test('excluding companies preserves and permits included company size', () => {
    const original = { include: { and: [{ or: { [sizeFacet]: ['urn:li:staffCountRange:(51,200)'] } }] } };
    const criteria = build('exclude', original, employerFacet, industryFacet, [[employerFacet, ['urn:li:organization:123']]]);
    expect(targetingCompatibilityError(criteria)).toBeUndefined();
    expect(criteria.exclude.or[employerFacet]).toEqual(['urn:li:organization:123']);
    expect(criteria.include).toEqual(original.include);
  });
});