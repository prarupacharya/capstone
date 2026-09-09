import { ChatroomsController } from "../src/modules/chat/chatrooms.controller";
import { IS_PUBLIC_KEY } from "../src/common/auth/public.decorator";
import type { ChatroomsService } from "../src/modules/chat/chatrooms.service";

describe("ChatroomsController", () => {
  it("delegates the catalog request to the service", async () => {
    const rooms = [{ id: "room-1", chatroomName: "General", numberOfUsers: 1 }];
    const service = { listChatrooms: jest.fn().mockResolvedValue(rooms) };
    const controller = new ChatroomsController(service as unknown as ChatroomsService);

    await expect(controller.listChatrooms()).resolves.toBe(rooms);
    expect(service.listChatrooms).toHaveBeenCalledTimes(1);
  });

  it("keeps the catalog route protected by omitting the public decorator", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ChatroomsController)).not.toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ChatroomsController.prototype.listChatrooms)).not.toBe(true);
  });
});
