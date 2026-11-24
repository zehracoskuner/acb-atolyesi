export const RELATION_TYPES = [
  ["family", "Aile"], ["love", "Aşk"], ["friendship", "Dostluk"],
  ["alliance", "İttifak"], ["protect", "Koruma"], ["conflict", "Çatışma"],
  ["enemy", "Düşmanlık"], ["rivalry", "Rekabet"], ["manip", "Manipülasyon"],
  ["trauma", "Travma"], ["secret", "Sır"], ["unknown", "Belirsiz"],
].map(([key, label]) => ({ key, label }));

export function legacyRelationshipName(type) {
  return type?.match(/^custom_(.*)_\d+$/)?.[1]?.replaceAll("_", " ");
}

function normalizeName(name) {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
}

const standardNames = new Map(
  RELATION_TYPES.flatMap(({ key, label }) => [[key, key], [normalizeName(label), key]])
);

export function relationshipTypeIdentity(type) {
  const name = normalizeName(legacyRelationshipName(type) ?? "") || normalizeName(type);
  return standardNames.get(name) ?? name;
}
