// ============================================================
// appSetup.js
// Creates and configures a new staff application
// ============================================================

import {
    ActionRowBuilder,
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
    saveApplicationRoleSettings
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';


// ============================================================
// /APP-ADMIN SETUP
// ============================================================

export async function handleApplicationSetup(interaction) {

    const customId =
        `application_setup_role:${interaction.user.id}`;


    // ========================================================
    // ROLE SELECT MENU
    // ========================================================

    const roleMenu =
        new RoleSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(
                'Select the role applicants will receive'
            )
            .setMinValues(1)
            .setMaxValues(1);


    const row =
        new ActionRowBuilder()
            .addComponents(roleMenu);


    await interaction.reply({

        embeds: [
            createEmbed({

                title:
                    'Create Application',

                description:
                    'Select the Discord role that this application is for.'
            })
        ],

        components: [
            row
        ],

        flags:
            MessageFlags.Ephemeral
    });


    // ========================================================
    // WAIT FOR ROLE
    // ========================================================

    const setupMessage =
        await interaction.fetchReply();

    let roleInteraction;


    try {

        roleInteraction =
            await setupMessage.awaitMessageComponent({

                componentType:
                    ComponentType.RoleSelect,

                time:
                    120000,

                filter:
                    component =>
                        component.user.id ===
                            interaction.user.id &&

                        component.customId ===
                            customId
            });

    } catch (error) {

        console.error(
            'Application setup role selector expired:',
            error
        );


        return interaction.editReply({

            embeds: [
                createEmbed({

                    title:
                        'Setup Expired',

                    description:
                        'The application setup timed out. Run `/app-admin setup` again.'
                })
            ],

            components: []
        });
    }


    // ========================================================
    // GET SELECTED ROLE
    // ========================================================

    const role =
        roleInteraction.roles.first();


    if (!role) {

        return roleInteraction.update({

            embeds: [
                createEmbed({

                    title:
                        'Invalid Role',

                    description:
                        'No valid role was selected.'
                })
            ],

            components: []
        });
    }


    // ========================================================
    // CHECK BOT ROLE HIERARCHY
    // ========================================================

    const botMember =
        interaction.guild.members.me;


    if (!botMember) {

        return roleInteraction.update({

            embeds: [
                createEmbed({

                    title:
                        'Configuration Error',

                    description:
                        'I could not determine my server permissions.'
                })
            ],

            components: []
        });
    }


    if (
        role.position >=
        botMember.roles.highest.position
    ) {

        return roleInteraction.update({

            embeds: [
                createEmbed({

                    title:
                        'Role Too High',

                    description:
                        `I cannot give ${role} because that role is higher than or equal to my highest role.\n\n` +
                        'Move my bot role above the application role and try again.'
                })
            ],

            components: []
        });
    }


    // ========================================================
    // GET EXISTING APPLICATION ROLES
    // ========================================================

    let existing;

    try {

        existing =
            await getApplicationRoles(
                interaction.client,
                interaction.guild.id
            );

    } catch (error) {

        console.error(
            'Could not retrieve application roles:',
            error
        );

        return roleInteraction.update({

            embeds: [
                createEmbed({

                    title:
                        'Database Error',

                    description:
                        'I could not load the existing application configuration.'
                })
            ],

            components: []
        });
    }


    const roles =
        Array.isArray(existing)
            ? existing
            : [];


    // ========================================================
    // CHECK DUPLICATE
    // ========================================================

    const alreadyExists =
        roles.some(
            applicationRole =>
                String(
                    applicationRole?.roleId
                ) ===
                String(role.id)
        );


    if (alreadyExists) {

        return roleInteraction.update({

            embeds: [
                createEmbed({

                    title:
                        'Application Already Exists',

                    description:
                        `${role} is already configured as an application.\n\n` +
                        'Use the application configurator later if you want to edit it.'
                })
            ],

            components: []
        });
    }


    // ========================================================
    // CREATE CONFIGURATION MODAL
    // ========================================================

    const modalId =
        `application_setup_modal:${role.id}:${interaction.user.id}`;


    const modal =
        new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(
                'Create Application'
            );


    // ========================================================
    // APPLICATION NAME
    // ========================================================

    const nameInput =
        new TextInputBuilder()
            .setCustomId('app_name')
            .setLabel('Application Name')
            .setPlaceholder(
                'Example: Moderator Application'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setMinLength(1)
            .setMaxLength(50)
            .setRequired(true);


    // ========================================================
    // QUESTION 1
    // ========================================================

    const q1 =
        new TextInputBuilder()
            .setCustomId('question_1')
            .setLabel('Question 1')
            .setPlaceholder(
                'Why do you want to become a staff member?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(true);


    // ========================================================
    // QUESTION 2
    // ========================================================

    const q2 =
        new TextInputBuilder()
            .setCustomId('question_2')
            .setLabel('Question 2')
            .setPlaceholder(
                'What experience do you have?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(false);


    // ========================================================
    // QUESTION 3
    // ========================================================

    const q3 =
        new TextInputBuilder()
            .setCustomId('question_3')
            .setLabel('Question 3')
            .setPlaceholder(
                'Why should we choose you?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(false);


    // ========================================================
    // QUESTION 4
    // ========================================================

    const q4 =
        new TextInputBuilder()
            .setCustomId('question_4')
            .setLabel('Question 4')
            .setPlaceholder(
                'How active will you be?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(false);


    // ========================================================
    // ADD MODAL COMPONENTS
    // ========================================================

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(nameInput),

        new ActionRowBuilder()
            .addComponents(q1),

        new ActionRowBuilder()
            .addComponents(q2),

        new ActionRowBuilder()
            .addComponents(q3),

        new ActionRowBuilder()
            .addComponents(q4)
    );


    // ========================================================
    // SHOW MODAL
    // ========================================================

    await roleInteraction.showModal(modal);


    // ========================================================
    // WAIT FOR MODAL SUBMISSION
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
                            modalId
            });

    } catch (error) {

        console.error(
            'Application setup modal expired:',
            error
        );

        return;
    }


    // ========================================================
    // READ APPLICATION NAME
    // ========================================================

    const appName =
        submitted.fields
            .getTextInputValue(
                'app_name'
            )
            .trim();


    // ========================================================
    // READ QUESTIONS
    // ========================================================

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
    // VALIDATE
    // ========================================================

    if (!appName) {

        return replyUserError(
            submitted,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Application name cannot be empty.'
            }
        );
    }


    if (questions.length === 0) {

        return replyUserError(
            submitted,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'At least one application question is required.'
            }
        );
    }


    // ========================================================
    // SAVE APPLICATION ROLE
    // ========================================================

    roles.push({

        roleId:
            String(role.id),

        name:
            appName,

        enabled:
            true
    });


    try {

        await saveApplicationRoles(
            submitted.client,
            submitted.guild.id,
            roles
        );

    } catch (error) {

        console.error(
            'Could not save application role:',
            error
        );

        return replyUserError(
            submitted,
            {
                type:
                    ErrorTypes.DATABASE,

                message:
                    'The application could not be saved.'
            }
        );
    }


    // ========================================================
    // ENABLE APPLICATION SYSTEM
    // ========================================================

    try {

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
                    enabled:
                        true
                }
            );
        }

    } catch (error) {

        console.error(
            'Could not enable application system:',
            error
        );

        // Do not delete the application.
        // The role and questions have already been saved.
    }


    // ========================================================
    // SAVE QUESTIONS
    // ========================================================

    try {

        await saveApplicationRoleSettings(

            submitted.client,

            submitted.guild.id,

            String(role.id),

            {
                questions
            }
        );

    } catch (error) {

        console.error(
            'Could not save application questions:',
            error
        );

        return replyUserError(
            submitted,
            {
                type:
                    ErrorTypes.DATABASE,

                message:
                    'The application was created, but its questions could not be saved.'
            }
        );
    }


    // ========================================================
    // SUCCESS
    // ========================================================

    return submitted.reply({

        embeds: [

            successEmbed(

                'Application Created',

                `**${appName}** has been created for ${role}.\n\n` +

                `**Questions:** ${questions.length}\n` +

                `**Status:** Enabled\n\n` +

                'The application is now ready to be used.'
            )

        ],

        flags:
            MessageFlags.Ephemeral
    });
                  }
