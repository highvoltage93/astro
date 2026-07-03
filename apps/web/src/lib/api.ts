import type { ChartResult, NatalPreviewPayload, SaveBirthProfilePayload, SaveBirthProfileResult } from "./chart-types";

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
