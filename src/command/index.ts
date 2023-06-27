import {
  CacheType,
  ChatInputCommandInteraction,
  Client,
  Events,
  Interaction,
  REST,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  Routes,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { logger } from "~/library/logger";

export interface BaseCommand {
  data:
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">
    | SlashCommandSubcommandsOnlyBuilder;
  execute(
    interaction: ChatInputCommandInteraction<CacheType>
  ): void | Promise<void>;
}

export const commands: Record<string, BaseCommand> = {};

const commandsPath = path.join(__dirname);
const commandFiles = fs
  .readdirSync(commandsPath)
  .map((file) => path.join(commandsPath, file))
  .filter(
    (file) =>
      file !== __filename && (file.endsWith(".ts") || file.endsWith(".js"))
  );

for (const filePath of commandFiles) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const object = require(filePath);
    const Command = object.__esModule ? object.default : object;
    const command: BaseCommand = new Command();
    commands[command.data.name] = command;
  } catch {
    logger.warn(`The command at ${filePath} is missing a command class.`);
  }
}

async function handlerCommands(interaction: Interaction<CacheType>) {
  if (!interaction.isChatInputCommand()) return;

  const command = commands[interaction.commandName];

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }
  await Promise.resolve(command.execute(interaction)).catch((e) => {
    logger.error(e.toString());
  });
}

export function addCommandHandler(client: Client) {
  refreshCommands();
  client.on(Events.InteractionCreate, handlerCommands);
}

export async function refreshCommands(): Promise<void> {
  // Construct and prepare an instance of the REST module
  const commandsJSONObj: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
    Object.values(commands).map((command) => command.data.toJSON());
  const commandsJSON = JSON.stringify(commandsJSONObj);
  try {
    if (
      commandsJSON ===
      fs.readFileSync(path.join(__dirname, ".cache")).toString()
    )
      return;
  } catch {}
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    logger.log(
      `Started refreshing ${commandsJSONObj.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = (await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENTID),
      { body: commandsJSONObj }
    )) as { length: string };
    fs.writeFileSync(path.join(__dirname, ".cache"), commandsJSON);

    logger.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    logger.error(error.toString());
  }
}
