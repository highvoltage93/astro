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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const jsonHeaders = (token?: string | null): HeadersInit => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

const authHeaders = (token?: string | null): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

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
