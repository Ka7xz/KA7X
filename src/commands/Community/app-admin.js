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
    ComponentType,
    MessageFlags
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
    getApplication
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';

import { logger } from '../../utils/logger.js';


// ============================================================
// APP-ADMIN
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
                            'Filter by applicant'
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
// APPLICATION SETUP
// ============================================================

async function handleApplicationSetup(interaction) {

    /*
     * STEP 1
     * Show role selector.
     */

    const roleSelect =
        new RoleSelectMenuBuilder()
            .setCustomId(
                `app_setup_role_${interaction.user.id}`
            )
            .setPlaceholder(
                'Select the role users will apply for'
            )
            .setMinValues(1)
            .setMaxValues(1);

    const roleRow =
        new ActionRowBuilder()
            .addComponents(
                roleSelect
            );


    await interaction.reply({
        embeds: [
            createEmbed({
                title: 'Application Setup',
                description:
                    'Select the Discord role that applicants will be applying for.'
            })
        ],
        components: [
            roleRow
        ],
        flags: MessageFlags.Ephemeral
    });


    /*
     * STEP 2
     * Wait for role selection.
     */

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
                            `app_setup_role_${interaction.user.id}`
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


    /*
     * STEP 3
     * Verify role.
     */

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


    /*
     * STEP 4
     * Check duplicate.
     */

    const existingRoles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const roles =
        Array.isArray(existingRoles)
            ? existingRoles
            : [];


    const alreadyExists =
        roles.some(
            application =>
                String(application.roleId) ===
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


    /*
     * STEP 5
     * Update selector message.
     */

    await roleInteraction.update({

        embeds: [
            createEmbed({
                title:
                    'Application Setup',

                description:
                    `Selected role: ${role}\n\n` +
                    'Opening the configuration form...'
            })
        ],

        components: []
    });


    /*
     * STEP 6
     * Configuration modal.
     *
     * No LabelBuilder is used.
     */

    const modal =
        new ModalBuilder()
            .setCustomId(
                `app_setup_modal_${roleId}_${interaction.user.id}`
            )
            .setTitle(
                'Application Configuration'
            );


    const nameInput =
        new TextInputBuilder()
            .setCustomId(
                'app_name'
            )
            .setLabel(
                'Application Name'
            )
            .setPlaceholder(
                'Moderator'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setMinLength(1)
            .setMaxLength(50)
            .setRequired(true);


    const question1 =
        new TextInputBuilder()
            .setCustomId(
                'question_1'
            )
            .setLabel(
                'Question 1'
            )
            .setPlaceholder(
                'Why do you want this role?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(true);


    const question2 =
        new TextInputBuilder()
            .setCustomId(
                'question_2'
            )
            .setLabel(
                'Question 2'
            )
            .setPlaceholder(
                'What experience do you have?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(false);


    const question3 =
        new TextInputBuilder()
            .setCustomId(
                'question_3'
            )
            .setLabel(
                'Question 3'
            )
            .setPlaceholder(
                'Why should we choose you?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(false);


    const question4 =
        new TextInputBuilder()
            .setCustomId(
                'question_4'
            )
            .setLabel(
                'Question 4'
            )
            .setPlaceholder(
                'How active are you?'
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


    /*
     * STEP 7
     * Show modal.
     */

    try {

        await roleInteraction.showModal(
            modal
        );

    } catch (error) {

        logger.error(
            'Failed to show application setup modal',
            {
                error: error.message,
                stack: error.stack,
                guildId:
                    interaction.guild.id,
                userId:
                    interaction.user.id,
                roleId
            }
        );

        return;
    }


    /*
     * STEP 8
     * Wait for modal submission.
     */

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
                            `app_setup_modal_${roleId}_${interaction.user.id}`
            });

    } catch {

        logger.info(
            'Application setup modal expired',
            {
                guildId:
                    interaction.guild.id,

                userId:
                    interaction.user.id,

                roleId
            }
        );

        return;
    }


    /*
     * STEP 9
     * Read submitted values.
     */

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

    ].filter(
        question =>
            question.length > 0
    );


    /*
     * STEP 10
     * Final duplicate check.
     */

    const currentRoles =
        await getApplicationRoles(
            submitted.client,
            submitted.guild.id
        );

    const finalRoles =
        Array.isArray(currentRoles)
            ? currentRoles
            : [];


    if (
        finalRoles.some(
            application =>
                String(application.roleId) ===
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


    /*
     * STEP 11
     * Save application role.
     */

    finalRoles.push({

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
        finalRoles
    );


    /*
     * STEP 12
     * Enable application system.
     */

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


    /*
     * STEP 13
     * Save questions.
     */

    await saveApplicationRoleSettings(
        submitted.client,
        submitted.guild.id,
        String(roleId),
        {
            questions
        }
    );


    /*
     * STEP 14
     * Success.
     */

    await submitted.reply({

        embeds: [
            successEmbed(
                'Application Created',

                `**${appName}** has been created for ${role}.\n\n` +
                'Use `/apply` to send the application panel.'
            )
        ],

        flags:
            MessageFlags.Ephemeral
    });
}


// ============================================================
// APPLICATION LIST
// ============================================================

async function handleApplicationList(interaction) {

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


    if (!Array.isArray(applications)) {
        applications = [];
    }


    if (user) {

        applications =
            applications.filter(
                application =>
                    String(application.userId) ===
                    String(user.id)
            );
    }


    if (applications.length === 0) {

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
                application =>
                    `\`${application.id}\` — <@${application.userId}> — **${application.roleName}** — ${application.status}`
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
// APPLICATION REVIEW
// ============================================================

async function handleApplicationReview(interaction) {

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


    if (
        application.status !==
        'pending'
    ) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'This application has already been processed.'
            }
        );
    }


    const approveButton =
        new ButtonBuilder()
            .setCustomId(
                `
