import type { ChatroomsRepository } from "../src/modules/chat/chatrooms.repository";
import { ChatroomsService } from "../src/modules/chat/chatrooms.service";
import type { ChatroomSummary } from "../src/modules/chat/chatroom.types";
import type { CreateChatroomDto } from "../src/modules/chat/dto/create-chatroom.dto";

describe("ChatroomsService", () => {
  it("returns a newly created room as an unjoined summary", async () => {
    const createdAt = new Date("2026-01-03T00:00:00.000Z");
    const repository = {
      createChatroom: jest.fn().mockResolvedValue({ id: "room-3", chatroomName: "Support", createdAt })
    };
    const service = new ChatroomsService(repository as unknown as ChatroomsRepository);

    await expect(service.createChatroom({ chatroomName: "Support" } as CreateChatroomDto)).resolves.toEqual({
      id: "room-3", chatroomName: "Support", createdAt, numberOfUsers: 0, isMember: false
    });
    expect(repository.createChatroom).toHaveBeenCalledWith("Support");
  });

  it("maps only the room-name unique violation to a conflict", async () => {
    const repository = {
      createChatroom: jest.fn().mockRejectedValue({ code: "23505", constraint: "chatrooms_name_unique" })
    };
    const service = new ChatroomsService(repository as unknown as ChatroomsRepository);

    await expect(service.createChatroom({ chatroomName: "Support" } as CreateChatroomDto))
      .rejects.toMatchObject({ status: 409, message: "chatroom name is already in use" });
  });

  it("preserves unrelated creation failures", async () => {
    const failure = new Error("database unavailable");
    const service = new ChatroomsService({
      createChatroom: jest.fn().mockRejectedValue(failure)
    } as unknown as ChatroomsRepository);

    await expect(service.createChatroom({ chatroomName: "Support" } as CreateChatroomDto)).rejects.toBe(failure);
  });

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
