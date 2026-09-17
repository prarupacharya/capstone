import { ChatroomsController } from "../src/modules/chat/chatrooms.controller";
import { IS_PUBLIC_KEY } from "../src/common/auth/public.decorator";
import type { ChatroomsService } from "../src/modules/chat/chatrooms.service";
import type { AuthenticatedRequest } from "../src/common/auth/authenticated-request";
import { CreateChatroomDto } from "../src/modules/chat/dto/create-chatroom.dto";

describe("ChatroomsController", () => {
  it("delegates room creation to the service", async () => {
    const room = { id: "room-3", chatroomName: "Support", numberOfUsers: 0, isMember: false };
    const input = { chatroomName: "Support" } as CreateChatroomDto;
    const service = { createChatroom: jest.fn().mockResolvedValue(room) };
    const controller = new ChatroomsController(service as unknown as ChatroomsService);

    await expect(controller.createChatroom(input)).resolves.toBe(room);
    expect(service.createChatroom).toHaveBeenCalledWith(input);
  });

  it("delegates the catalog request to the service", async () => {
    const rooms = [{ id: "room-1", chatroomName: "General", numberOfUsers: 1, isMember: true }];
    const service = { listChatrooms: jest.fn().mockResolvedValue(rooms) };
    const controller = new ChatroomsController(service as unknown as ChatroomsService);
    const request = { user: { sub: "user-1" } } as AuthenticatedRequest;

    await expect(controller.listChatrooms(request)).resolves.toBe(rooms);
    expect(service.listChatrooms).toHaveBeenCalledWith("user-1");
  });

  it("keeps the catalog route protected by omitting the public decorator", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ChatroomsController)).not.toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ChatroomsController.prototype.listChatrooms)).not.toBe(true);
  });
});
