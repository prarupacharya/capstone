import type { ChatroomsRepository } from "../src/modules/chat/chatrooms.repository";
import { ChatroomsService } from "../src/modules/chat/chatrooms.service";
import type { ChatroomSummary } from "../src/modules/chat/chatroom.types";

describe("ChatroomsService", () => {
  it("returns membership-aware summaries for the authenticated user", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const rooms: ChatroomSummary[] = [
      { id: "room-1", chatroomName: "General", createdAt, numberOfUsers: 2, isMember: true },
      { id: "room-2", chatroomName: "Random", createdAt, numberOfUsers: 0, isMember: false }
    ];
    const repository = {
      listChatroomSummaries: jest.fn().mockResolvedValue(rooms)
    };
    const service = new ChatroomsService(repository as unknown as ChatroomsRepository);

    await expect(service.listChatrooms("user-1")).resolves.toBe(rooms);
    expect(repository.listChatroomSummaries).toHaveBeenCalledWith("user-1");
  });

  it("does not replace repository failures with a fabricated catalog", async () => {
    const failure = new Error("database unavailable");
    const service = new ChatroomsService(
      { listChatroomSummaries: jest.fn().mockRejectedValue(failure) } as unknown as ChatroomsRepository
    );

    await expect(service.listChatrooms("user-1")).rejects.toBe(failure);
  });
});
