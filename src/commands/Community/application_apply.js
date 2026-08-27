// ============================================================
// application_apply.js
// Handles the Apply button for staff applications
// ============================================================

import {
    getApplicationRoles
} from '../../utils/database.js';

import {
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import {
    showApplicationModal
} from './apply.js';


// ============================================================
// APPLICATION APPLY BUTTON
// ============================================================

export async function handleApplicationButton(interaction) {

    // --------------------------------------------------------
    // Only handle buttons
    // --------------------------------------------------------

    if (!interaction.isButton()) {
        return false;
    }


    // --------------------------------------------------------
    // Check custom ID
    // --------------------------------------------------------

    if (
        !interaction.customId.startsWith(
            'application_apply:'
        )
    ) {
        return false;
    }


    // ========================================================
    // GET ROLE ID
    // ========================================================

    const parts =
        interaction.customId.split(':');

    const roleId =
        parts[1];


    if (!roleId) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application button is invalid.'
            }
        );

        return true;
    }


    // ========================================================
    // MAKE SURE THIS IS IN A SERVER
    // ========================================================

    if (!interaction.guild) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.UNKNOWN,

                message:
                    'Applications can only be used inside a server.'
            }
        );

        return true;
    }


    // ========================================================
    // LOAD APPLICATION ROLES
    // ========================================================

    let configuredRoles;

    try {

        configuredRoles =
            await getApplicationRoles(
                interaction.client,
                interaction.guild.id
            );

    } catch (error) {

        console.error(
            'Could not load application roles:',
            error
        );

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.DATABASE,

                message:
                    'I could not load the application configuration.'
            }
