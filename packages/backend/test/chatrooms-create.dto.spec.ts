import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateChatroomDto } from "../src/modules/chat/dto/create-chatroom.dto";

describe("CreateChatroomDto", () => {
  it("trims a valid name", async () => {
    const dto = plainToInstance(CreateChatroomDto, { chatroomName: "  Support  " });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.chatroomName).toBe("Support");
  });

  it.each([
    ["", "isNotEmpty"],
    [" ", "isNotEmpty"],
    ["x".repeat(101), "maxLength"],
    [123, "isString"]
  ])("rejects %p", async (chatroomName, constraint) => {
    const errors = await validate(plainToInstance(CreateChatroomDto, { chatroomName }));

    expect(errors[0]?.constraints).toHaveProperty(constraint);
  });
});
