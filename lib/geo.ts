export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371; // km

export function haversineKm(a: LatLng, b: LatLng) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Offsets a point by metres (approximate, fine for small distances). */
export function offsetMeters(p: LatLng, dx: number, dy: number): LatLng {
  const lat = p.lat + dy / 111_320;
  const lng = p.lng + dx / (111_320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
}

/** Rough travel time between two points inside a city. */
export function travelMinutes(km: number) {
  if (km < 1.2) return Math.max(3, Math.round((km / 4.5) * 60)); // walk
  if (km < 15) return Math.round(10 + (km / 18) * 60); // transit / taxi
  return Math.round(15 + (km / 45) * 60); // intercity road
}

export function travelMode(km: number) {
  if (km < 1.2) return "walk";
  if (km < 15) return "transit";
  return "drive";
}

export function centroid(points: LatLng[]): LatLng {
  if (!points.length) return { lat: 0, lng: 0 };
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
}

/** k-means clustering of points; deterministic initialisation (farthest-point). */
export function kmeans<T extends LatLng>(points: T[], k: number, iterations = 25): T[][] {
  if (k <= 1 || points.length <= 1) return [points];
  k = Math.min(k, points.length);
  const centers: LatLng[] = [points[0]];
  while (centers.length < k) {
    let best = points[0];
    let bestD = -1;
    for (const p of points) {
      const d = Math.min(...centers.map((c) => haversineKm(p, c)));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    centers.push(best);
  }
  let groups: T[][] = [];
  for (let it = 0; it < iterations; it++) {
    groups = centers.map(() => []);
    for (const p of points) {
      let bi = 0;
      let bd = Infinity;
      centers.forEach((c, i) => {
        const d = haversineKm(p, c);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      groups[bi].push(p);
    }
    let moved = false;
    groups.forEach((g, i) => {
      if (!g.length) return;
      const c = centroid(g);
      if (haversineKm(c, centers[i]) > 0.01) moved = true;
      centers[i] = c;
    });
    if (!moved) break;
  }
  return groups.filter((g) => g.length);
}

/** Greedy nearest-neighbour ordering followed by 2-opt improvement. */
export function orderRoute<T extends LatLng>(points: T[], start?: LatLng): T[] {
  if (points.length <= 2) return points;
  const remaining = [...points];
  const route: T[] = [];
  let cur: LatLng = start || remaining[0];
  while (remaining.length) {
    let bi = 0;
    let bd = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(cur, p);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    cur = remaining.splice(bi, 1)[0];
    route.push(cur as T);
  }
  // 2-opt
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length; j++) {
        const a = route[i];
        const b = route[i + 1];
        const c = route[j];
        const d = route[j + 1];
        const before = haversineKm(a, b) + (d ? haversineKm(c, d) : 0);
        const after = haversineKm(a, c) + (d ? haversineKm(b, d) : 0);
        if (after + 1e-9 < before) {
          route.splice(i + 1, j - i, ...route.slice(i + 1, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return route;
}

export function routeLengthKm(points: LatLng[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

/** Flight estimate: great-circle distance, block time and CO2 per passenger (economy). */
export function flightEstimate(from: LatLng, to: LatLng) {
  const km = haversineKm(from, to);
  const hours = km < 300 ? km / 80 : 0.5 + km / 830; // taxi/climb + cruise
  // ~90 g CO2/pkm short-haul, ~80 g long-haul, plus radiative forcing uplift x1.9 shown separately
  const perKm = km < 1500 ? 0.155 : km < 4000 ? 0.13 : 0.115;
  const co2Kg = km * perKm;
  return {
    km: Math.round(km),
    hours: Math.round(hours * 10) / 10,
    co2Kg: Math.round(co2Kg),
    treesToOffset: Math.max(1, Math.round(co2Kg / 21)), // a mature tree absorbs ~21 kg CO2/yr
    trainViable: km < 800,
  };
}
