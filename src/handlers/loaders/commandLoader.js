import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Collection } from 'discord.js';
import { logger } from '../../utils/logger.js';
import botConfig from '../../config/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_COMMANDS = 100;
const COMMAND_COUNT_WARN_THRESHOLD = 90;


// ============================================================
// SUBCOMMAND INFO
// ============================================================

function getSubcommandInfo(commandData) {

    const subcommands = [];

    if (!commandData.options) {
        return subcommands;
    }

    for (const option of commandData.options) {

        if (option.type === 1) {

            subcommands.push(option.name);

        } else if (option.type === 2) {

            if (!option.options) {
                continue;
            }

            for (const subOption of option.options) {

                if (subOption.type === 1) {

                    subcommands.push(
                        `${option.name}/${subOption.name}`
                    );
                }
            }
        }
    }

    return subcommands;
}


// ============================================================
// GET ALL COMMAND FILES
// ============================================================

async function getAllFiles(
    directory,
    fileList = []
) {

    const files =
        await fs.readdir(
            directory,
            {
                withFileTypes: true
            }
        );

    for (const file of files) {

        const filePath =
            path.join(
                directory,
                file.name
            );

        if (file.isDirectory()) {

            if (
                file.name === 'modules'
            ) {
                continue;
            }

            await getAllFiles(
                filePath,
                fileList
            );

        } else if (
            file.name.endsWith('.js')
        ) {

            fileList.push(
                filePath
            );
        }
    }

    return fileList;
}


// ============================================================
// LOAD COMMANDS
// ============================================================

export async function loadCommands(
    client
) {

    client.commands =
        new Collection();

    const commandsPath =
        path.join(
            __dirname,
            '../../commands'
        );

    const commandFiles =
        await getAllFiles(
            commandsPath
        );

    logger.info(
        `Found ${commandFiles.length} command files to load`
    );

    const uniqueCommandNames =
        new Set();


    for (
        const filePath of commandFiles
    ) {

        try {

            const normalizedPath =
                filePath.replace(
                    /\\/g,
                    '/'
                );

            const commandModule =
                await import(
                    pathToFileURL(
                        filePath
                    ).href
                );

            const command =
                commandModule.default ||
                commandModule;


            // ================================================
            // VALIDATE COMMAND
            // ================================================

            if (
                !command.data ||
                !command.execute
            ) {

                logger.warn(
                    `Command at ${filePath} is missing required "data" or "execute" property.`
                );

                continue;
            }


            command.category =
                path.basename(
                    path.dirname(
                        filePath
                    )
                );

            command.filePath =
                normalizedPath;


            const primaryCommandName =
                command.data.name;


            // ================================================
            // DUPLICATE CHECK
            // ================================================

            if (
                uniqueCommandNames.has(
                    primaryCommandName
                )
            ) {

                logger.warn(
                    `Duplicate command detected: ${primaryCommandName}`
                );

                continue;
            }


            uniqueCommandNames.add(
                primaryCommandName
            );


            client.commands.set(
                primaryCommandName,
                command
            );


            // ================================================
            // LOG COMMAND
            // ================================================

            logger.info(
                `Loaded command: ${primaryCommandName} from ${normalizedPath}`
            );


            const subcommands =
                getSubcommandInfo(
                    command.data.toJSON()
                );


            if (
                subcommands.length > 0
            ) {

                logger.info(
                    `  - Subcommands: ${subcommands.join(', ')}`
                );
            }


        } catch (error) {

            logger.error(
                `Error loading command from ${filePath}:`,
                error
            );
        }
    }


    // ========================================================
    // FINAL COMMAND COUNT
    // ========================================================

    logger.info(
        `Loaded ${client.commands.size} unique slash commands`
    );


    // ========================================================
    // IMPORTANT COMMAND CHECK
    // ========================================================

    const hasApply =
        client.commands.has(
            'apply'
        );

    const hasAppAdmin =
        client.commands.has(
            'app-admin'
        );


    if (hasApply) {

        logger.info(
            'CONFIRMED: /apply command loaded successfully'
        );

    } else {

        logger.error(
            'ERROR: /apply command was NOT loaded'
        );
    }


    if (hasAppAdmin) {

        logger.info(
            'CONFIRMED: /app-admin command loaded successfully'
        );

    } else {

        logger.error(
            'ERROR: /app-admin command was NOT loaded'
        );
    }


    return client.commands;
}


