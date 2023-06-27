import BaseLogger, { LoggerInfo } from "@pearwb/logger";
import * as path from "path";
import * as winston from "winston";
import { formatString } from "~/util/formatString";

const escapeCode = {
  reset: "\x1b[0m",

  "style-reset": "\x1b[0m",
  "style-bold": "\x1b[1m",
  "style-italic": "\x1b[3m",
  "style-underlined": "\x1b[4m",

  "color-reset": "\x1b[0m",
  "color-black": "\x1b[30m",
  "color-red": "\x1b[31m",
  "color-green": "\x1b[32m",
  "color-yellow": "\x1b[33m",
  "color-blue": "\x1b[34m",
  "color-purple": "\x1b[35m",
  "color-cyan": "\x1b[36m",
  "color-white": "\x1b[37m",
  "color-brightBlack": "\x1b[90m",
  "color-brightRed": "\x1b[91m",
  "color-brightGreen": "\x1b[92m",
  "color-brightYellow": "\x1b[93m",
  "color-brightBlue": "\x1b[94m",
  "color-brightPurple": "\x1b[95m",
  "color-brightCyan": "\x1b[96m",
  "color-brightWhite": "\x1b[97m",

  "background-reset": "\x1b[0m",
  "background-black": "\x1b[40m",
  "background-red": "\x1b[41m",
  "background-green": "\x1b[42m",
  "background-yellow": "\x1b[43m",
  "background-blue": "\x1b[44m",
  "background-purple": "\x1b[45m",
  "background-cyan": "\x1b[46m",
  "background-white": "\x1b[47m",
  "background-brightBlack": "\x1b[100m",
  "background-brightRed": "\x1b[101m",
  "background-brightGreen": "\x1b[102m",
  "background-brightYellow": "\x1b[103m",
  "background-brightBlue": "\x1b[104m",
  "background-brightPurple": "\x1b[105m",
  "background-brightCyan": "\x1b[106m",
  "background-brightWhite": "\x1b[107m",
};
const escapeCodeEmpty: Partial<typeof escapeCode> = {};
for (const key in escapeCode) {
  escapeCodeEmpty[key] = "";
}

type LoggerOption = {
  color?: boolean;
};

type LoggerMeta = {
  debugLevel?: number;
} & LoggerInfo;

class Logger extends BaseLogger<LoggerOption, LoggerMeta> {
  constructor(loggerName?: string) {
    super([
      new winston.transports.Console(),
      new winston.transports.File({
        filename: path.join(
          process.cwd(),
          "logs",
          `${loggerName || "server"}.log`
        ),
        format: winston.format.printf((info) =>
          this.formatOutput(info, { color: false })
        ),
      }),
    ]);
    this.formatHandlers.splice(1, 0, ["[", this.levelFormat, "]", " "]);
    if (loggerName) {
      this.formatHandlers.splice(1, 0, [`[${loggerName}]`, " "]);
    }
    this.formatHandlers.push(this.colorFormat);
  }

  levelFormat(message: string, info: LoggerMeta) {
    const level = info.level.toUpperCase();
    switch (level) {
      case "DEBUG":
        return (
          message + `{{color-cyan}}DEBUG-${info.debugLevel}{{color-reset}}`
        );
      case "INFO":
        return message + "{{color-brightGreen}}資訊{{color-reset}}";
      case "WARN":
        return message + "{{color-brightYellow}}警告{{color-reset}}";
      case "ERROR":
        return message + "{{color-brightRed}}錯誤{{color-reset}}";
      default:
        return message + level;
    }
  }

  formatOutput(info: LoggerMeta, option?: LoggerOption) {
    return super.formatOutput(info, { color: option ? option.color : true });
  }

  colorFormat(message: string, info: LoggerMeta, option: LoggerOption) {
    return formatString(message, option.color ? escapeCode : escapeCodeEmpty);
  }
}

export class LoggerService {
  private logger: Logger;
  constructor(loggerName?: string) {
    this.logger = new Logger(loggerName);
  }

  getDebugLevel() {
    if (!("NODE_ENV" in process.env) || !("DEBUG_LEVEL" in process.env))
      return Number.MAX_SAFE_INTEGER;
    const level = Number.parseInt(process.env.DEBUG_LEVEL);
    if (!Number.isInteger(level)) return -1;
    return level;
  }

  debug(level: number, ...message: string[]) {
    if (!Number.isInteger(level)) return;
    if (level < 0) return;
    if (this.getDebugLevel() < level) return;
    this.logger.debug(message.join(" "), {
      debugLevel: level,
    });
  }

  info(...message: string[]) {
    return this.logger.info(message.join(" "));
  }

  warn(...message: string[]) {
    return this.logger.warn(message.join(" "));
  }

  error(...message: string[]) {
    return this.logger.error(message.join(" "));
  }

  log(...message: string[]) {
    return this.info(...message);
  }
}
