import { Prisma } from "@prisma/client";
import { APIRole, AuditLogEvent } from "discord.js";
import { discordClient } from "~/library/discord";
import { prismaClient } from "~/library/prisma";

export class Member {
  protected guildId: string;
  protected memberId: string;

  constructor(guildId: string, memberId: string) {
    this.guildId = guildId;
    this.memberId = memberId;
  }

  protected getWhere(): Prisma.MemberGuildIdMemberIdCompoundUniqueInput {
    return {
      guildId: this.guildId,
      memberId: this.memberId,
    };
  }

  protected getGuild() {
    const guild = discordClient.guilds.cache.get(this.guildId);
    if (!guild) throw new Error("Not found guild.");
    return guild;
  }

  protected async get() {
    const member = await prismaClient.member.findUnique({
      where: {
        guildId_memberId: this.getWhere(),
      },
    });
    if (member) return member;
    return prismaClient.member.create({
      data: this.getWhere(),
    });
  }

  async save(refresh = false) {
    const member = await this.get();
    const lastReadId = refresh ? null : member.roleUpdatedAt;
    const guild = this.getGuild();
    const auditlogs = await guild
      .fetchAuditLogs({
        after: lastReadId,
        type: AuditLogEvent.MemberRoleUpdate,
      })
      .then((auditlogs) => auditlogs.entries.values());
    const roleFlags: Record<string, boolean> = {};
    let auditlogId;
    for (const auditlog of auditlogs) {
      if (!auditlogId) auditlogId = auditlog.id;
      for (const auditlogChange of auditlog.changes) {
        const roles = auditlogChange.new as Pick<APIRole, "id" | "name">[];
        for (const role of roles) {
          if (role.id in roleFlags) continue;
          roleFlags[role.id] = auditlogChange.key === "$add";
        }
      }
    }
    await prismaClient.$transaction((prismaClient) => {
      const tasks = [];
      tasks.push(
        prismaClient.member.update({
          data: {
            roleUpdatedAt: auditlogId,
          },
          where: {
            guildId_memberId: this.getWhere(),
          },
        })
      );
      for (const roleId in roleFlags) {
        tasks.push(
          prismaClient.memberRoles.upsert({
            create: {
              ...this.getWhere(),
              roleId: roleId,
              flag: roleFlags[roleId],
            },
            update: {
              flag: roleFlags[roleId],
            },
            where: {
              guildId_memberId_roleId: {
                ...this.getWhere(),
                roleId: roleId,
              },
            },
          })
        );
      }
      return Promise.all(tasks);
    });
  }

  async getRoles(searchRoleIds?: string[]): Promise<Record<string, boolean>> {
    await this.save();
    const guild = this.getGuild();
    if (!searchRoleIds)
      searchRoleIds = guild.roles.cache
        .filter((role) => role.rawPosition > 0 && !("botId" in role.tags))
        .map((role) => role.id);
    if (searchRoleIds.length === 0) return {};
    const roles = await prismaClient.memberRoles.findMany({
      where: {
        member: this.getWhere(),
        roleId: { in: searchRoleIds },
      },
    });
    return roles.reduce(
      (result, role) => Object.assign(result, { [role.roleId]: role.flag }),
      {}
    );
  }
}
