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

import {
    getApplications,
    getApplication,
    getApplicationRoles,
    saveApplicationRoles
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';

import {
    handleApplicationSetup
} from './appSetup.js';

import {
    logger
} from '../../utils/logger.js';


// ============================================================
// APPLICATION MANAGEMENT
// /configure applications
// ============================================================

export default {

    data: new SlashCommandBuilder()

        .setName('configure')

        .setDescription(
            'Configure and manage server features'
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        // ====================================================
        // APPLICATIONS
        // ====================================================

        .addSubcommandGroup(group =>
            group

                .setName('applications')

                .setDescription(
                    'Manage the server application system'
                )

                // ============================================
                // SETUP
                // ============================================

                .addSubcommand(subcommand =>
                    subcommand

                        .setName('setup')

                        .setDescription(
                            'Create a new staff application'
                        )
                )

                // ============================================
                // ENABLE
                // ============================================

                .addSubcommand(subcommand =>
                    subcommand

                        .setName('enable')

                        .setDescription(
                            'Enable a staff application'
                        )

                        .addRoleOption(option =>
                            option

                                .setName('role')

                                .setDescription(
                                    'The application role'
                                )

                                .setRequired(true)
                        )
                )

                // ============================================
                // DISABLE
                // ============================================

                .addSubcommand(subcommand =>
                    subcommand

                        .setName('disable')

                        .setDescription(
                            'Disable a staff application'
                        )

                        .addRoleOption(option =>
                            option

                                .setName('role')

                                .setDescription(
                                    'The application role'
                                )

                                .setRequired(true)
                        )
                )

                // ============================================
                // LIST
                // ============================================

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
                                    'Filter applications by applicant'
                                )
                        )
                )

                // ============================================
                // REVIEW
                // ============================================

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
                )
        ),


    category: 'Community',


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

            // ==================================================
            // PERMISSION CHECK
            // ==================================================

            await ApplicationService.checkManagerPermission(
                interaction.client,
                interaction.guild.id,
                interaction.member
            );


            const group =
                interaction.options.getSubcommandGroup();


            const subcommand =
                interaction.options.getSubcommand();


            if (
                group !== 'applications'
            ) {

                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.USER_INPUT,

                        message:
                            'Invalid application management command.'
                    }
                );
            }


            // ==================================================
            // SETUP
            // ==================================================

            if (
                subcommand === 'setup'
            ) {

                return await handleApplicationSetup(
                    interaction
                );
            }


            // ==================================================
            // ENABLE
            // ==================================================

            if (
                subcommand === 'enable'
            ) {

                return await handleApplicationToggle(
                    interaction,
                    true
                );
            }


            // ==================================================
            // DISABLE
            // ==================================================

            if (
                subcommand === 'disable'
            ) {

                return await handleApplicationToggle(
                    interaction,
                    false
                );
            }


            // ==================================================
            // LIST
            // ==================================================

            if (
                subcommand === 'list'
            ) {

                return await handleApplicationList(
                    interaction
                );
            }


            // ==================================================
            // REVIEW
            // ==================================================

            if (
                subcommand === 'review'
            ) {

                return await handleApplicationReview(
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

            logger.error(
                'Application management command failed',
                {
                    error:
                        error?.message,

                    stack:
                        error?.stack,

                    guildId:
                        interaction.guildId,

                    userId:
                        interaction.user?.id
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
// ENABLE / DISABLE APPLICATION
// ============================================================

async function handleApplicationToggle(
    interaction,
    enabled
) {

    const role =
        interaction.options.getRole(
            'role'
        );


    if (!role) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Please select an application role.'
            }
        );
    }


    const existing =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );


    const roles =
        Array.isArray(existing)
            ? existing
            : [];


    const application =
        roles.find(
            item =>
                String(item.roleId) ===
                String(role.id)
        );


    if (!application) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    `${role} is not configured as an application.`
            }
        );
    }


    const currentEnabled =
        application.enabled !== false;


    if (
        currentEnabled ===
        enabled
    ) {

        return interaction.reply({

            embeds: [

                createEmbed({

                    title:
                        enabled
                            ? 'Application Already Enabled'
                            : 'Application Already Disabled',

                    description:
                        enabled
                            ? `${role} is already enabled.`
                            : `${role} is already disabled.`
                })

            ],

            flags:
                MessageFlags.Ephemeral
        });
    }


    application.enabled =
        enabled;


    await saveApplicationRoles(
        interaction.client,
        interaction.guild.id,
        roles
    );


    return interaction.reply({

        embeds: [

            createEmbed({

                title:
                    enabled
                        ? 'Application Enabled'
                        : 'Application Disabled',

                description:
                    enabled
                        ? `${role} applications are now **enabled**.`
                        : `${role} applications are now **disabled**.`
            })

        ],

        flags:
            MessageFlags.Ephemeral
    });
}


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

        filters.status =
            status;
    }


    if (user) {

        filters.userId =
            user.id;
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
            .map(
                application => {

                    return (
                        `\`${application.id}\` ` +
                        `— <@${application.userId}> ` +
                        `— **${application.roleName || 'Unknown'}** ` +
                        `— **${application.status || 'unknown'}**`
                    );
                }
            );


    return interaction.reply({

        embeds: [

            createEmbed({

                title:
                    `Applications${status ? ` — ${status}` : ''}`,

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
            await ApplicationService.getSingleApplication(
                interaction.client,
                interaction.guild.id,
                applicationId
            );

    } catch {

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


    const answerText =
        formatAnswers(
            application.answers
        );


    const embed =
        createEmbed({

            title:
                'Application Review',

            description:
                `**Application ID:** \`${application.id}\`\n` +
                `**Applicant:** <@${application.userId}>\n` +
                `**Role:** ${application.roleName || 'Unknown'}\n` +
                `**Status:** ${application.status || 'unknown'}\n\n` +
                answerText
        });


    if (
        application.status !==
        'pending'
    ) {

        return interaction.reply({

            embeds: [
                embed
            ],

            flags:
                MessageFlags.Ephemeral
        });
    }


    const {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle
    } = await import(
        'discord.js'
    );


    const approve =
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


    const deny =
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
                approve,
                deny
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
// FORMAT ANSWERS
// ============================================================

function formatAnswers(
    answers
) {

    if (
        !Array.isArray(answers) ||
        answers.length === 0
    ) {

        return 'No answers were recorded.';
    }


    return answers
        .map(answer => {

            const question =
                String(
                    answer?.question ||
                    'Question'
                );

            const answerText =
                String(
                    answer?.answer ||
                    'No answer'
                );


            return (
                `**${question}**\n` +
                answerText
            );

        })
        .join('\n\n')

        .slice(
            0,
            3500
        );
}
