import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';

import {
    createEmbed
} from '../../utils/embeds.js';

import {
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import ApplicationService from '../../services/applicationService.js';

import {
    getApplications,
    getApplication
} from '../../utils/database.js';


// ============================================================
// /APP-ADMIN
// ============================================================

export default {

    data:
        new SlashCommandBuilder()
            .setName('app-admin')
            .setDescription(
                'Manage staff applications'
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageGuild
            )

            // ================================================
            // LIST
            // ================================================

            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription(
                        'List submitted applications'
                    )

                    .addStringOption(option =>
                        option
                            .setName('status')
                            .setDescription(
                                'Filter applications by status'
                            )
                            .addChoices(
                                {
                                    name: 'Pending',
                                    value: 'pending'
                                },
                                {
                                    name: 'Approved',
                                    value: 'approved'
                                },
                                {
                                    name: 'Denied',
                                    value: 'denied'
                                }
                            )
                    )

                    .addUserOption(option =>
                        option
                            .setName('user')
                            .setDescription(
                                'Filter applications by user'
                            )
                    )
            )

            // ================================================
            // REVIEW
            // ================================================

            .addSubcommand(subcommand =>
                subcommand
                    .setName('review')
                    .setDescription(
                        'Review a submitted application'
                    )

                    .addStringOption(option =>
                        option
                            .setName('id')
                            .setDescription(
                                'Application ID'
                            )
                            .setRequired(true)
                    )
            ),

    category:
        'Community',
      // ========================================================
    // EXECUTE
    // ========================================================

    async execute(interaction) {

        if (!interaction.inGuild()) {

            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.UNKNOWN,

                    message:
                        'This command can only be used inside a server.'
                }
            );
        }


        try {

            // ================================================
            // CHECK PERMISSION
            // ================================================

            await ApplicationService.checkManagerPermission(
                interaction.client,
                interaction.guild.id,
                interaction.member
            );


            const subcommand =
                interaction.options.getSubcommand();


            // ================================================
            // LIST
            // ================================================

            if (subcommand === 'list') {

                return handleApplicationList(
                    interaction
                );
            }


            // ================================================
            // REVIEW
            // ================================================

            if (subcommand === 'review') {

                return handleApplicationReview(
                    interaction
                );
            }


            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.USER_INPUT,

                    message:
                        'Unknown application management command.'
                }
            );

        } catch (error) {

            console.error(
                'App-admin command error:',
                error
            );


            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return;
            }


            return replyUserError(
                interaction,
                {
                    type:
                        error?.type ||
                        ErrorTypes.UNKNOWN,

                    message:
                        error?.userMessage ||
                        'Something went wrong while managing applications.'
                }
            );
        }
    }
};
// ============================================================
// LIST APPLICATIONS
// ============================================================

async function handleApplicationList(
    interaction
) {

    const status =
        interaction.options.getString(
            'status'
        );

    const user =
        interaction.options.getUser(
            'user'
        );


    const filters = {};


    if (status) {
        filters.status = status;
    }

    if (user) {
        filters.userId = user.id;
    }


    let applications;

    try {

        applications =
            await getApplications(
                interaction.client,
                interaction.guild.id,
                filters
            );

    } catch (error) {

        console.error(
            'Could not load applications:',
            error
        );

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.DATABASE,

                message:
                    'I could not load the applications.'
            }
        );
    }


    if (
        !Array.isArray(applications) ||
        applications.length === 0
    ) {

        return interaction.reply({

            embeds: [

                createEmbed({

                    title:
                        'Applications',

                    description:
                        'No applications were found.'
                })

            ],

            flags:
                MessageFlags.Ephemeral
        });
    }


    const lines =
        applications
            .slice(0, 20)
            .map(application => {

                const id =
                    String(
                        application.id ||
                        'unknown'
                    );

                const applicant =
                    application.userId
                        ? `<@${application.userId}>`
                        : 'Unknown user';

                const role =
                    application.roleName ||
                    'Unknown role';

                const applicationStatus =
                    application.status ||
                    'unknown';


                return (
                    `\`${id}\` — ` +
                    `${applicant} — ` +
                    `**${role}** — ` +
                    `**${applicationStatus}**`
                );
            });


    const filterText =
      // ============================================================
