import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request";
import { ChatroomsService } from "./chatrooms.service";
import { CreateChatroomDto } from "./dto/create-chatroom.dto";

@Controller("chatrooms")
export class ChatroomsController {
  constructor(private readonly chatroomsService: ChatroomsService) {}

  @Post()
  createChatroom(@Body() input: CreateChatroomDto) {
    return this.chatroomsService.createChatroom(input);
  }

  @Get()
  listChatrooms(@Req() request: AuthenticatedRequest) {
    return this.chatroomsService.listChatrooms(request.user.sub);
  }
}
