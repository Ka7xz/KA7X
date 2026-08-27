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
    getApplication,
    getApplicationRoles,
    saveApplicationRoles
} from '../../utils/database.js';

import {
    handleApplicationSetup
} from './appSetup.js';

import { logger } from '../../utils/logger.js';


// ============================================================
// APPLICATION ADMIN COMMAND
// ============================================================

export default {

    data: new SlashCommandBuilder()
        .setName('configure')
        .setDescription(
            'Manage staff applications'
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )


        // ====================================================
        // SETUP
        // ====================================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Create a staff application'
                )
        )


        // ====================================================
        // ENABLE
        // ====================================================

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
                            'The application role to enable'
                        )
                        .setRequired(true)
                )
        )


        // ====================================================
        // DISABLE
        // ====================================================

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
                            'The application role to disable'
                        )
                        .setRequired(true)
                )
        )


        // ====================================================
        // LIST
        // ====================================================

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


        // ====================================================
        // REVIEW
        // ====================================================

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
                        'This command can only be used in a server.'
                }
            );
        }


        const subcommand =
            interaction.options.getSubcommand();


        try {

            // ==================================================
            // SETUP
            // ==================================================

            if (
                subcommand === 'setup'
            ) {

                return handleApplicationSetup(
                    interaction
                );
            }


            // ==================================================
            // ENABLE
            // ==================================================

            if (
                subcommand === 'enable'
            ) {

                return handleApplicationToggle(
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

                return handleApplicationToggle(
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

                return handleApplicationList(
                    interaction
                );
            }


            // ==================================================
            // REVIEW
            // ==================================================

            if (
                subcommand === 'review'
            ) {

                return handleApplicationReview(
                    interaction
                );
            }

        } catch (error) {

            logger.error(
                'Application admin command error',
                {
                    error:
                        error.message,

                    stack:
                        error.stack,

                    guildId:
                        interaction.guild.id,

                    userId:
                        interaction.user.id,

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
                    type:
                        ErrorTypes.UNKNOWN,

                    message:
                        'Something went wrong while processing this command.'
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


    // ========================================================
    // GET APPLICATION ROLES
    // ========================================================

    const existing =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );


    const roles =
        Array.isArray(existing)
            ? existing
            : [];


    // ========================================================
    // FIND APPLICATION
    // ========================================================

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


    // ========================================================
    // ALREADY IN REQUESTED STATE
    // ========================================================

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


    // ========================================================
    // CHANGE STATUS
    // ========================================================

    application.enabled =
        enabled;


    // ========================================================
    // SAVE
    // ========================================================

    await saveApplicationRoles(
        interaction.client,
        interaction.guild.id,
        roles
    );


    // ========================================================
    // SUCCESS
    // ========================================================

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

                    const applicant =
                        `<@${application.userId}>`;


                    return (
                        `\`${application.id}\` ` +
                        `— ${applicant} ` +
                        `— **${application.roleName || 'Unknown'}** ` +
                        `— **${application.status}**`
                    );
                }
            );


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
        interaction.options.getString(
            'id'
        );


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
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Application not found.'
            }
        );
    }


    // ========================================================
    // REVIEW EMBED
    // ========================================================

    const embed =
        createEmbed({

            title:
                'Application Review',

            description:
                `**Application ID:** \`${application.id}\`\n` +
                `**Applicant:** <@${application.userId}>\n` +
                `**Role:** ${application.roleName || 'Unknown'}\n` +
                `**Status:** ${application.status}\n\n` +
                formatAnswers(
                    application.answers
                )
        });


    // ========================================================
    // ALREADY REVIEWED
    // ========================================================

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


    // ========================================================
    // APPROVE BUTTON
    // ========================================================

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


    // ========================================================
    // DENY BUTTON
    // ========================================================

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


    // ========================================================
    // BUTTON ROW
    // ========================================================

    const row =
        new ActionRowBuilder()
            .addComponents(
                approve,
                deny
            );


    // ========================================================
    // SEND REVIEW
    // ========================================================

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
        !Array.isArray(answers)
    ) {

        return (
            'No answers were recorded.'
        );
    }


    return answers

        .map(
            item =>
                `**${item.question}**\n` +
                `${item.answer || 'No answer'}`
        )

        .join('\n\n')

        .slice(
            0,
            4000
        );
    }
