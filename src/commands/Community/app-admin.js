import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
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

import {
    handleApplicationSetup
} from './appSetup.js';

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

            .addSubcommand(subcommand =>
                subcommand
                    .setName('setup')
                    .setDescription(
                        'Create a new staff application'
                    )
            )

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
                                'Filter by application status'
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
                                'Filter by applicant'
                            )
                    )
            )

            .addSubcommand(subcommand =>
                subcommand
                    .setName('review')
                    .setDescription(
                        'Review an application'
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

    category: 'Community',

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return replyUserError(
                interaction,
                {
                    type: ErrorTypes.UNKNOWN,
                    message:
                        'This command can only be used inside a server.'
                }
            );
        }

        try {
            await ApplicationService.checkManagerPermission(
                interaction.client,
                interaction.guild.id,
                interaction.member
            );

            const subcommand =
                interaction.options.getSubcommand();

            if (subcommand === 'setup') {
                return handleApplicationSetup(
                    interaction
                );
            }

            if (subcommand === 'list') {
                return handleApplicationList(
                    interaction
                );
            }

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
                        'Unknown application command.'
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
        [
            status
                ? `Status: **${status}**`
                : null,

            user
                ? `User: ${user}`
                : null
        ]
            .filter(Boolean)
            .join(' • ');

    const description =
        (
            filterText
                ? `${filterText}\n\n`
                : ''
        ) +
        lines.join('\n');

    return interaction.reply({
        embeds: [
            createEmbed({
                title:
                    'Submitted Applications',
                description:
                    description.slice(
                        0,
                        4000
                    )
            })
        ],
        flags:
            MessageFlags.Ephemeral
    });
}

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

    if (status !== 'pending') {
        return interaction.reply({
            embeds: [embed],
            flags:
                MessageFlags.Ephemeral
        });
    }

    const approveButton =
        new ButtonBuilder()
            .setCustomId(
                `app_review:approve:${application.id}`
            )
            .setLabel('Approve')
            .setStyle(
                ButtonStyle.Success
            );

    const denyButton =
        new ButtonBuilder()
            .setCustomId(
                `app_review:deny:${application.id}`
            )
            .setLabel('Deny')
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
        embeds: [embed],
        components: [row],
        flags:
            MessageFlags.Ephemeral
    });
}

// ============================================================
// FORMAT ANSWERS
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

    return answers
        .map(
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
        )
        .join('\n\n');
                                }
