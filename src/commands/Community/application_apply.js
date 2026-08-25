import { showApplicationModal } from './apply.js';

import {
    getApplicationRoles
} from '../utils/database.js';

import {
    ErrorTypes,
    replyUserError
} from '../utils/errorHandler.js';


// ============================================================
// APPLICATION APPLY BUTTON HANDLER
// Custom ID:
// application_apply:ROLE_ID
// ============================================================

export async function handleApplicationButton(interaction) {

    // Ignore non-button interactions
    if (!interaction.isButton()) {
        return false;
    }

    // Ignore other buttons
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

    const roleId =
        interaction.customId.split(':')[1];

    if (!roleId) {
        await replyUserError(interaction, {
            type: ErrorTypes.CONFIGURATION,
            message:
                'Invalid application button.'
        });

        return true;
    }


    // ========================================================
    // MAKE SURE BUTTON IS USED IN A SERVER
    // ========================================================

    if (!interaction.inGuild()) {
        await replyUserError(interaction, {
            type: ErrorTypes.UNKNOWN,
            message:
                'Applications can only be used in a server.'
        });

        return true;
    }


    // ========================================================
    // GET APPLICATION ROLES
    // ========================================================

    let applicationRoles;

    try {
        applicationRoles =
            await getApplicationRoles(
                interaction.client,
                interaction.guild.id
            );
    } catch (error) {

        console.error(
            'Failed to load application roles:',
            error
        );

        await replyUserError(interaction, {
            type: ErrorTypes.UNKNOWN,
            message:
                'Unable to load applications right now.'
        });

        return true;
    }


    // ========================================================
    // FIND APPLICATION
    // ========================================================

    const applicationRole =
        applicationRoles?.find(
            app => String(app.roleId) === String(roleId)
        );

    if (!applicationRole) {
        await replyUserError(interaction, {
            type: ErrorTypes.CONFIGURATION,
            message:
                'This application is no longer available.'
        });

        return true;
    }


    // ========================================================
    // OPEN APPLICATION MODAL
    // ========================================================

    try {

        await showApplicationModal(
            interaction,
            applicationRole
        );

    } catch (error) {

        console.error(
            'Application button error:',
            error
        );

        // Don't attempt another response if Discord
        // has already received the interaction.
        if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Unable to open the application form.'
            });
        }
    }

    return true;
}
