import {
    ActionRowBuilder,
    ComponentType,
    ModalBuilder,
    RoleSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle
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
    getApplicationSettings,
    getApplicationRoles,
    saveApplicationRoles,
    saveApplicationRoleSettings
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';


// ============================================================
// APPLICATION SETUP
// ============================================================

export async function handleApplicationSetup(interaction) {

    // ========================================================
    // CHECK INTERACTION
    // ========================================================

    if (
        interaction.deferred ||
        interaction.replied
    ) {
        return replyUserError(interaction, {
            type: ErrorTypes.UNKNOWN,
            message:
                'This interaction has already been processed. Please try again.'
        });
    }


    // ========================================================
    // STEP 1 — ROLE SELECT
    // ========================================================

    const roleSelect =
        new RoleSelectMenuBuilder()
            .setCustomId(
                'application_setup_role'
            )
            .setPlaceholder(
                'Select the application role'
            )
            .setMinValues(1)
            .setMaxValues(1);

    const roleRow =
        new ActionRowBuilder()
            .addComponents(roleSelect);


    await interaction.reply({
        embeds: [
            createEmbed({
                title:
                    'Application Setup',

                description:
                    'Select the role that users will apply for.'
            })
        ],

        components: [
            roleRow
        ],

        flags: ['Ephemeral']
    });


    // ========================================================
    // WAIT FOR ROLE
    // ========================================================

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
                            'application_setup_role'
            });

    } catch (error) {

        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    createEmbed({
                        title:
                            'Application Setup Expired',

                        description:
                            'The setup session expired. Please run `/app-admin setup` again.'
                    })
                ],

                components: []
            }
        ).catch(() => {});

        return;
    }


    // ========================================================
    // GET ROLE
    // ========================================================

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


    // ========================================================
    // CHECK EXISTING APPLICATION
    // ========================================================

    const existingRoles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );


    const alreadyExists =
        existingRoles.some(
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
                        `${role} is already configured as an application.`
                })
            ],

            components: []
        });
    }


    // ========================================================
    // ACKNOWLEDGE ROLE
    // ========================================================

    await roleInteraction.update({
        embeds: [
            createEmbed({
                title:
                    'Application Setup',

                description:
                    `Selected role: ${role}\n\n` +
                    'Opening the setup form...'
            })
        ],

        components: []
    });


    // ========================================================
    // STEP 2 — CREATE MODAL
    // ========================================================

    const modal =
        new ModalBuilder()
            .setCustomId(
                `application_setup_modal_${roleId}`
            )
            .setTitle(
                'Application Setup'
            );


    // ========================================================
    // APPLICATION NAME
    // ========================================================

    const nameInput =
        new TextInputBuilder()
            .setCustomId(
                'application_name'
            )
            .setLabel(
                'Application Name'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setPlaceholder(
                'Moderator, Helper, Developer'
            )
            .setMinLength(1)
            .setMaxLength(50)
            .setRequired(true);


    // ========================================================
    // QUESTION 1
    // ========================================================

    const question1 =
        new TextInputBuilder()
            .setCustomId(
                'application_question_1'
            )
            .setLabel(
                'Question 1'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setPlaceholder(
                'Why do you want this role?'
            )
            .setMinLength(1)
            .setMaxLength(100)
            .setRequired(true);


    // ========================================================
    // QUESTION 2
    // ========================================================

    const question2 =
        new TextInputBuilder()
            .setCustomId(
                'application_question_2'
            )
            .setLabel(
                'Question 2'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setPlaceholder(
                'What experience do you have?'
            )
            .setMaxLength(100)
            .setRequired(false);


    // ========================================================
    // QUESTION 3
    // ========================================================

    const question3 =
        new TextInputBuilder()
            .setCustomId(
                'application_question_3'
            )
            .setLabel(
                'Question 3'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setPlaceholder(
                'Why should we choose you?'
            )
            .setMaxLength(100)
            .setRequired(false);


    // ========================================================
    // ADD MODAL COMPONENTS
    // ========================================================

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(nameInput),

        new ActionRowBuilder()
            .addComponents(question1),

        new ActionRowBuilder()
            .addComponents(question2),

        new ActionRowBuilder()
            .addComponents(question3)

    );


    // ========================================================
    // SHOW MODAL
    // ========================================================

    try {

        await roleInteraction.showModal(
            modal
        );

    } catch (error) {

        logger.error(
            'Failed to show application setup modal',
            {
                error:
                    error.message,

                stack:
                    error.stack,

                guildId:
                    interaction.guild.id,

                userId:
                    interaction.user.id,

                roleId
            }
        );

        return;
    }


    // ========================================================
    // WAIT FOR SUBMISSION
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
                            `application_setup_modal_${roleId}`
            });

    } catch (error) {

        logger.info(
            'Application setup timed out',
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
    // READ DATA
    // ========================================================

    const applicationName =
        submitted.fields
            .getTextInputValue(
                'application_name'
            )
            .trim();


    const questions = [
        submitted.fields
            .getTextInputValue(
                'application_question_1'
            )
            .trim(),

        submitted.fields
            .getTextInputValue(
                'application_question_2'
            )
            .trim(),

        submitted.fields
            .getTextInputValue(
                'application_question_3'
            )
            .trim()

    ].filter(
        question =>
            question.length > 0
    );


    // ========================================================
    // SAVE APPLICATION ROLE
    // ========================================================

    const currentRoles =
        await getApplicationRoles(
            submitted.client,
            submitted.guild.id
        );


    if (
        currentRoles.some(
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
                    `${role} is already configured as an application.`
            }
        );
    }


    currentRoles.push({
        roleId,
        name:
            applicationName,

        enabled:
            true
    });


    await saveApplicationRoles(
        submitted.client,
        submitted.guild.id,
        currentRoles
    );


    // ========================================================
    // ENABLE APPLICATION SYSTEM
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
                enabled:
                    true
            }
        );
    }


    // ========================================================
    // SAVE QUESTIONS
    // ========================================================

    await saveApplicationRoleSettings(
        submitted.client,
        submitted.guild.id,
        roleId,
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
                `**${applicationName}** has been created for ${role}.\n\n` +
                'The application is now available.'
            )
        ],

        flags: ['Ephemeral']
    });


    logger.info(
        'Application created successfully',
        {
            guildId:
                submitted.guild.id,

            userId:
                submitted.user.id,

            roleId,

            applicationName
        }
    );
          }
