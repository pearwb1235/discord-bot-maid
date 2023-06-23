import { Guild, Prisma } from "@prisma/client";
import {
  APIRole,
  AuditLogEvent,
  GuildAuditLogsEntry,
  PermissionFlagsBits,
} from "discord.js";
import { discordClient } from "~/library/discord";
import { PrismaClient, prismaClient } from "~/library/prisma";
import { MemberModel } from "~/model/member";

export class GuildModel {
  static async get(guildId: string): Promise<GuildModel> {
    await discordClient.guilds.fetch(guildId);
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

  async init(markRoleId: string): Promise<void> {
    const botMember = this.get().members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles))
      throw new Error("女僕沒有管理身分組權限");
    const role = this.get().roles.cache.get(markRoleId);
    if (!role) throw new Error("女僕找不到身分組");
    if (botMember.roles.highest.position <= role.position)
      throw new Error("女僕無法管理這個身分組");
    this.guild = await prismaClient.guild.update({
      data: {
        markRoleId: markRoleId,
      },
      where: {
        guildId: this.id,
      },
    });
    const members = await this.get().members.fetch();
    const auditlogs = await this.get()
      .fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
      })
      .then((auditlogs) => auditlogs.entries.values());
    for (const member of members.values()) {
      await this._freshMember(member.id, auditlogs);
      const memberModel = await MemberModel.get(this, member.id);
      await prismaClient
        .$transaction(async (prismaClient) => {
          await memberModel.init(prismaClient);
        })
        .catch((err) => {
          console.error(
            `Couldn't init member: ${member.displayName}(${member.id})`
          );
          console.error(err);
        });
    }
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

  private async _freshMember(
    memberId: string,
    auditlogs: IterableIterator<
      GuildAuditLogsEntry<AuditLogEvent.MemberRoleUpdate>
    >,
    prismaClient = this._prismaClient
  ) {
    await prismaClient.member.upsert({
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
    await this._freshMember(memberId, auditlogs, prismaClient);
  }
}
