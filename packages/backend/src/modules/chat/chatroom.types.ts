export interface Chatroom {
  id: string;
  chatroomName: string;
  createdAt: Date;
}

export interface ChatroomSummary extends Chatroom {
  numberOfUsers: number;
  isMember: boolean;
}
