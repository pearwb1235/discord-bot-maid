import { Guild, Prisma } from "@prisma/client";
import {
  APIRole,
  AuditLogEvent,
  GuildAuditLogsEntry,
  GuildAuditLogsFetchOptions,
  GuildAuditLogsResolvable,
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

  get welcome() {
    return this.guild.welcomeChannelId && this.guild.welcomeMsg
      ? {
          channelId: this.guild.welcomeChannelId,
          msg: this.guild.welcomeMsg,
        }
      : null;
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
    if (role.position === 0) throw new Error("女僕無法管理這個身分組");
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
    const auditlogs = await this.fetchAuditLogs({
      type: AuditLogEvent.MemberRoleUpdate,
    });
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

  async setWelcome(msg: string | null, channelId: string | null) {
    const botMember = this.get().members.me;

    if (channelId !== null) {
      const channel = this.get().channels.cache.get(channelId);
      if (!channel.isTextBased()) throw new Error("女僕無法使用文字以外的頻道");
      if (
        !channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)
      )
        throw new Error("女僕沒有講話權限");
    }
    this.guild = await prismaClient.guild.update({
      data: {
        welcomeMsg: msg && channelId ? msg : null,
        welcomeChannelId: msg && channelId ? channelId : null,
      },
      where: {
        guildId: this.id,
      },
    });
  }

  async addRole(roleId: string, defaultValue = false) {
    const botMember = this.get().members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles))
      throw new Error("女僕沒有管理身分組權限");
    const role = this.get().roles.cache.get(roleId);
    if (!role) throw new Error("女僕找不到身分組");
    if (role.position === 0) throw new Error("女僕無法管理這個身分組");
    if (botMember.roles.highest.position <= role.position)
      throw new Error("女僕無法管理這個身分組");
    await prismaClient.guildRoles.upsert({
      create: {
        guildId: this.id,
        roleId: roleId,
        defaultValue: defaultValue,
      },
      update: {
        defaultValue: defaultValue,
      },
      where: {
        guildId_roleId: {
          guildId: this.id,
          roleId: roleId,
        },
      },
    });
    const members = await this.get().members.fetch();
    for (const member of members.values()) {
      const memberModel = await MemberModel.get(this, member.id);
      memberModel.fresh("新增持久身分組(add)");
    }
  }

  async delRole(roleId: string) {
    await prismaClient.guildRoles.delete({
      where: {
        guildId_roleId: {
          guildId: this.id,
          roleId: roleId,
        },
      },
    });
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
    auditlogs: GuildAuditLogsEntry<AuditLogEvent.MemberRoleUpdate>[],
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
    const auditlogs = await this.fetchAuditLogs({
      after: lastReadId,
      type: AuditLogEvent.MemberRoleUpdate,
    });
    await this._freshMember(memberId, auditlogs, prismaClient);
  }

  async fetchAuditLogs<T extends GuildAuditLogsResolvable = null>(
    options?: GuildAuditLogsFetchOptions<T>
  ): Promise<GuildAuditLogsEntry<T>[]> {
    if (options.after) {
      const auditlogs = await this.get()
        .fetchAuditLogs(options)
        .then((auditlogs) => auditlogs.entries.toJSON());
      let readId =
        auditlogs.length > 0 ? auditlogs[auditlogs.length - 1].id : null;
      while (readId) {
        const nextAuditlogs = await this.get()
          .fetchAuditLogs({ ...options, after: readId })
          .then((auditlogs) => auditlogs.entries.toJSON());
        auditlogs.push(...nextAuditlogs);
        readId =
          nextAuditlogs.length > 0
            ? nextAuditlogs[nextAuditlogs.length - 1].id
            : null;
      }
      return auditlogs.reverse();
    } else {
      const auditlogs = await this.get()
        .fetchAuditLogs(options)
        .then((auditlogs) => auditlogs.entries.toJSON());
      let readId =
        auditlogs.length > 0 ? auditlogs[auditlogs.length - 1].id : null;
      while (readId) {
        const nextAuditlogs = await this.get()
          .fetchAuditLogs({ ...options, before: readId })
          .then((auditlogs) => auditlogs.entries.toJSON());
        auditlogs.push(...nextAuditlogs);
        readId =
          nextAuditlogs.length > 0
            ? nextAuditlogs[nextAuditlogs.length - 1].id
            : null;
      }
      return auditlogs;
    }
  }
}
