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
import { logger } from "~/library/logger";
import { PrismaClient, prismaClient } from "~/library/prisma";
import { MemberModel } from "~/model/member";

export enum RefreshMembersType {
  DEFAULT,
  ALL,
  CLEAN,
}

export class GuildModel {
  private static _lockRefresh = [];
  static async get(guildId: string): Promise<GuildModel> {
    await discordClient.guilds.fetch(guildId);
    return await GuildModel._get(guildId);
  }
  private static async _get(guildId: string): Promise<GuildModel> {
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

  async init(markRoleId: string): Promise<boolean> {
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
    if (await this.refreshMembers(RefreshMembersType.CLEAN)) {
      await this.refreshMemberRoles("重新整理會員身分組(init)");
      return true;
    } else {
      return false;
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
    await this.refreshMemberRoles("新增持久身分組(add)");
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

  public async refreshMemberRoles(reason?: string) {
    await this.get()
      .members.fetch()
      .then((members) => members.toJSON())
      .then((members) =>
        Promise.allSettled(
          members.map((member) =>
            MemberModel.get(this, member.id, false)
              .then((member) => member.freshRoles(reason))
              .catch((err) => {
                logger.error(
                  `女僕無法更新 \`${member.displayName}(${member.id})\` 的身分組`
                );
                logger.error(err.toString());
              })
          )
        )
      );
  }

  async refreshMembers(
    type = RefreshMembersType.DEFAULT,
    prismaClient = this._prismaClient
  ): Promise<boolean> {
    if (GuildModel._lockRefresh.includes(this.id)) return false;
    GuildModel._lockRefresh.push(this.id);
    if (type === RefreshMembersType.CLEAN) {
      await prismaClient.memberRoles.deleteMany({
        where: {
          guildId: this.id,
        },
      });
    }
    const auditlogs = await this.fetchAuditLogs({
      after:
        type === RefreshMembersType.ALL || type === RefreshMembersType.CLEAN
          ? null
          : this.guild.lastAuditLogId,
      type: AuditLogEvent.MemberRoleUpdate,
    });
    await this.readRoleAuditLogs(auditlogs, prismaClient);
    if (type === RefreshMembersType.ALL || type === RefreshMembersType.CLEAN) {
      const originMemberRoles: Record<
        string,
        Record<string, boolean>
      > = await prismaClient.memberRoles
        .findMany({
          where: {
            guildId: this.id,
          },
        })
        .then((memberRoles) =>
          memberRoles.reduce((memberRoles, memberRole) => {
            if (!(memberRole.memberId in memberRoles))
              memberRoles[memberRole.memberId] = {};
            memberRoles[memberRole.memberId][memberRole.roleId] =
              memberRole.flag;
            return memberRoles;
          }, {})
        );
      const memberRoles: Record<string, Record<string, boolean>> = {};
      const members = await this.get()
        .members.fetch()
        .then((members) => members.toJSON());
      for (const member of members) {
        for (const role of member.roles.cache.toJSON()) {
          if (
            member.id in originMemberRoles &&
            originMemberRoles[member.id][role.id]
          )
            continue;
          if (!(member.id in memberRoles)) memberRoles[member.id] = {};
          memberRoles[member.id][role.id] = true;
        }
      }
      await this.saveMemberRoles(memberRoles, prismaClient);
    }
    if (auditlogs.length > 0) {
      this.guild = await prismaClient.guild.update({
        data: {
          lastAuditLogId: auditlogs[auditlogs.length - 1].id,
        },
        where: {
          guildId: this.id,
        },
      });
    }
    const index = GuildModel._lockRefresh.indexOf(this.id);
    if (index !== -1) GuildModel._lockRefresh.splice(index, 1);
    return true;
  }

  private async readRoleAuditLogs(
    auditlogs: GuildAuditLogsEntry<AuditLogEvent.MemberRoleUpdate>[],
    prismaClient = this._prismaClient
  ) {
    if (auditlogs.length < 1) return;
    const memberRoles: Record<string, Record<string, boolean>> = {};
    for (const auditlog of auditlogs) {
      for (const auditlogChange of auditlog.changes) {
        const roles = (
          auditlogChange.new as Pick<APIRole, "id" | "name">[]
        ).reverse();
        for (const role of roles) {
          if (!(auditlog.targetId in memberRoles))
            memberRoles[auditlog.targetId] = {};
          memberRoles[auditlog.targetId][role.id] =
            auditlogChange.key === "$add";
        }
      }
    }
    await this.saveMemberRoles(memberRoles, prismaClient);
  }

  private async saveMemberRoles(
    memberRoles: Record<string, Record<string, boolean>>,
    prismaClient = this._prismaClient
  ) {
    const memberIds = Object.keys(memberRoles);
    if (memberIds.length === 0) return;
    await prismaClient.guild.update({
      data: {
        members: {
          upsert:
            memberIds.map<Prisma.MemberUpsertWithWhereUniqueWithoutGuildInput>(
              (memberId) => ({
                create: {
                  memberId: memberId,
                  memberRoles: {
                    create: Object.keys(
                      memberRoles[memberId]
                    ).map<Prisma.MemberRolesCreateWithoutMemberInput>(
                      (roleId) => ({
                        roleId: roleId,
                        flag: memberRoles[memberId][roleId],
                      })
                    ),
                  },
                },
                update: {
                  memberRoles: {
                    upsert: Object.keys(
                      memberRoles[memberId]
                    ).map<Prisma.MemberRolesUpsertWithWhereUniqueWithoutMemberInput>(
                      (roleId) => ({
                        create: {
                          roleId: roleId,
                          flag: memberRoles[memberId][roleId],
                        },
                        update: {
                          flag: memberRoles[memberId][roleId],
                        },
                        where: {
                          guildId_memberId_roleId: {
                            guildId: this.id,
                            memberId: memberId,
                            roleId: roleId,
                          },
                        },
                      })
                    ),
                  },
                },
                where: {
                  guildId_memberId: {
                    guildId: this.id,
                    memberId: memberId,
                  },
                },
              })
            ),
        },
      },
      where: {
        guildId: this.id,
      },
    });
  }

  /**
   * 取得審核日誌 並由舊到新排序
   */
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
      return auditlogs;
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
      return auditlogs.reverse();
    }
  }
}
