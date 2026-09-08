export const GENERAL_USER_TYPE = "generaluser";

export interface User {
  id: string;
  email: string;
  username: string | null;
  hashedPassword: string;
  createdDateTime: Date;
  userType: string;
}

export interface CreateUserInput {
  email: string;
  hashedPassword: string;
}
