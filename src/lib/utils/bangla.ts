const NUKTA_COMPOSITIONS: readonly (readonly [string, string])[] = [
  ["য়", "য়"],
  ["ড়", "ড়"],
  ["ঢ়", "ঢ়"],
];

export function composeNukta(value: string): string {
  return NUKTA_COMPOSITIONS.reduce(
    (current, [pair, single]) => current.split(pair).join(single),
    value,
  );
}