// ============================================================
// COLLECT COMMAND PAYLOADS
// ============================================================

function collectCommandPayloads(
    client
) {

    const commands = [];

    let totalSubcommands = 0;

    const registeredNames =
        new Set();


    for (
        const command of client.commands.values()
    ) {

        if (
            !command.data ||
            typeof command.data.toJSON !==
                'function'
        ) {

            logger.warn(
                'Command missing data or toJSON method'
            );

            continue;
        }


        const commandName =
            command.data.name;


        if (
            registeredNames.has(
                commandName
            )
        ) {

            logger.warn(
                `Skipping duplicate command: ${commandName}`
            );

            continue;
        }


        registeredNames.add(
            commandName
        );


        const commandJson =
            command.data.toJSON();


        commands.push(
            commandJson
        );


        totalSubcommands +=
            getSubcommandInfo(
                commandJson
            ).length;
    }


    return {
        commands,
        totalSubcommands
    };
}


// ============================================================
// VALIDATE COMMANDS
// ============================================================

function validateCommands(
    commands
) {

    const validationErrors = [];


    for (
        const cmd of commands
    ) {

        if (
            cmd.name &&
            cmd.name.length > 32
        ) {

            validationErrors.push(
                `Command ${cmd.name} has a name longer than 32 characters`
            );
        }


        if (
            cmd.description &&
            cmd.description.length > 100
        ) {

            validationErrors.push(
                `Command ${cmd.name} has a description longer than 100 characters`
            );
        }


        if (
            !cmd.options
        ) {
            continue;
        }


        for (
            const option of cmd.options
        ) {

            if (
                option.name &&
                option.name.length > 32
            ) {

                validationErrors.push(
                    `Command ${cmd.name} option ${option.name} has a name longer than 32 characters`
                );
            }


            if (
                option.description &&
                option.description.length > 100
            ) {

                validationErrors.push(
                    `Command ${cmd.name} option ${option.name} has a description longer than 100 characters`
                );
            }


            if (
                option.options
            ) {

                for (
                    const subOption of option.options
                ) {

                    if (
                        subOption.name &&
                        subOption.name.length > 32
                    ) {

                        validationErrors.push(
                            `Command ${cmd.name} subcommand ${option.name} option ${subOption.name} has a name longer than 32 characters`
                        );
                    }


                    if (
                        subOption.description &&
                        subOption.description.length > 100
                    ) {

                        validationErrors.push(
                            `Command ${cmd.name} subcommand ${option.name} option ${subOption.name} has a description longer than 100 characters`
                        );
                    }
                }
            }
        }
    }


    if (
        validationErrors.length > 0
    ) {

        logger.error(
            'Command validation failed:'
        );


        for (
            const error of validationErrors
        ) {

            logger.error(
                `  - ${error}`
            );
        }


        throw new Error(
            `Command validation failed with ${validationErrors.length} errors`
        );
    }
}


// ============================================================
// PREPARE COMMANDS
// ============================================================

function prepareCommandsForRegistration(
    commands
) {

    if (
        commands.length >=
        COMMAND_COUNT_WARN_THRESHOLD
    ) {

        logger.warn(
            `Command count (${commands.length}) is near Discord's ${MAX_COMMANDS} global command limit`
        );
    }


    if (
        commands.length <=
        MAX_COMMANDS
    ) {

        return commands;
    }


    logger.error(
        `Command count (${commands.length}) exceeds Discord's global limit of ${MAX_COMMANDS}`
    );


    return commands.slice(
        0,
        MAX_COMMANDS
    );
}


// ============================================================
// REGISTER GLOBAL COMMANDS
// ============================================================

