import { PrismaClient as Client } from "@prisma/client";

export type PrismaClient = Omit<
  Client,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use"
>;

export const prismaClient = new Client();
