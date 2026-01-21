import { UserStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

class UserService {
  async ensureUser(id: string, email?: string) {
    return prisma.user.upsert({
      where: { id },
      create: { id, email: email ?? `${id}@placeholder.local`, status: UserStatus.WAITLIST },
      update: email ? { email } : {},
    });
  }

  async getUser(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, status: true, createdAt: true },
    });
  }

  async getUserStatus(id: string): Promise<UserStatus | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { status: true },
    });
    return user?.status ?? null;
  }

  async approveUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: { status: UserStatus.APPROVED },
    });
  }
}

export const userService = new UserService();
