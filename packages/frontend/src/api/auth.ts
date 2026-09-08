import { request } from "./client.js";

export interface RegistrationInput {
  email: string;
  password: string;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string | null;
  createdDateTime: string;
  userType: string;
}

export interface LoginResult {
  accessToken: string;
}

function credentialsBody(input: RegistrationInput) {
  return JSON.stringify({ email: input.email, password: input.password });
}

export async function registerUser(input: RegistrationInput): Promise<PublicUser> {
  const response = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: credentialsBody(input)
  });

  return response.json() as Promise<PublicUser>;
}

export async function loginUser(input: RegistrationInput): Promise<LoginResult> {
  const response = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: credentialsBody(input)
  });

  return response.json() as Promise<LoginResult>;
}
