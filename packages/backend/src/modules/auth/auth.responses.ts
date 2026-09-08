import type { User } from "../users/user.types";

export interface PublicUserResponse {
  id: string;
  email: string;
  username: string | null;
  createdDateTime: Date;
  userType: string;
}

export function toPublicUserResponse(user: User): PublicUserResponse {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    createdDateTime: user.createdDateTime,
    userType: user.userType
  };
}
