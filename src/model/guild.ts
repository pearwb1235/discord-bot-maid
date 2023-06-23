import { Guild, Prisma } from "@prisma/client";
import { APIRole, AuditLogEvent } from "discord.js";
import { discordClient } from "~/library/discord";
import { PrismaClient, prismaClient } from "~/library/prisma";

export class GuildModel {
  static async get(guildId: string): Promise<GuildModel> {
    const guild = await prismaClient.guild.findUnique({
      where: {
        guildId,
      },
    });
    if (guild) return new GuildModel(guild);
    return new GuildModel(
      await prismaClient.guild.create({
        data: {
          guildId,
        },
      })
    );
  }

  private _prismaClient: PrismaClient;
  private guild: Guild;
  private _guild: import("discord.js").Guild;

  private constructor(guild: Guild) {
    this._prismaClient = prismaClient;
    this.guild = guild;
  }

  get id() {
    return this.guild.guildId;
  }

  get markRoleId() {
    return this.guild.markRoleId;
  }

  get() {
    if (this._guild) return this._guild;
    this._guild = discordClient.guilds.cache.get(this.id);
    if (!this._guild) throw new Error("Not found guild.");
    return this._guild;
  }

  async getRoles() {
    return await prismaClient.guildRoles
      .findMany({
        where: {
          guildId: this.id,
        },
      })
      .then<Record<string, boolean>>((roles) =>
        roles.reduce(
          (result, role) =>
            Object.assign(result, { [role.roleId]: role.defaultValue }),
          {}
        )
      );
  }

  async freshMember(
    memberId: string,
    refresh = false,
    prismaClient = this._prismaClient
  ) {
    const member = await prismaClient.member.upsert({
      create: {
        guildId: this.id,
        memberId: memberId,
      },
      update: {},
      where: {
        guildId_memberId: {
          guildId: this.id,
          memberId: memberId,
        },
      },
    });
    const lastReadId = refresh ? null : member.roleUpdatedAt;
    const auditlogs = await this.get()
      .fetchAuditLogs({
        after: lastReadId,
        type: AuditLogEvent.MemberRoleUpdate,
      })
      .then((auditlogs) => auditlogs.entries.values());
    const checkedRoles: string[] = [];
    const memberRolesUpsertData: Prisma.Enumerable<Prisma.MemberRolesUpsertWithWhereUniqueWithoutMemberInput> =
      [];
    let lastAuditlogId;
    for (const auditlog of auditlogs) {
      if (!lastAuditlogId) {
        lastAuditlogId = auditlog.id;
      }
      if (auditlog.targetId !== memberId) continue;
      for (const auditlogChange of auditlog.changes) {
        const roles = (
          auditlogChange.new as Pick<APIRole, "id" | "name">[]
        ).reverse();
        for (const role of roles) {
          if (checkedRoles.includes(role.id)) continue;
          checkedRoles.push(role.id);
          memberRolesUpsertData.push({
            create: {
              roleId: role.id,
              flag: auditlogChange.key === "$add",
            },
            update: {
              flag: auditlogChange.key === "$add",
            },
            where: {
              guildId_memberId_roleId: {
                guildId: this.id,
                memberId: memberId,
                roleId: role.id,
              },
            },
          });
        }
      }
    }
    if (!lastAuditlogId) return;
    await prismaClient.member.update({
      data: {
        roleUpdatedAt: lastAuditlogId,
        memberRoles:
          memberRolesUpsertData.length > 0
            ? {
                upsert: memberRolesUpsertData,
              }
            : undefined,
      },
      where: {
        guildId_memberId: {
          guildId: this.id,
          memberId: memberId,
        },
      },
    });
  }
}