// REVIEW APPLICATION
// ============================================================

async function handleApplicationReview(
    interaction
) {

    const applicationId =
        interaction.options.getString(
            'id'
        );


    if (!applicationId) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Please provide an application ID.'
            }
        );
    }


    let application;

    try {

        application =
            await getApplication(
                interaction.client,
                interaction.guild.id,
                applicationId
            );

    } catch (error) {

        console.error(
            'Could not load application:',
            error
        );

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.DATABASE,

                message:
                    'I could not load that application.'
            }
        );
    }


    if (!application) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Application not found.'
            }
        );
    }


    const status =
        application.status ||
        'unknown';


    const applicant =
        application.userId
            ? `<@${application.userId}>`
            : 'Unknown user';


    const roleName =
        application.roleName ||
        'Unknown role';


    const answersText =
        formatApplicationAnswers(
            application.answers
        );


    const description =
        `**Application ID:** \`${application.id}\`\n` +
        `**Applicant:** ${applicant}\n` +
        `**Role:** ${roleName}\n` +
        `**Status:** ${status}\n\n` +
        answersText;


    const embed =
        createEmbed({

            title:
                'Application Review',

            description:
                description.slice(
                    0,
                    4000
                )
        });


    // ================================================
    // ALREADY REVIEWED
    // ================================================

    if (status !== 'pending') {

        return interaction.reply({

            embeds: [
                embed
            ],

            flags:
                MessageFlags.Ephemeral
        });
    }


    // ================================================
    // REVIEW BUTTONS
    // ================================================

    const {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle
    } = await import(
        'discord.js'
    );


    const approveButton =
        new ButtonBuilder()
            .setCustomId(
                `app_review:approve:${application.id}`
            )
            .setLabel(
                'Approve'
            )
            .setStyle(
                ButtonStyle.Success
            );


    const denyButton =
        new ButtonBuilder()
            .setCustomId(
                `app_review:deny:${application.id}`
            )
            .setLabel(
                'Deny'
            )
            .setStyle(
                ButtonStyle.Danger
            );


    const row =
        new ActionRowBuilder()
            .addComponents(
                approveButton,
                denyButton
            );


    return interaction.reply({

        embeds: [
            embed
        ],

        components: [
            row
        ],

        flags:
            MessageFlags.Ephemeral
    });
}
  // ============================================================
// FORMAT APPLICATION ANSWERS
// ============================================================

function formatApplicationAnswers(
    answers
) {

    if (
        !Array.isArray(answers) ||
        answers.length === 0
    ) {

        return 'No answers were recorded.';
    }


    const formatted =
        answers.map(
            (item, index) => {

                const question =
                    String(
                        item?.question ||
                        `Question ${index + 1}`
                    ).trim();

                const answer =
                    String(
                        item?.answer ||
                        'No answer provided.'
                    ).trim();


                return (
                    `**${question}**\n` +
                    answer
                );
            }
        );


    return formatted.join(
        '\n\n'
    );
}
  // ============================================================
// NOTE
// ============================================================
//
// Application creation is NOT handled by /app-admin.
//
// New applications are created through:
//     appSetup.js
//
// Existing applications are configured through:
//     /configure applications
//
// Submitted applications are handled through:
//     application_apply.js
//     apply.js
//
// ============================================================
// ============================================================
// END OF APP-ADMIN COMMAND
// ============================================================
//
// The actual approve/deny button handling is intentionally
// kept outside this slash-command file.
//
// The buttons use these custom IDs:
//
//     app_review:approve:APPLICATION_ID
//     app_review:deny:APPLICATION_ID
//
// They will be handled by the application interaction handler.
//
// ============================================================
// ============================================================
// END OF APP-ADMIN COMMAND
// ============================================================
//
// The actual approve/deny button handling is intentionally
// kept outside this slash-command file.
//
// The buttons use these custom IDs:
//
//     app_review:approve:APPLICATION_ID
//     app_review:deny:APPLICATION_ID
//
// They will be handled by the application interaction handler.
//
// ============================================================
