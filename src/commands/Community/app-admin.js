import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    RoleSelectMenuBuilder,
    ComponentType
} from 'discord.js';

import {
    createEmbed,
    successEmbed
} from '../../utils/embeds.js';

import {
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import {
    getApplicationRoles,
    saveApplicationRoles,
    getApplicationSettings,
    saveApplicationRoleSettings,
    getApplications,
    getApplication,
    deleteApplication
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';

import { logger } from '../../utils/logger.js';


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
        // SETUP
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Create a new staff application'
                )
        )

        // ----------------------------------------------------
        // LIST
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription(
                    'List applications'
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
                            'Filter by user'
                        )
                )
        )

        // ----------------------------------------------------
        // REVIEW
        // ----------------------------------------------------

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

            // =================================================
            // SETUP
            // =================================================

            if (subcommand === 'setup') {

                return await handleApplicationSetup(
                    interaction
                );
            }


            // =================================================
            // LIST
            // =================================================

            if (subcommand === 'list') {

                return await handleApplicationList(
                    interaction
                );
            }


            // =================================================
            // REVIEW
            // =================================================

            if (subcommand === 'review') {

                return await handleApplicationReview(
                    interaction
                );
            }

        } catch (error) {

            logger.error(
                'App-admin command failed',
                {
                    error: error.message,
                    stack: error.stack,
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    subcommand
                }
            );

            if (
                interaction.deferred ||
                interaction.replied
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
// APPLICATION SETUP
// ============================================================

async function handleApplicationSetup(
    interaction
) {

    // --------------------------------------------------------
    // Send role selector
    // --------------------------------------------------------

    const roleSelect =
        new RoleSelectMenuBuilder()
            .setCustomId(
                'app_admin_setup_role'
            )
            .setPlaceholder(
                'Select the application role'
            )
            .setMinValues(1)
            .setMaxValues(1);

    const row =
        new ActionRowBuilder()
            .addComponents(
                roleSelect
            );


    await interaction.reply({
        embeds: [
            createEmbed({
                title: 'Application Setup',
                description:
                    'Select the Discord role that users will apply for.'
            })
        ],
        components: [
            row
        ],
        ephemeral: true
    });


    // --------------------------------------------------------
    // Wait for role selection
    // --------------------------------------------------------

    let roleInteraction;

    try {

        roleInteraction =
            await interaction.channel.awaitMessageComponent({

                componentType:
                    ComponentType.RoleSelect,

                time:
                    120000,

                filter:
                    component =>
                        component.user.id ===
                            interaction.user.id &&
                        component.customId ===
                            'app_admin_setup_role'
            });

    } catch {

        return interaction.editReply({
            embeds: [
                createEmbed({
                    title:
                        'Application Setup Expired',

                    description:
                        'The setup session expired. Run `/app-admin setup` again.'
                })
            ],

            components: []
        });
    }


    // --------------------------------------------------------
    // Get role
    // --------------------------------------------------------

    const roleId =
        roleInteraction.values?.[0];

    if (!roleId) {

        return roleInteraction.update({
            embeds: [
                createEmbed({
                    title:
                        'Application Setup',

                    description:
                        'No role was selected.'
                })
            ],

            components: []
        });
    }


    const role =
        await interaction.guild.roles
            .fetch(roleId)
            .catch(() => null);


    if (!role) {

        return roleInteraction.update({
            embeds: [
                createEmbed({
                    title:
                        'Application Setup',

                    description:
                        'The selected role could not be found.'
                })
            ],

            components: []
        });
    }


    // --------------------------------------------------------
    // Check duplicate
    // --------------------------------------------------------

    const existingRoles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const alreadyExists =
        Array.isArray(existingRoles) &&
        existingRoles.some(
            app =>
                String(app.roleId) ===
                String(roleId)
        );


    if (alreadyExists) {

        return roleInteraction.update({
            embeds: [
                createEmbed({
                    title:
                        'Application Already Exists',

                    description:
                        `The role ${role} is already configured as an application.`
                })
            ],

            components: []
        });
    }


    // --------------------------------------------------------
    // Acknowledge selection
    // --------------------------------------------------------

    await roleInteraction.update({
        embeds: [
            createEmbed({
                title:
                    'Application Setup',

                description:
                    `Selected role: ${role}\n\n` +
                    'Opening configuration form...'
            })
        ],

        components: []
    });


    // ========================================================
    // CONFIGURATION MODAL
    // ========================================================

    const modal =
        new ModalBuilder()
            .setCustomId(
                `app_admin_setup_modal_${roleId}`
            )
            .setTitle(
                'Application Configuration'
            );


    // --------------------------------------------------------
    // Application name
    // --------------------------------------------------------

    const nameInput =
        new TextInputBuilder()
            .setCustomId(
                'app_name'
            )
            .setLabel(
                'Application Name'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setPlaceholder(
                'Moderator'
            )
            .setMinLength(1)
            .setMaxLength(50)
            .setRequired(true);


    // --------------------------------------------------------
    // Question 1
    // --------------------------------------------------------

    const question1 =
        new TextInputBuilder()
            .setCustomId(
                'question_1'
            )
            .setLabel(
                'Question 1'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setPlaceholder(
                'Why do you want this role?'
            )
            .setMaxLength(1000)
            .setRequired(true);


    // --------------------------------------------------------
    // Question 2
    // --------------------------------------------------------

    const question2 =
        new TextInputBuilder()
            .setCustomId(
                'question_2'
            )
            .setLabel(
                'Question 2'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setPlaceholder(
                'What experience do you have?'
            )
            .setMaxLength(1000)
            .setRequired(false);


    // --------------------------------------------------------
    // Question 3
    // --------------------------------------------------------

    const question3 =
        new TextInputBuilder()
            .setCustomId(
                'question_3'
            )
            .setLabel(
                'Question 3'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(false);


    // --------------------------------------------------------
    // Question 4
    // --------------------------------------------------------

    const question4 =
        new TextInputBuilder()
            .setCustomId(
                'question_4'
            )
            .setLabel(
                'Question 4'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(false);


    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(nameInput),

        new ActionRowBuilder()
            .addComponents(question1),

        new ActionRowBuilder()
            .addComponents(question2),

        new ActionRowBuilder()
            .addComponents(question3),

        new ActionRowBuilder()
            .addComponents(question4)

    );


    // --------------------------------------------------------
    // Show modal
    // --------------------------------------------------------

    try {

        await roleInteraction.showModal(
            modal
        );

    } catch (error) {

        logger.error(
            'Failed to show application setup modal',
            {
                error: error.message,
                stack: error.stack
            }
        );

        return;
    }


    // ========================================================
    // WAIT FOR MODAL
    // ========================================================

    let submitted;

    try {

        submitted =
            await roleInteraction.awaitModalSubmit({

                time:
                    15 * 60 * 1000,

                filter:
                    modalInteraction =>
                        modalInteraction.user.id ===
                            interaction.user.id &&
                        modalInteraction.customId ===
                            `app_admin_setup_modal_${roleId}`
            });

    } catch {

        logger.info(
            'Application setup modal expired',
            {
                guildId:
                    interaction.guild.id,

                userId:
                    interaction.user.id
            }
        );

        return;
    }


    // ========================================================
    // READ MODAL
    // ========================================================

    const appName =
        submitted.fields
            .getTextInputValue(
                'app_name'
            )
            .trim();


    const questions = [

        submitted.fields
            .getTextInputValue(
                'question_1'
            )
            .trim(),

        submitted.fields
            .getTextInputValue(
                'question_2'
            )
            .trim(),

        submitted.fields
            .getTextInputValue(
                'question_3'
            )
            .trim(),

        submitted.fields
            .getTextInputValue(
                'question_4'
            )
            .trim()

    ].filter(Boolean);


    // ========================================================
    // SAVE ROLE
    // ========================================================

    const currentRoles =
        await getApplicationRoles(
            submitted.client,
            submitted.guild.id
        );


    if (
        currentRoles.some(
            app =>
                String(app.roleId) ===
                String(roleId)
        )
    ) {

        return replyUserError(
            submitted,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    `The role ${role} is already configured as an application.`
            }
        );
    }


    currentRoles.push({

        roleId:
            String(roleId),

        name:
            appName,

        enabled:
            true
    });


    await saveApplicationRoles(
        submitted.client,
        submitted.guild.id,
        currentRoles
    );


    // ========================================================
    // ENABLE SYSTEM
    // ========================================================

    const settings =
        await getApplicationSettings(
            submitted.client,
            submitted.guild.id
        );


    if (!settings?.enabled) {

        await ApplicationService.updateSettings(
            submitted.client,
            submitted.guild.id,
            {
                enabled: true
            }
        );
    }


    // ========================================================
    // SAVE QUESTIONS
    // ========================================================

    await saveApplicationRoleSettings(
        submitted.client,
        submitted.guild.id,
        String(roleId),
        {
            questions
        }
    );


    // ========================================================
    // SUCCESS
    // ========================================================

    await submitted.reply({

        embeds: [
            successEmbed(
                'Application Created',

                `**${appName}** has been created for ${role}.\n\n` +
                'Use `/apply` to display the application panel.'
            )
        ],

        ephemeral: true
    });
}


// ============================================================
// APPLICATION LIST
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


    let applications =
        await getApplications(
            interaction.client,
            interaction.guild.id,
            filters
        );


    if (user) {

        applications =
            applications.filter(
                app =>
                    String(app.userId) ===
                    String(user.id)
            );
    }


    if (!applications.length) {

        return interaction.reply({
            embeds: [
                createEmbed({
                    title:
                        'Applications',

                    description:
                        'No applications were found.'
                })
            ],

            ephemeral: true
        });
    }


    const lines =
        applications
            .slice(0, 20)
            .map(
                app =>
                    `\`${app.id}\` — <@${app.userId}> — **${app.roleName}** — ${app.status}`
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

        ephemeral: true
    });
}


// ============================================================
// APPLICATION REVIEW
// ============================================================

async function handleApplicationReview(
    interactio
