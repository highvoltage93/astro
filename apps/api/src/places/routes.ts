import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env";

type OpenMeteoPlace = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  timezone?: string;
  population?: number;
};

type OpenMeteoSearchResponse = {
  results?: OpenMeteoPlace[];
  error?: boolean;
  reason?: string;
};

const searchPlacesSchema = z.object({
  query: z.string().trim().min(2).max(120),
  language: z.string().trim().length(2).default("uk"),
  count: z.coerce.number().int().min(1).max(20).default(8)
});

const formatPlaceName = (place: OpenMeteoPlace): string => {
  const parts = [place.name, place.admin1, place.country].filter(Boolean);
  return parts.join(", ");
};

export const registerPlaceRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/places/search", async (request, reply) => {
    const parsed = searchPlacesSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "INVALID_PLACE_SEARCH_INPUT",
        issues: parsed.error.flatten()
      });
    }

    const params = new URLSearchParams({
      name: parsed.data.query,
      count: String(parsed.data.count),
      language: parsed.data.language,
      format: "json"
    });

    const response = await fetch(`${env.geocodingApiUrl}/search?${params.toString()}`, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return reply.code(502).send({
        code: "GEOCODING_PROVIDER_FAILED",
        message: `Geocoding provider responded with ${response.status}`
      });
    }

    const payload = (await response.json()) as OpenMeteoSearchResponse;

    if (payload.error) {
      return reply.code(502).send({
        code: "GEOCODING_PROVIDER_ERROR",
        message: payload.reason ?? "Geocoding provider returned an error"
      });
    }

    return {
      results: (payload.results ?? []).map((place) => ({
        provider: "open-meteo",
        providerId: String(place.id),
        name: place.name,
        displayName: formatPlaceName(place),
        country: place.country,
        countryCode: place.country_code,
        admin1: place.admin1,
        admin2: place.admin2,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone,
        elevation: place.elevation,
        population: place.population
      }))
    };
  });
};

