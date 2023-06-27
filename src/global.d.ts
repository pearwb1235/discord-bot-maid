declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: "develop" | "production" | "DEVELOP" | "PRODUCTION";
    DEBUG_LEVEL?: string;
    DATABASE_URL: string;
    DISCORD_CLIENTID: string;
    DISCORD_TOKEN: string;
  }
}
