import { ChatroomsController } from "../src/modules/chat/chatrooms.controller";
import { IS_PUBLIC_KEY } from "../src/common/auth/public.decorator";
import type { ChatroomsService } from "../src/modules/chat/chatrooms.service";
import type { AuthenticatedRequest } from "../src/common/auth/authenticated-request";

describe("ChatroomsController", () => {
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
