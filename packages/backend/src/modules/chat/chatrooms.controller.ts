import { Controller, Get, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request";
import { ChatroomsService } from "./chatrooms.service";

@Controller("chatrooms")
export class ChatroomsController {
  constructor(private readonly chatroomsService: ChatroomsService) {}

  @Get()
  listChatrooms(@Req() request: AuthenticatedRequest) {
    return this.chatroomsService.listChatrooms(request.user.sub);
  }
}
