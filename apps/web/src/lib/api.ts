import type {
  BirthProfileDetailResponse,
  ChartResult,
  DeleteBirthProfileResponse,
  ListBirthProfilesResponse,
  NatalInterpretationPreview,
  NatalPreviewPayload,
  PlaceSearchResponse,
  SaveBirthProfilePayload,
  SaveBirthProfileResult,
  SynastryPreviewPayload,
  SynastryPreviewResult,
  TransitPreviewPayload,
  TransitPreviewResult
} from "./chart-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const requestNatalPreview = async (payload: NatalPreviewPayload): Promise<ChartResult> => {
  const response = await fetch(`${API_URL}/charts/natal/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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
    headers: {
      "Content-Type": "application/json"
    },
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
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<TransitPreviewResult>;
};

export const requestSynastryPreview = async (payload: SynastryPreviewPayload): Promise<SynastryPreviewResult> => {
  const response = await fetch(`${API_URL}/charts/synastry/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<SynastryPreviewResult>;
};

export const saveBirthProfile = async (payload: SaveBirthProfilePayload): Promise<SaveBirthProfileResult> => {
  const response = await fetch(`${API_URL}/birth-profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<SaveBirthProfileResult>;
};

export const listBirthProfiles = async (): Promise<ListBirthProfilesResponse> => {
  const response = await fetch(`${API_URL}/birth-profiles?limit=10`);

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<ListBirthProfilesResponse>;
};

export const getBirthProfile = async (id: string): Promise<BirthProfileDetailResponse> => {
  const response = await fetch(`${API_URL}/birth-profiles/${id}`);

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json() as Promise<BirthProfileDetailResponse>;
};

export const deleteBirthProfile = async (id: string): Promise<DeleteBirthProfileResponse> => {
  const response = await fetch(`${API_URL}/birth-profiles/${id}`, {
    method: "DELETE"
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
