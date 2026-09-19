import type {
  AuthPayload,
  AuthResponse,
  BirthProfileDetailResponse,
  ChartResult,
  DeleteBirthProfileResponse,
  ForecastPreviewPayload,
  ForecastPreviewResult,
  ListBirthProfilesResponse,
  LoginPayload,
  MeResponse,
  NatalInterpretationPreview,
  NatalPreviewPayload,
  PlaceSearchResponse,
  SaveBirthProfilePayload,
  SaveBirthProfileResult,
  ShareBirthProfileResponse,
  SynastryPreviewPayload,
  SynastryPreviewResult,
  TransitPreviewPayload,
  TransitPreviewResult
} from "./chart-types";
import type { ForecastArchiveKind, SavedForecast, SavedForecastSummary, SaveForecastPayload } from "./forecast-archive";
import type { CalculationProfile, CalculationProfileConfig, CalculationProfilesResponse } from "./calculation-profiles";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const jsonHeaders = (token?: string | null): HeadersInit => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

const authHeaders = (token?: string | null): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

const profileResponse = async <Result>(response: Response): Promise<Result> => {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Не вдалося завантажити профілі розрахунку.");
  }
  return response.json() as Promise<Result>;
};

export const listCalculationProfiles = async (token: string): Promise<CalculationProfilesResponse> =>
  profileResponse(await fetch(`${API_URL}/calculation-profiles`, { headers: authHeaders(token), cache: "no-store" }));

export const saveCalculationProfile = async (
  token: string, payload: { name: string; config: CalculationProfileConfig }, existing?: { id: string; revision: number }
): Promise<{ profile: CalculationProfile }> => profileResponse(await fetch(
  `${API_URL}/calculation-profiles${existing ? `/${encodeURIComponent(existing.id)}` : ""}`, {
    method: existing ? "PUT" : "POST", headers: jsonHeaders(token),
    body: JSON.stringify({ ...payload, ...(existing ? { revision: existing.revision } : {}) })
  }
));

export const deleteCalculationProfile = async (token: string, id: string): Promise<{ deletedProfileId: string }> =>
  profileResponse(await fetch(`${API_URL}/calculation-profiles/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders(token) }));

export const setDefaultCalculationProfile = async (token: string, id: string | null): Promise<{ defaultProfileId: string | null }> =>
  profileResponse(await fetch(`${API_URL}/calculation-profiles/default`, {
    method: "PUT", headers: jsonHeaders(token), body: JSON.stringify({ id })
  }));

const readArchiveResponse = async <Result>(response: Response): Promise<Result> => {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Не вдалося звернутися до архіву прогнозів.");
  }
  return response.json() as Promise<Result>;
};

export const saveForecast = async (payload: SaveForecastPayload, token: string): Promise<{ forecast: SavedForecast }> =>
  readArchiveResponse(await fetch(`${API_URL}/saved-forecasts`, {
    method: "POST", headers: jsonHeaders(token), body: JSON.stringify(payload)
  }));

export const getSavedForecast = async (id: string, token: string): Promise<{ forecast: SavedForecast }> =>
  readArchiveResponse(await fetch(`${API_URL}/saved-forecasts/${encodeURIComponent(id)}`, { headers: authHeaders(token) }));

export const listSavedForecasts = async (
  token: string,
  options: { query?: string; kind?: ForecastArchiveKind; cursor?: string; createdFrom?: string; createdBefore?: string; sort?: "newest" | "oldest" } = {}
): Promise<{ forecasts: SavedForecastSummary[]; nextCursor: string | null }> => {
  const params = new URLSearchParams({ limit: "10" });
  if (options.query) params.set("query", options.query);
  if (options.kind) params.set("kind", options.kind);
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.createdFrom) params.set("createdFrom", options.createdFrom);
  if (options.createdBefore) params.set("createdBefore", options.createdBefore);
  if (options.sort) params.set("sort", options.sort);
  return readArchiveResponse(await fetch(`${API_URL}/saved-forecasts?${params}`, { headers: authHeaders(token) }));
};

export const deleteSavedForecast = async (id: string, token: string): Promise<{ deletedForecastId: string }> =>
  readArchiveResponse(await fetch(`${API_URL}/saved-forecasts/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: authHeaders(token)
  }));

export const registerUser = async (payload: AuthPayload): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<AuthResponse>;
};

export const loginUser = async (payload: LoginPayload): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<AuthResponse>;
};

export const getCurrentUser = async (token: string): Promise<MeResponse> => {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<MeResponse>;
};

export const requestNatalPreview = async (payload: NatalPreviewPayload): Promise<ChartResult> => {
  const response = await fetch(`${API_URL}/charts/natal/preview`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<ChartResult>;
};

export const requestNatalInterpretation = async (
  payload: NatalPreviewPayload
): Promise<NatalInterpretationPreview> => {
  const response = await fetch(`${API_URL}/interpretations/natal/preview`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<NatalInterpretationPreview>;
};

export const requestTransitPreview = async (payload: TransitPreviewPayload): Promise<TransitPreviewResult> => {
  const response = await fetch(`${API_URL}/charts/transits/preview`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<TransitPreviewResult>;
};

export const requestForecastPreview = async (payload: ForecastPreviewPayload): Promise<ForecastPreviewResult> => {
  const response = await fetch(`${API_URL}/charts/forecast/preview`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<ForecastPreviewResult>;
};

export const requestSynastryPreview = async (payload: SynastryPreviewPayload): Promise<SynastryPreviewResult> => {
  const response = await fetch(`${API_URL}/charts/synastry/preview`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<SynastryPreviewResult>;
};

export const saveBirthProfile = async (
  payload: SaveBirthProfilePayload,
  token?: string | null
): Promise<SaveBirthProfileResult> => {
  const response = await fetch(`${API_URL}/birth-profiles`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<SaveBirthProfileResult>;
};

export const listBirthProfiles = async (token?: string | null): Promise<ListBirthProfilesResponse> => {
  const response = await fetch(`${API_URL}/birth-profiles?limit=10`, {
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<ListBirthProfilesResponse>;
};

export const getBirthProfile = async (id: string, token?: string | null): Promise<BirthProfileDetailResponse> => {
  const response = await fetch(`${API_URL}/birth-profiles/${id}`, {
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<BirthProfileDetailResponse>;
};

export const shareBirthProfile = async (
  id: string,
  token?: string | null
): Promise<ShareBirthProfileResponse> => {
  const response = await fetch(`${API_URL}/birth-profiles/${id}/share`, {
    method: "POST",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<ShareBirthProfileResponse>;
};

export const deleteBirthProfile = async (
  id: string,
  token?: string | null
): Promise<DeleteBirthProfileResponse> => {
  const response = await fetch(`${API_URL}/birth-profiles/${id}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<DeleteBirthProfileResponse>;
};

export const searchPlaces = async (query: string): Promise<PlaceSearchResponse> => {
  const params = new URLSearchParams({
    query,
    language: "uk",
    count: "8"
  });
  const response = await fetch(`${API_URL}/places/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<PlaceSearchResponse>;
};
