import type {
  AspectConfiguration,
  AspectConfigurationAspectType,
  AspectConfigurationLink,
  AspectConfigurationType,
  ChartPoint
} from "./types";

const PRIMARY_PLANET_KEYS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto"
] as const;

const CONFIGURATION_ORBS: Record<AspectConfigurationAspectType, number> = {
  conjunction: 10,
  opposition: 6,
  trine: 6,
  square: 6,
  sextile: 4,
  quincunx: 2
};

const CONFIGURATION_TYPE_ORDER: AspectConfigurationType[] = [
  "grand-cross",
  "t-square",
  "grand-trine",
  "yod",
  "bisextile",
  "stellium"
];

const normalizeLongitude = (longitude: number): number => ((longitude % 360) + 360) % 360;

const shortestDistance = (longitudeA: number, longitudeB: number): number => {
  const difference = Math.abs(normalizeLongitude(longitudeA) - normalizeLongitude(longitudeB));
  return difference > 180 ? 360 - difference : difference;
};

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

const combinations = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];

  const visit = (start: number, selected: T[]): void => {
    if (selected.length === size) {
      result.push(selected);
      return;
    }

    for (let index = start; index <= items.length - (size - selected.length); index += 1) {
      const item = items[index];

      if (item !== undefined) {
        visit(index + 1, [...selected, item]);
      }
    }
  };

  visit(0, []);
  return result;
};

const matchLink = (
  pointA: ChartPoint,
  pointB: ChartPoint,
  type: AspectConfigurationAspectType,
  exactAngle: number
): AspectConfigurationLink | null => {
  const orb = Math.abs(shortestDistance(pointA.longitude, pointB.longitude) - exactAngle);

  if (orb > CONFIGURATION_ORBS[type]) {
    return null;
  }

  return {
    bodyA: pointA.key,
    bodyB: pointB.key,
    type,
    exactAngle,
    orb: round(orb)
  };
};

const configurationScore = (links: AspectConfigurationLink[]): number => {
  if (links.length === 0) {
    return 0;
  }

  const total = links.reduce((sum, link) => {
    const allowedOrb = CONFIGURATION_ORBS[link.type];
    return sum + Math.max(0, 1 - link.orb / allowedOrb);
  }, 0);

  return round((total / links.length) * 100, 1);
};

const createConfiguration = ({
  apexKey,
  links,
  points,
  type
}: {
  apexKey?: string;
  links: AspectConfigurationLink[];
  points: ChartPoint[];
  type: AspectConfigurationType;
}): AspectConfiguration => ({
  type,
  pointKeys: points.map((point) => point.key),
  apexKey,
  maxOrb: round(Math.max(...links.map((link) => link.orb), 0)),
  score: configurationScore(links),
  links
});

const findTripleConfigurations = (points: ChartPoint[]): AspectConfiguration[] => {
  const configurations: AspectConfiguration[] = [];

  for (const triple of combinations(points, 3)) {
    const [pointA, pointB, pointC] = triple;

    if (!pointA || !pointB || !pointC) {
      continue;
    }

    const trineLinks = [
      matchLink(pointA, pointB, "trine", 120),
      matchLink(pointA, pointC, "trine", 120),
      matchLink(pointB, pointC, "trine", 120)
    ];

    if (trineLinks.every((link): link is AspectConfigurationLink => link !== null)) {
      configurations.push(createConfiguration({ type: "grand-trine", points: triple, links: trineLinks }));
    }

    for (const apex of triple) {
      const base = triple.filter((point) => point.key !== apex.key);
      const [baseA, baseB] = base;

      if (!baseA || !baseB) {
        continue;
      }

      const opposition = matchLink(baseA, baseB, "opposition", 180);
      const squareA = matchLink(apex, baseA, "square", 90);
      const squareB = matchLink(apex, baseB, "square", 90);

      if (opposition && squareA && squareB) {
        configurations.push(
          createConfiguration({
            type: "t-square",
            points: triple,
            apexKey: apex.key,
            links: [opposition, squareA, squareB]
          })
        );
      }

      const sextileBase = matchLink(baseA, baseB, "sextile", 60);
      const quincunxA = matchLink(apex, baseA, "quincunx", 150);
      const quincunxB = matchLink(apex, baseB, "quincunx", 150);

      if (sextileBase && quincunxA && quincunxB) {
        configurations.push(
          createConfiguration({
            type: "yod",
            points: triple,
            apexKey: apex.key,
            links: [sextileBase, quincunxA, quincunxB]
          })
        );
      }

      const trineBase = matchLink(baseA, baseB, "trine", 120);
      const sextileA = matchLink(apex, baseA, "sextile", 60);
      const sextileB = matchLink(apex, baseB, "sextile", 60);

      if (trineBase && sextileA && sextileB) {
        configurations.push(
          createConfiguration({
            type: "bisextile",
            points: triple,
            apexKey: apex.key,
            links: [trineBase, sextileA, sextileB]
          })
        );
      }
    }
  }

  return configurations;
};

