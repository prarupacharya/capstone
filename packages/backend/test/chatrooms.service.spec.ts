import type { ChatroomsRepository } from "../src/modules/chat/chatrooms.repository";
import { ChatroomsService } from "../src/modules/chat/chatrooms.service";
import type { RoomPresenceService } from "../src/modules/chat/room-presence.service";

describe("ChatroomsService", () => {
  it("combines persisted room metadata with live unique-user counts", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const repository = {
      listChatrooms: jest.fn().mockResolvedValue([
        { id: "room-1", chatroomName: "General", createdAt },
        { id: "room-2", chatroomName: "Random", createdAt }
      ])
    };
    const presence = { getUserCount: jest.fn().mockReturnValueOnce(2).mockReturnValueOnce(0) };
    const service = new ChatroomsService(
      repository as unknown as ChatroomsRepository,
      presence as unknown as RoomPresenceService
    );

    await expect(service.listChatrooms()).resolves.toEqual([
      { id: "room-1", chatroomName: "General", createdAt, numberOfUsers: 2 },
      { id: "room-2", chatroomName: "Random", createdAt, numberOfUsers: 0 }
    ]);
    expect(repository.listChatrooms).toHaveBeenCalledTimes(1);
    expect(presence.getUserCount).toHaveBeenNthCalledWith(1, "room-1");
    expect(presence.getUserCount).toHaveBeenNthCalledWith(2, "room-2");
  });

  it("does not replace repository failures with a fabricated catalog", async () => {
    const failure = new Error("database unavailable");
    const service = new ChatroomsService(
      { listChatrooms: jest.fn().mockRejectedValue(failure) } as unknown as ChatroomsRepository,
      { getUserCount: jest.fn() } as unknown as RoomPresenceService
    );

    await expect(service.listChatrooms()).rejects.toBe(failure);
  });
});
