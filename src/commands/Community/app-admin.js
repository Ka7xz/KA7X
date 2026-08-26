import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

import {
    ErrorTypes,
    replyUserError,
    withErrorHandling
} from '../../utils/errorHandler.js';

import ApplicationService from '../../services/applicationService.js';

import {
    handleApplicationSetup
} from './AppSetup.js';


// ============================================================
// APP-ADMIN COMMAND
// ============================================================

export default {

    data: new SlashCommandBuilder()
        .setName('app-admin')
        .setDescription('Manage staff applications')

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        // ----------------------------------------------------
        // /app-admin setup
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Create a new staff application'
                )
        ),


    category: 'Community',


    async execute(interaction) {

        // ====================================================
        // SERVER ONLY
        // ====================================================

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


        // ====================================================
        // GET SUBCOMMAND
        // ====================================================

        const subcommand =
            interaction.options.getSubcommand();


        // ====================================================
        // CHECK APPLICATION MANAGER PERMISSION
        // ====================================================

        try {

            await ApplicationService.checkManagerPermission(
                interaction.client,
                interaction.guild.id,
                interaction.member
            );

        } catch (error) {

            console.error(
                'Application manager permission check failed:',
                error
            );

            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.PERMISSION,

                    message:
                        'You do not have permission to manage applications.'
                }
            );
        }


        // ====================================================
        // SETUP
        // ====================================================

        if (
            subcommand === 'setup'
        ) {

            return handleApplicationSetup(
                interaction
            );
        }


        // ====================================================
        // UNKNOWN SUBCOMMAND
        // ====================================================

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Unknown application command.'
            }
        );
    }
};
