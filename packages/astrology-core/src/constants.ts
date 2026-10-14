import type { AspectType, HouseSystem, PointOrbSettings } from "./types";

export const DEFAULT_POINT_ORBS: PointOrbSettings = {
  sun: 8.5, moon: 8.5, mercury: 8.5, venus: 8.5, mars: 8.5,
  jupiter: 8.5, saturn: 9, uranus: 8.5, neptune: 8.5, pluto: 6.5,
  "north-node": 5, "south-node": 5, lilith: 5,
  chiron: 3, asc: 5, mc: 5
};

export const SUPPORTED_HOUSE_SYSTEMS: HouseSystem[] = [
  "placidus",
  "whole-sign",
  "equal",
  "koch",
  "campanus",
  "regiomontanus",
  "porphyry"
];

export const MAJOR_ASPECT_ANGLES: Record<AspectType, number> = {
  conjunction: 0,
  opposition: 180,
  trine: 120,
  square: 90,
  sextile: 60
};

export const DEFAULT_MAJOR_ASPECT_ORBS: Record<AspectType, number> = {
  conjunction: 8,
  opposition: 8,
  trine: 7,
  square: 7,
  sextile: 5
};

export const ZODIAC_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces"
] as const;
