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

  it("detaches every socket for one user in one room", () => {
    const presence = new RoomPresenceService();
    presence.join("room-a", "user-1", "socket-1");
    presence.join("room-a", "user-1", "socket-2");
    presence.join("room-b", "user-1", "socket-1");
    presence.join("room-a", "user-2", "socket-3");

    expect(presence.detachUserFromRoom("room-a", "user-1")).toEqual([
      "socket-1", "socket-2"
    ]);
    expect(presence.hasSocket("room-a", "user-1", "socket-1")).toBe(false);
    expect(presence.hasSocket("room-a", "user-1", "socket-2")).toBe(false);
    expect(presence.hasSocket("room-b", "user-1", "socket-1")).toBe(true);
    expect(presence.hasSocket("room-a", "user-2", "socket-3")).toBe(true);
    expect(presence.getUserCount("room-a")).toBe(1);
    expect(presence.detachUserFromRoom("room-a", "user-1")).toEqual([]);
    expect(presence.disconnect("socket-1")).toEqual([
      expect.objectContaining({ roomId: "room-b", userId: "user-1" })
    ]);
  });

  it("does not alter presence for a missing user or room", () => {
    const presence = new RoomPresenceService();
    presence.join("room-1", "user-1", "socket-1");

    expect(presence.detachUserFromRoom("room-1", "user-2")).toEqual([]);
    expect(presence.detachUserFromRoom("missing-room", "user-1")).toEqual([]);
    expect(presence.hasSocket("room-1", "user-1", "socket-1")).toBe(true);
    expect(presence.getUserCount("room-1")).toBe(1);
  });

  it("removes the room index when the detached user was the only member", () => {
    const presence = new RoomPresenceService();
    presence.join("room-1", "user-1", "socket-1");
    presence.join("room-1", "user-1", "socket-2");

    expect(presence.detachUserFromRoom("room-1", "user-1")).toEqual([
      "socket-1", "socket-2"
    ]);
    expect(presence.getUserCount("room-1")).toBe(0);
    expect(presence.disconnect("socket-1")).toEqual([]);
    expect(presence.disconnect("socket-2")).toEqual([]);
  });
});
