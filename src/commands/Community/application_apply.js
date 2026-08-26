import {
    getApplicationRoles
} from '../../utils/database.js';

import {
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import ApplicationService from '../../services/applicationService.js';

import {
    showApplicationModal
} from './apply.js';


// ============================================================
// APPLICATION BUTTON HANDLER
// ============================================================

export async function handleApplicationButton(
    interaction
) {

    if (!interaction.isButton()) {
        return false;
    }


    // ========================================================
    // APPLY BUTTON
    // ========================================================

    if (
        interaction.customId.startsWith(
            'application_apply:'
        )
    ) {

        const roleId =
            interaction.customId
                .split(':')[1];

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


        const roles =
            await getApplicationRoles(
                interaction.client,
                interaction.guild.id
            );

        const applicationRole =
            Array.isArray(roles)
                ? roles.find(
                    item =>
                        String(item.roleId) ===
                        String(roleId)
                )
                : null;


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


        const role =
            await interaction.guild.roles
                .fetch(roleId)
                .catch(() => null);

        if (!role) {

            await replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.CONFIGURATION,

                    message:
                        'The application role no longer exists.'
                }
            );

            return true;
        }


        await showApplicationModal(
            interaction,
            applicationRole
        );

        return true;
    }


    // ========================================================
    // REVIEW BUTTON
    // ========================================================

    if (
        interaction.customId.startsWith(
            'app_review:'
        )
    ) {

        const parts =
            interaction.customId.split(':');

        const action =
            parts[1];

        const applicationId =
            parts.slice(2).join(':');


        if (
            !['approve', 'deny'].includes(action) ||
            !applicationId
        ) {

            await replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.CONFIGURATION,

                    message:
                        'Invalid review button.'
                }
            );

            return true;
        }


        const application =
            await ApplicationService.getSingleApplication(
                interaction.client,
                interaction.guild.id,
                applicationId
            );


        if (
            application.status !==
            'pending'
        ) {

            await replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.USER_INPUT,

                    message:
                        'This application has already been reviewed.'
                }
            );

            return true;
        }


        // ====================================================
        // REVIEW
        // ====================================================

        let updated;

        try {

            updated =
                await ApplicationService.reviewApplication(
                    interaction.client,
                    interaction.guild.id,
                    applicationId,
                    {
                        action,

                        reason:
                            action === 'approve'
                                ? 'Application approved.'
                                : 'Application denied.',

                        reviewerId:
                            interaction.user.id
                    }
                );

        } catch (error) {

            console.error(
                'Application review error:',
                error
            );

            await replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.UNKNOWN,

                    message:
                        'The application could not be reviewed.'
                }
            );

            return true;
        }


        // ====================================================
        // GIVE ROLE WHEN APPROVED
        // ====================================================

        if (
            action === 'approve' &&
            application.roleId
        ) {

            try {

                const member =
                    await interaction.guild.members
                        .fetch(application.userId);

                await member.roles.add(
                    application.roleId,
                    'Application approved'
                );

            } catch (error) {

                console.error(
                    'Could not assign application role:',
                    error
                );
            }
        }


        // ====================================================
        // UPDATE REVIEW MESSAGE
        // ====================================================

        const statusText =
            action === 'approve'
                ? 'Approved'
                : 'Denied';

        try {

            await interaction.update({

                embeds: [
                    {
                        title:
                            'Application Reviewed',

                        description:
                            `Application \`${updated.id}\` has been **${statusText}**.\n\n` +
                            `Reviewed by <@${interaction.user.id}>`
                    }
                ],

                components: []
            });

        } catch {

            if (!interaction.replied) {

                await interaction.reply({

                    content:
                        `Application ${statusText.toLowerCase()}.`,

                    ephemeral: true
                });
            }
        }

        return true;
    }


    return false;
                    }
