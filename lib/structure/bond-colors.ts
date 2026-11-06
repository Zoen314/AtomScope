const P_O_H_PAIR_COLORS: Readonly<Record<string, string>> = {
  "H-H": "#eef2f7",
  "H-O": "#43c6e8",
  "H-P": "#9b8afb",
  "O-O": "#ff6b6b",
  "O-P": "#f6b94f",
  "P-P": "#c77dff",
};

const FALLBACK_PAIR_COLORS = [
  "#4cc9f0",
  "#f6bd60",
  "#84dcc6",
  "#ff8fab",
  "#a78bfa",
  "#f9844a",
  "#90be6d",
  "#f9c74f",
  "#5eead4",
  "#60a5fa",
  "#e879f9",
  "#fb7185",
] as const;

export function bondPairKey(elementA: string, elementB: string): string {
  return elementA.localeCompare(elementB) <= 0
    ? `${elementA}-${elementB}`
    : `${elementB}-${elementA}`;
}

function stablePairHash(value: string): number {
  let hash = 2166136261;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash ^= value.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function bondColorForElements(elementA: string, elementB: string): string {
  const key = bondPairKey(elementA, elementB);
  return P_O_H_PAIR_COLORS[key]
    ?? FALLBACK_PAIR_COLORS[stablePairHash(key) % FALLBACK_PAIR_COLORS.length];
}

