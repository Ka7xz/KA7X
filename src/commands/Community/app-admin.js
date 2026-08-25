import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

import {
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import {
    withErrorHandling
} from '../../utils/errorHandler.js';

import {
    handleApplicationSetup
} from './App-setup.js';

import {
    handleApplicationDashboard
} from './App-dashboard.js';


// ============================================================
// APPLICATION ADMIN COMMAND
// ============================================================

export default {
    data: new SlashCommandBuilder()
        .setName('app-admin')
        .setDescription('Manage the application system')

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        // ----------------------------------------------------
        // SETUP
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Create a new application'
                )
        )

        // ----------------------------------------------------
        // DASHBOARD
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription(
                    'Open the application dashboard'
                )
        ),

    category: 'Community',

    slashOnly: true,

    execute: withErrorHandling(
        async interaction => {

            // =================================================
            // SERVER CHECK
            // =================================================

            if (!interaction.inGuild()) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.UNKNOWN,

                        message:
                            'This command can only be used in a server.'
                    }
                );
            }


            // =================================================
            // PERMISSION CHECK
            // =================================================

            if (
                !interaction.memberPermissions?.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.PERMISSION,

                        message:
                            'You need the Manage Server permission to use this command.'
                    }
                );
            }


            // =================================================
            // GET SUBCOMMAND
            // =================================================

            const subcommand =
                interaction.options.getSubcommand();


            // =================================================
            // SETUP
            // =================================================

            if (
                subcommand === 'setup'
            ) {

                return handleApplicationSetup(
                    interaction
                );
            }


            // =================================================
            // DASHBOARD
            // =================================================

            if (
                subcommand === 'dashboard'
            ) {

                return handleApplicationDashboard(
                    interaction
                );
            }


            // =================================================
            // UNKNOWN
            // =================================================

            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.USER_INPUT,

                    message:
                        'Unknown application command.'
                }
            );
        },

        {
            type:
                'command',

            commandName:
                'app-admin'
        }
    )
};
