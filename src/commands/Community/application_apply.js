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
// APPLICATION APPLY BUTTON HANDLER
//
// Button custom ID:
// application_apply:ROLE_ID
// ============================================================

export async function handleApplicationButton(
    interaction
) {

    // ========================================================
    // ONLY HANDLE BUTTON INTERACTIONS
    // ========================================================

    if (!interaction.isButton()) {
        return false;
    }


    // ========================================================
    // IGNORE OTHER BUTTONS
    // ========================================================

    if (
        !interaction.customId.startsWith(
            'application_apply:'
        )
    ) {
        return false;
    }


    // ========================================================
    // SERVER CHECK
    // ========================================================

    if (!interaction.inGuild()) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.UNKNOWN,

                message:
                    'Applications can only be used in a server.'
            }
        );

        return true;
    }


    // ========================================================
    // GET ROLE ID
    // ========================================================

    const roleId =
        interaction.customId
            .split(':')
            .slice(1)
            .join(':');


    if (!roleId) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'Invalid application button.'
            }
        );

        return true;
    }


    // ========================================================
    // LOAD APPLICATIONS
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

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.UNKNOWN,

                message:
                    'Unable to load applications right now.'
            }
        );

        return true;
    }


    // ========================================================
    // FIND APPLICATION
    // ========================================================

    const applicationRole =
        Array.isArray(applicationRoles)

            ? applicationRoles.find(
                application =>
                    String(application.roleId) ===
                    String(roleId)
            )

            : null;


    // ========================================================
    // APPLICATION DOES NOT EXIST
    // ========================================================

    if (!applicationRole) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is no longer available.'
            }
        );

        return true;
    }


    // ========================================================
    // APPLICATION DISABLED
    // ========================================================

    if (
        applicationRole.enabled === false
    ) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is currently disabled.'
            }
        );

        return true;
    }


    // ========================================================
    // MAKE SURE ROLE STILL EXISTS
    // ========================================================

    const role =
        await interaction.guild.roles
            .fetch(applicationRole.roleId)
            .catch(() => null);


    if (!role) {

        await replyUserError(
            interaction
