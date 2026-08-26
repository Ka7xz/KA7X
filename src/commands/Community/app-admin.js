import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} from 'discord.js';

import {
    createEmbed
} from '../../utils/embeds.js';

import {
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import {
    getApplications,
    getApplication
} from '../../utils/database.js';

import {
    handleApplicationSetup
} from './appSetup.js';

import ApplicationService from '../../services/applicationService.js';

import { logger } from '../../utils/logger.js';

export default {

    data: new SlashCommandBuilder()
        .setName('app-admin')
        .setDescription('Manage staff applications')

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Create a staff application'
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
                            'Application status'
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
                        'This command can only be used in a server.'
                }
            );
        }

        const subcommand =
            interaction.options.getSubcommand();

        try {

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

        } catch (error) {

            logger.error(
                'Application admin command error',
                {
                    error: error.message,
                    stack: error.stack,
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    subcommand
                }
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
                    type: ErrorTypes.UNKNOWN,
                    message:
                        'Something went wrong while processing this command.'
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
        interaction.options.getString('status');

    const user =
        interaction.options.getUser('user');

    const filters = {};

    if (status) {
        filters.status = status;
    }

    if (user) {
        filters.userId = user.id;
    }

    const applications =
        await getApplications(
            interaction.client,
            interaction.guild.id,
            filters
        );

    if (
        !Array.isArray(applications) ||
        applications.length === 0
    ) {

        return interaction.reply({
            embeds: [
                createEmbed({
                    title: 'Applications',
                    description:
                        'No applications were found.'
                })
            ],
            flags: MessageFlags.Ephemeral
        });
    }

    const lines =
        applications
            .slice(0, 20)
            .map(application => {

                const applicant =
                    `<@${application.userId}>`;

                return (
                    `\`${application.id}\` ` +
                    `— ${applicant} ` +
                    `— **${application.roleName || 'Unknown'}** ` +
                    `— **${application.status}**`
                );
            });

    return interaction.reply({

        embeds: [
            createEmbed({
                title:
                    'Applications',

                description:
                    lines.join('\n')
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
        interaction.options.getString('id');

    const application =
        await getApplication(
            interaction.client,
            interaction.guild.id,
            applicationId
        );

    if (!application) {

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.USER_INPUT,
                message:
                    'Application not found.'
            }
        );
    }

    const embed =
        createEmbed({
            title:
                'Application Review',

            description:
                `**Application ID:** \`${application.id}\`\n` +
                `**Applicant:** <@${application.userId}>\n` +
                `**Role:** ${application.roleName || 'Unknown'}\n` +
                `**Status:** ${application.status}\n\n` +
                formatAnswers(application.answers)
        });

    if (application.status !== 'pending') {

        return interaction.reply({

            embeds: [embed],

            flags:
                MessageFlags.Ephemeral
        });
    }

    const approve =
        new ButtonBuilder()
            .setCustomId(
                `app_review:approve:${application.id}`
            )
            .setLabel('Approve')
            .setStyle(
                ButtonStyle.Success
            );

    const deny =
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
                approve,
                deny
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

function formatAnswers(
    answers
) {

    if (!Array.isArray(answers)) {

        return 'No answers were recorded.';
    }

    return answers
        .map(
            item =>
                `**${item.question}**\n${item.answer || 'No answer'}`
        )
        .join('\n\n')
        .slice(0, 4000);
            }