async function registerGlobalCommands(
    client,
    clientId,
    commands,
    totalSubcommands
) {

    if (!clientId) {

        throw new Error(
            'CLIENT_ID is required for slash command registration'
        );
    }


    if (!client.rest) {

        throw new Error(
            'Discord REST client is not available'
        );
    }


    logger.info(
        `Preparing ${commands.length} global slash commands`
    );


    // ========================================================
    // VALIDATE
    // ========================================================

    validateCommands(
        commands
    );


    logger.info(
        'Command validation passed'
    );


    const commandsToRegister =
        prepareCommandsForRegistration(
            commands
        );


    // ========================================================
    // SHOW EXACT COMMANDS
    // ========================================================

    logger.info(
        `Commands being registered globally:`
    );


    logger.info(
        commandsToRegister
            .map(
                command =>
                    `/${command.name}`
            )
            .join(', ')
    );


    // ========================================================
    // CHECK APPLY
    // ========================================================

    const applyCommand =
        commandsToRegister.find(
            command =>
                command.name ===
                'apply'
        );


    if (applyCommand) {

        logger.info(
            'REGISTER CHECK: /apply IS INCLUDED'
        );

    } else {

        logger.error(
            'REGISTER CHECK: /apply IS NOT INCLUDED'
        );
    }


    // ========================================================
    // CHECK APP-ADMIN
    // ========================================================

    const appAdminCommand =
        commandsToRegister.find(
            command =>
                command.name ===
                'app-admin'
        );


    if (appAdminCommand) {

        logger.info(
            'REGISTER CHECK: /app-admin IS INCLUDED'
        );

    } else {

        logger.error(
            'REGISTER CHECK: /app-admin IS NOT INCLUDED'
        );
    }


    // ========================================================
    // REGISTER
    // ========================================================

    logger.info(
        `Registering ${commandsToRegister.length} GLOBAL commands with Discord...`
    );


    /*
     * IMPORTANT:
     *
     * This registers GLOBAL commands.
     *
     * Every server where the bot is installed
     * can receive these commands.
     *
     * We intentionally do NOT clear the commands
     * first.
     */

    const registered =
        await client.rest.put(
            `/applications/${clientId}/commands`,
            {
                body:
                    commandsToRegister
            }
        );


    logger.info(
        `Successfully registered ${registered.length} GLOBAL slash commands`
    );


    // ========================================================
    // FINAL CONFIRMATION
    // ========================================================

    const registeredApply =
        registered.find(
            command =>
                command.name ===
                'apply'
        );


    if (registeredApply) {

        logger.info(
            'DISCORD CONFIRMATION: /apply was successfully registered'
        );

    } else {

        logger.error(
            'DISCORD CONFIRMATION: /apply was NOT returned by Discord'
        );
    }


    const registeredAppAdmin =
        registered.find(
            command =>
                command.name ===
                'app-admin'
        );


    if (registeredAppAdmin) {

        logger.info(
            'DISCORD CONFIRMATION: /app-admin was successfully registered'
        );

    } else {

        logger.error(
            'DISCORD CONFIRMATION: /app-admin was NOT returned by Discord'
        );
    }


    logger.info(
        `Total top-level commands: ${commandsToRegister.length}`
    );


    logger.info(
        `Total subcommands: ${totalSubcommands}`
    );
}


// ============================================================
// REGISTER COMMANDS
// ============================================================

export async function registerCommands(
    client,
    options = {}
) {

    const {
        clientId = null
    } = options;


    try {

        const {
            commands,
            totalSubcommands
        } =
            collectCommandPayloads(
                client
            );


        await registerGlobalCommands(
            client,
            clientId,
            commands,
            totalSubcommands
        );


    } catch (error) {

        logger.error(
            'Error registering global commands:',
            error
        );


        throw error;
    }
}


// ============================================================
// RELOAD COMMAND
// ============================================================

export async function reloadCommand(
    client,
    commandName
) {

    const command =
        client.commands.get(
            commandName
        );


    if (!command) {

        return {
            success: false,

            message:
                `Command "${commandName}" not found`
        };
    }


    try {

        const commandPath =
            path.resolve(
                command.filePath
            );


        const moduleUrl =
            pathToFileURL(
                commandPath
            );


        moduleUrl.searchParams.set(
            't',
            Date.now().toString()
        );


        const newCommand =
            (
                await import(
                    moduleUrl.href
                )
            ).default;


        client.commands.set(
            commandName,
            newCommand
        );


        logger.info(
            `Reloaded command: ${commandName}`
        );


        return {

            success: true,

            message:
                `Successfully reloaded command "${commandName}"`
        };


    } catch (error) {

        logger.error(
            `Error reloading command "${commandName}":`,
            error
        );


        return {

            success: false,

            message:
                `Error reloading command: ${error.message}`
        };
    }
}
