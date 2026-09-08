import { request } from "./client";

export interface HealthResponse {
  status: "up" | "down";
  backend: "up" | "down";
  database: "up" | "down";
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await request("/health");
  return response.json() as Promise<HealthResponse>;
}
