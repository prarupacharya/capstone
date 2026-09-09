import { RoomPresenceService } from "../src/modules/chat/room-presence.service";

describe("RoomPresenceService", () => {
  it("counts unique users and makes repeated joins idempotent", () => {
    const presence = new RoomPresenceService();

    expect(presence.join("room-1", "user-1", "socket-1")).toEqual({
      roomId: "room-1",
      userId: "user-1",
      wasMember: false,
      becameActive: true,
      becameInactive: false,
      numberOfUsers: 1
    });
    expect(presence.join("room-1", "user-1", "socket-1")).toMatchObject({
      wasMember: true,
      becameActive: false,
      numberOfUsers: 1
    });
    expect(presence.join("room-1", "user-2", "socket-2")).toMatchObject({
      becameActive: true,
      numberOfUsers: 2
    });
    expect(presence.getUserCount("room-1")).toBe(2);
  });

  it("keeps a multi-tab user active until the final socket leaves", () => {
    const presence = new RoomPresenceService();
    presence.join("room-1", "user-1", "socket-1");
    presence.join("room-1", "user-1", "socket-2");

    expect(presence.hasSocket("room-1", "user-1", "socket-1")).toBe(true);
    expect(presence.leave("room-1", "user-1", "socket-1")).toMatchObject({
      wasMember: true,
      becameInactive: false,
      numberOfUsers: 1
    });
    expect(presence.leave("room-1", "user-1", "socket-2")).toMatchObject({
      wasMember: true,
      becameInactive: true,
      numberOfUsers: 0
    });
    expect(presence.leave("room-1", "user-1", "socket-2")).toMatchObject({
      wasMember: false,
      becameInactive: false,
      numberOfUsers: 0
    });
    expect(presence.hasSocket("room-1", "user-1", "socket-1")).toBe(false);
  });

  it("cleans every room for a disconnected socket", () => {
    const presence = new RoomPresenceService();
    presence.join("room-a", "user-1", "socket-1");
    presence.join("room-b", "user-1", "socket-1");
    presence.join("room-a", "user-2", "socket-2");

    expect(presence.disconnect("socket-1")).toEqual([
      expect.objectContaining({ roomId: "room-a", becameInactive: true, numberOfUsers: 1 }),
      expect.objectContaining({ roomId: "room-b", becameInactive: true, numberOfUsers: 0 })
    ]);
    expect(presence.getUserCount("room-a")).toBe(1);
    expect(presence.getUserCount("room-b")).toBe(0);
    expect(presence.disconnect("socket-1")).toEqual([]);
  });
});
