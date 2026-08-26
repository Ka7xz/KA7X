import {
    ActionRowBuilder,
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
    saveApplicationRoleSettings
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';


// ============================================================
// APPLICATION SETUP
// ============================================================

export async function handleApplicationSetup(interaction) {

    // ========================================================
    // MAKE SURE INTERACTION IS NOT ALREADY ACKNOWLEDGED
    // ========================================================

    if (
        interaction.replied ||
        interaction.deferred
    ) {
        return;
    }


    // ========================================================
    // SEND ROLE SELECT MENU
    // ========================================================

    const roleMenu =
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
            .addComponents(
                roleMenu
            );


    await interaction.reply({
        embeds: [
            createEmbed({
                title:
                    'Application Setup',

                description:
                    'Select the Discord role that users will apply for.'
            })
        ],

        components: [
            roleRow
        ],

        ephemeral: true
    });


    // ========================================================
    // WAIT FOR ROLE SELECTION
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
                    componentInteraction =>
                        componentInteraction.user.id ===
                            interaction.user.id &&

                        componentInteraction.customId ===
                            'application_setup_role'
            });

    } catch {

        return interaction.editReply({
            embeds: [
                createEmbed({
                    title:
                        'Application Setup Expired',

                    description:
                        'The setup session expired. Please run `/app-admin setup` again.'
                })
            ],

            components: []
        }).catch(() => {});
    }


    // ========================================================
    // GET ROLE ID
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


    // ========================================================
    // FETCH ROLE
    // ========================================================

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
        Array.isArray(existingRoles) &&
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
                        `The role ${role} is already configured as an application.`
                })
            ],

            components: []
        });
    }


    // ========================================================
    // ACKNOWLEDGE ROLE SELECTION
    // ========================================================

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
    // CREATE CONFIGURATION MODAL
    // ========================================================

    const modal =
        new ModalBuilder()
            .setCustomId(
                `application_setup_modal:${roleId}`
            )
            .setTitle(
                'Create Application'
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
            .setPlaceholder(
                'Example: Moderator'
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
                TextInputStyle.Short
            )
            .setMaxLength(100)
            .setRequired(true);


    // ========================================================
    // QUESTION 2
    // ========================================================

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
                TextInputStyle.Short
            )
            .setMaxLength(100)
            .setRequired(false);


    // ========================================================
    // QUESTION 3
    // ========================================================

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
                TextInputStyle.Short
            )
            .setMaxLength(100)
            .setRequired(false);


    // ========================================================
    // QUESTION 4
    // ========================================================

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
                TextInputStyle.Short
            )
            .setMaxLength(100)
            .setRequired(false);


    // ========================================================
    // ADD MODAL COMPONENTS
    // ========================================================

    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                nameInput
            ),

        new ActionRowBuilder()
            .addComponents(
                question1
            ),

        new ActionRowBuilder()
            .addComponents(
                question2
            ),

        new ActionRowBuilder()
            .addComponents(
                question3
            ),

        new ActionRowBuilder()
            .addComponents(
                question4
            )
    );


    // ========================================================
    // SHOW MODAL
    // ========================================================

    try {

        await roleInteraction.showModal(
            modal
        );

    } catch (error) {

        console.error(
            'Failed to open application setup modal:',
            error
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
                            `application_setup_modal:${roleId}`
            });

    } catch {

        return;
    }


    // ========================================================
    // READ APPLICATION NAME
    // ========================================================

    const applicationName =
        submitted.fields
            .getTextInputValue(
                'application_name'
            )
            .trim();


    if (!applicationName) {

        return replyUserError(
            submitted,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'You must enter an application name.'
            }
        );
    }


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
    // GET LATEST APPLICATION ROLES
    // ========================================================

    const applicationRoles =
        await getApplicationRoles(
            submitted.client,
            submitted.guild.id
        );


    // ========================================================
    // FINAL DUPLICATE CHECK
    // ========================================================

    if (
        applicationRoles.some(
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


    // ========================================================
    // SAVE APPLICATION ROLE
    // ========================================================

    applicationRoles.push({

        roleId:
            roleId,

        name:
            applicationName,

        enabled:
            true
    });


    await saveApplicationRoles(
        submitted.client,
        submitted.guild.id,
        applicationRoles
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
                'Open the application dashboard to configure it and send the application panel.'
            )
        ],

        ephemeral:
            true
    });


    // ========================================================
    // DONE
    // ========================================================

    return true;
      }
