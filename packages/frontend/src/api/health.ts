import { request } from "./client";

export interface HealthResponse {
  status: "ok";
  service: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await request("/health");
  return response.json() as Promise<HealthResponse>;
}
