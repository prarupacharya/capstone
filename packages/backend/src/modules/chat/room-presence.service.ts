import { Injectable } from "@nestjs/common";

export interface PresenceChange {
  roomId: string;
  userId: string;
  wasMember: boolean;
  becameActive: boolean;
  becameInactive: boolean;
  numberOfUsers: number;
}

type RoomUsers = Map<string, Set<string>>;

@Injectable()
export class RoomPresenceService {
  private readonly rooms = new Map<string, RoomUsers>();
  private readonly sockets = new Map<string, Map<string, string>>();

  join(roomId: string, userId: string, socketId: string): PresenceChange {
    const room = this.rooms.get(roomId) ?? new Map<string, Set<string>>();
    const userSockets = room.get(userId) ?? new Set<string>();
    const wasMember = userSockets.has(socketId);

    if (!wasMember) {
      userSockets.add(socketId);
      room.set(userId, userSockets);
      this.rooms.set(roomId, room);
      const socketRooms = this.sockets.get(socketId) ?? new Map<string, string>();
      socketRooms.set(roomId, userId);
      this.sockets.set(socketId, socketRooms);
    }

    return {
      roomId,
      userId,
      wasMember,
      becameActive: !wasMember && userSockets.size === 1,
      becameInactive: false,
      numberOfUsers: room.size
    };
  }

  leave(roomId: string, userId: string, socketId: string): PresenceChange {
    const room = this.rooms.get(roomId);
    const userSockets = room?.get(userId);
    const wasMember = Boolean(userSockets?.delete(socketId));

    if (wasMember) {
      if (userSockets?.size === 0) room?.delete(userId);
      if (room?.size === 0) this.rooms.delete(roomId);

      const socketRooms = this.sockets.get(socketId);
      socketRooms?.delete(roomId);
      if (socketRooms?.size === 0) this.sockets.delete(socketId);
    }

    return {
      roomId,
      userId,
      wasMember,
      becameActive: false,
      becameInactive: wasMember && userSockets?.size === 0,
      numberOfUsers: room?.size ?? 0
    };
  }

  disconnect(socketId: string): PresenceChange[] {
    const socketRooms = this.sockets.get(socketId);
    if (!socketRooms) return [];

    return [...socketRooms.entries()].map(([roomId, userId]) =>
      this.leave(roomId, userId, socketId)
    );
  }

  hasSocket(roomId: string, userId: string, socketId: string) {
    return this.rooms.get(roomId)?.get(userId)?.has(socketId) ?? false;
  }

  getUserCount(roomId: string) {
    return this.rooms.get(roomId)?.size ?? 0;
  }
}
