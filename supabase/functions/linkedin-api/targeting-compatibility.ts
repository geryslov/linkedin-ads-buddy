const facet = (name: string) => `urn:li:adTargetingFacet:${name}`;

// LinkedIn forbids these facets in separate include AND clauses. Never fix
// this by removing filters or changing AND to OR: that changes the audience.
export function targetingCompatibilityError(criteria: any): string | undefined {
  const clauses: any[] = criteria?.include?.and || [];
  const has = (clause: any, name: string) =>
    Array.isArray(clause?.or?.[facet(name)]) && clause.or[facet(name)].length > 0;
  for (const company of ['employers', 'employersAll', 'employersPast']) {
    for (const attribute of ['staffCountRanges', 'industries']) {
      const conflict = clauses.some((clause, index) => has(clause, company) &&
        clauses.some((other, otherIndex) => index !== otherIndex && has(other, attribute)));
      if (conflict) {
        const label = attribute === 'staffCountRanges' ? 'Company size' : 'Industry';
        return `LinkedIn cannot combine Company names with a separate ${label} include filter. Remove the ${label} filter in LinkedIn Campaign Manager if you want to target these companies, or keep it and use a separate campaign. No targeting was changed.`;
      }
    }
  }
  return undefined;
}