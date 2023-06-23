import { Member } from "@prisma/client";
import { GuildMember, PermissionFlagsBits } from "discord.js";
import { PrismaClient, prismaClient } from "~/library/prisma";
import { GuildModel } from "~/model/guild";

export class MemberModel {
  static async get(guildId: string, memberId: string): Promise<MemberModel>;
  static async get(guild: GuildModel, memberId: string): Promise<MemberModel>;
  static async get(
    guild: string | GuildModel,
    memberId: string
  ): Promise<MemberModel> {
    if (!(guild instanceof GuildModel)) guild = await GuildModel.get(guild);
    await guild.get().members.fetch(memberId);
    await guild.freshMember(memberId);
    const member = await prismaClient.member.findUnique({
      where: {
        guildId_memberId: {
          guildId: guild.id,
          memberId,
        },
      },
    });
    if (!member) throw new Error("Not found member.");
    return new MemberModel(guild, member);
  }

  private _prismaClient: PrismaClient;
  private guild: GuildModel;
  private member: Member;
  private _guildMember: GuildMember;

  private constructor(guild: GuildModel, member: Member) {
    this._prismaClient = prismaClient;
    this.guild = guild;
    this.member = member;
  }

  get id() {
    return this.member.memberId;
  }

  get guildId() {
    return this.member.guildId;
  }

  get isMarked() {
    const roleCache = this.guild.get().roles.cache;
    if (!roleCache.get(this.guild.markRoleId))
      throw new Error("標記身分組未設定或被刪除");
    return Boolean(this.get().roles.cache.get(this.guild.markRoleId));
  }

  get() {
    if (this._guildMember) return this._guildMember;
    this._guildMember = this.guild.get().members.cache.get(this.id);
    if (!this._guildMember) throw new Error("Not found member.");
    return this._guildMember;
  }

  async save(refresh = false, prismaClient = this._prismaClient) {
    await this.guild.freshMember(this.id, refresh, prismaClient);
  }

  async fresh(reason?: string) {
    const botMember = this.guild.get().members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles))
      throw new Error("女僕沒有管理身分組權限");
    const roleCache = this.guild.get().roles.cache;
    if (!roleCache.get(this.guild.markRoleId))
      throw new Error("標記身分組未設定或被刪除");
    const originRoles = this.get().roles.cache.clone();
    try {
      const roles = await this.getRoles();
      const setRoles: string[] = [];
      for (const roleId of originRoles.keys()) {
        setRoles.push(roleId);
      }
      for (const roleId in roles) {
        const role = roleCache.get(roleId);
        if (!role) continue;
        if (botMember.roles.highest.position <= role.position)
          throw new Error("女僕無法管理這個人員的身分組");
        if (roles[roleId] && !setRoles.includes(roleId)) setRoles.push(roleId);
        else if (!roles[roleId]) {
          const index = setRoles.indexOf(roleId);
          if (index === -1) continue;
          setRoles.splice(index, 1);
        }
      }
      if (!setRoles.includes(this.guild.markRoleId))
        setRoles.push(this.guild.markRoleId);
      await this.get().roles.set(setRoles, reason);
    } catch (err) {
      await this.get().roles.set(originRoles, "女僕更新身分組失敗");
      console.log("女僕更新身分組失敗");
      throw err;
    }
  }

  async getRoles(): Promise<Record<string, boolean>>;
  async getRoles(searchRoleIds: string[]): Promise<Record<string, boolean>>;
  async getRoles(
    searchRoles: Record<string, boolean>
  ): Promise<Record<string, boolean>>;
  async getRoles(
    searchRoles?: string[] | Record<string, boolean>
  ): Promise<Record<string, boolean>> {
    await this.save();
    if (!searchRoles) searchRoles = await this.guild.getRoles();
    if (Array.isArray(searchRoles))
      searchRoles = searchRoles.reduce(
        (result, roleId) => Object.assign(result, { [roleId]: false }),
        {}
      );
    if (Object.keys(searchRoles).length === 0) return {};
    const memberRoles = await prismaClient.memberRoles
      .findMany({
        where: {
          guildId: this.guildId,
          memberId: this.id,
          roleId: { in: Object.keys(searchRoles) },
        },
      })
      .then((roles) =>
        roles.reduce(
          (result, role) => Object.assign(result, { [role.roleId]: role.flag }),
          {}
        )
      );
    return Object.keys(searchRoles).reduce(
      (result, roleId) =>
        Object.assign(result, {
          [roleId]:
            roleId in memberRoles ? memberRoles[roleId] : searchRoles[roleId],
        }),
      {}
    );
  }
}
