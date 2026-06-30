type DistanceEntry = [string, string, number];

const KNOWN_DISTANCES: DistanceEntry[] = [
  ["Paris", "Lyon", 465],
  ["Paris", "Marseille", 775],
  ["Paris", "Lille", 225],
  ["Paris", "Bordeaux", 590],
  ["Paris", "Nantes", 385],
  ["Paris", "Rennes", 350],
  ["Paris", "Strasbourg", 490],
  ["Paris", "Reims", 145],
  ["Lyon", "Grenoble", 110],
  ["Lyon", "Marseille", 315],
  ["Lyon", "Paris CDG", 500],
  ["Bordeaux", "Paris CDG", 610],
  ["Rennes", "Nantes", 110],
  ["Strasbourg", "Colmar", 75],
  ["Caen", "Paris", 240],
];

const FALLBACK_DISTANCE_KM = 300;

function normalizeCityName(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function buildDistanceMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const [from, to, km] of KNOWN_DISTANCES) {
    const a = normalizeCityName(from);
    const b = normalizeCityName(to);
    map.set(`${a}|${b}`, km);
    map.set(`${b}|${a}`, km);
  }
  return map;
}

const DISTANCE_MAP = buildDistanceMap();

export function calculateDistanceKm(depart: string, destination: string): number {
  const key = `${normalizeCityName(depart)}|${normalizeCityName(destination)}`;
  return DISTANCE_MAP.get(key) ?? FALLBACK_DISTANCE_KM;
}

export function formatDistance(distanceKm: number): string {
  return `${Math.round(distanceKm)} km`;
}
