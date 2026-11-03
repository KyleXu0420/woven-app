// The house's small string rules, in one place. Four surfaces had written firstName, three had written the
// name join, two had written lowerFirst and two the middle-dot fix — each a private copy that could drift.
export const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
export const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const firstName = (name: string) => name.split(" ")[0];
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// Copy that comes out of lib/api.ts (askSuggestions(), needsYou() subs — line A's strings) still joins clauses
// with a middle dot; the house separator is a comma. One place to delete when those strings change.
export const houseSeparators = (s: string) => s.replace(/\s*·\s*/g, ", ");
// "Ana", "Ana and Theo", "Ana, Theo and 4 others" — the join the digest, the reader and Ask all print
export function nameList(names: string[], others = 0): string {
  const head = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
  if (others <= 0) return head;
  return `${names.join(", ")} and ${plural(others, "other", "others")}`;
}