const findGrandCrosses = (points: ChartPoint[]): AspectConfiguration[] => {
  const configurations: AspectConfiguration[] = [];

  for (const group of combinations(points, 4)) {
    const links: AspectConfigurationLink[] = [];
    let oppositionCount = 0;
    let squareCount = 0;
    let valid = true;

    for (const [pointA, pointB] of combinations(group, 2)) {
      if (!pointA || !pointB) {
        valid = false;
        break;
      }

      const opposition = matchLink(pointA, pointB, "opposition", 180);
      const square = opposition ? null : matchLink(pointA, pointB, "square", 90);

      if (opposition) {
        links.push(opposition);
        oppositionCount += 1;
      } else if (square) {
        links.push(square);
        squareCount += 1;
      } else {
        valid = false;
        break;
      }
    }

    if (valid && oppositionCount === 2 && squareCount === 4) {
      configurations.push(createConfiguration({ type: "grand-cross", points: group, links }));
    }
  }

  return configurations;
};

const circularSpan = (points: ChartPoint[]): number => {
  const longitudes = points.map((point) => normalizeLongitude(point.longitude)).sort((a, b) => a - b);
  let largestGap = 0;

  for (let index = 0; index < longitudes.length; index += 1) {
    const current = longitudes[index];
    const next = longitudes[(index + 1) % longitudes.length];

    if (current === undefined || next === undefined) {
      continue;
    }

    const gap = index === longitudes.length - 1 ? next + 360 - current : next - current;
    largestGap = Math.max(largestGap, gap);
  }

  return round(360 - largestGap);
};

const findStelliums = (points: ChartPoint[]): AspectConfiguration[] => {
  const candidates: Array<{ points: ChartPoint[]; span: number }> = [];

  for (let size = 3; size <= points.length; size += 1) {
    for (const group of combinations(points, size)) {
      const span = circularSpan(group);

      if (span <= CONFIGURATION_ORBS.conjunction) {
        candidates.push({ points: group, span });
      }
    }
  }

  const maximalCandidates = candidates.filter((candidate) => {
    return !candidates.some(
      (other) =>
        other.points.length > candidate.points.length &&
        candidate.points.every((point) => other.points.some((item) => item.key === point.key))
    );
  });

  return maximalCandidates.map(({ points: group, span }) => {
    const links = combinations(group, 2).flatMap(([pointA, pointB]) => {
      if (!pointA || !pointB) {
        return [];
      }

      const distance = shortestDistance(pointA.longitude, pointB.longitude);
      return [
        {
          bodyA: pointA.key,
          bodyB: pointB.key,
          type: "conjunction" as const,
          exactAngle: 0,
          orb: round(distance)
        }
      ];
    });

    return {
      ...createConfiguration({ type: "stellium", points: group, links }),
      maxOrb: span,
      score: round(Math.max(0, 1 - span / CONFIGURATION_ORBS.conjunction) * 100, 1)
    };
  });
};

export const calculateAspectConfigurations = (bodies: ChartPoint[]): AspectConfiguration[] => {
  const primaryKeys = new Set<string>(PRIMARY_PLANET_KEYS);
  const points = bodies.filter((body) => primaryKeys.has(body.key));
  const configurations = [
    ...findGrandCrosses(points),
    ...findTripleConfigurations(points),
    ...findStelliums(points)
  ];

  const unique = new Map<string, AspectConfiguration>();

  for (const configuration of configurations) {
    const key = [configuration.type, [...configuration.pointKeys].sort().join(","), configuration.apexKey ?? ""].join(":");
    const current = unique.get(key);

    if (!current || configuration.score > current.score) {
      unique.set(key, configuration);
    }
  }

  return [...unique.values()].sort(
    (left, right) =>
      CONFIGURATION_TYPE_ORDER.indexOf(left.type) - CONFIGURATION_TYPE_ORDER.indexOf(right.type) ||
      right.score - left.score ||
      left.maxOrb - right.maxOrb
  );
};
