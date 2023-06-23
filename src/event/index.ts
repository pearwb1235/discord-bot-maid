import { CacheType, Client, ClientEvents, Interaction } from "discord.js";
import * as fs from "fs";
import * as path from "path";

export interface BaseEvent {
  name: keyof ClientEvents;
  once?: boolean;
  execute(interaction: Interaction<CacheType>): void | Promise<void>;
}

export const events: Record<string, BaseEvent> = {};

const eventsPath = path.join(__dirname);
const eventFiles = fs
  .readdirSync(eventsPath)
  .map((file) => path.join(eventsPath, file))
  .filter(
    (file) =>
      file !== __filename && (file.endsWith(".ts") || file.endsWith(".js"))
  );

for (const filePath of eventFiles) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const object = require(filePath);
    const Event = object.__esModule ? object.default : object;
    const e: BaseEvent = new Event();
    events[filePath] = e;
  } catch {
    console.log(
      `[WARNING] The event at ${filePath} is missing an event class.`
    );
  }
}

export function registerEvents(client: Client) {
  for (const filePath in events) {
    try {
      const event = events[filePath];
      const executeProxy = (interaction: Interaction<CacheType>) =>
        Promise.resolve(event.execute(interaction)).catch((e) => {
          console.error(e);
        });
      if (event.once) client.once(event.name, executeProxy);
      else client.on(event.name, executeProxy);
    } catch (e) {
      console.log(`[ERROR] Cannot register event at ${filePath}`);
      console.error(e);
    }
  }
}
