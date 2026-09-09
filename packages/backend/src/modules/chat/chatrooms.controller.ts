import { Controller, Get } from "@nestjs/common";
import { ChatroomsService } from "./chatrooms.service";

@Controller("chatrooms")
export class ChatroomsController {
  constructor(private readonly chatroomsService: ChatroomsService) {}

  @Get()
  listChatrooms() {
    return this.chatroomsService.listChatrooms();
  }
}
