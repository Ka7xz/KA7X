import {
    ActionRowBuilder,
    RoleSelectMenuBuilder,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
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
// APPLICATION SETUP
// Creates a new staff application
// ============================================================

export async function handleApplicationSetup(
    interaction
) {

    if (!interaction.inGuild()) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.UNKNOWN,

                message:
                    'This setup can only be used inside a server.'
            }
        );
    }


    // ========================================================
    // SETUP SESSION ID
    // ========================================================

    const customId =
        `app_setup_role:${interaction.user.id}`;


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
            .addComponents(
                roleMenu
            );


    // ========================================================
    // SEND SETUP MESSAGE
    // ========================================================

    await interaction.reply({

        embeds: [

            createEmbed({

                title:
                    'Create Application',

                description:
                    'Select the Discord role that applicants will apply for.'
            })

        ],

        components: [
            row
        ],

        flags:
            MessageFlags.Ephemeral
    });
      // ========================================================
    // WAIT FOR ROLE SELECTION
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

        return interaction.editReply({

            embeds: [

                createEmbed({

                    title:
                        'Setup Expired',

                    description:
                        'The setup session expired. ' +
                        'Please run the setup command again.'
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


    if (
        botMember &&
        role.position >=
            botMember.roles.highest.position
    ) {

        return roleInteraction.update({

            embeds: [

                createEmbed({

                    title:
                        'Role Too High',

                    description:
                        `I cannot manage ${role} because ` +
                        `my bot role is not above it.\n\n` +
                        `Move my bot role above ${role} ` +
                        `and try again.`
                })

            ],

            components: []
        });
    }


    // ========================================================
    // LOAD EXISTING APPLICATION ROLES
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
    // CHECK DUPLICATE
    // ========================================================

    const alreadyExists =
        roles.some(
            application =>
                String(application.roleId) ===
                String(role.id)
        );


    if (alreadyExists) {

        return roleInteraction.update({

            embeds: [

                createEmbed({

                    title:
                        'Application Already Exists',

                    description:
                        `${role} already has an application configured.\n\n` +
                        'Use `/configure applications` to edit it.'
                })

            ],

            components: []
        });
    }


    // ========================================================
    // CONTINUE TO APPLICATION FORM
    // ========================================================

    return showApplicationSetupModal(
        roleInteraction,
        role
    ); async function showApplicationSetupModal(
    interaction,
    role
) {

    const modalId =
        `app_setup_modal:${role.id}:${interaction.user.id}`;

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
            .setCustomId(
                'application_name'
            )
            .setLabel(
                'Application Name'
            )
            .setPlaceholder(
                'Moderator Application'
            )
            .setStyle(
                TextInputStyle.Short
            )
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
                'Why do you want this position?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
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
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
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
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
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
              // ============================================================
// HANDLE APPLICATION SETUP MODAL
// ============================================================

export async function handleApplicationSetupModal(
    interaction
) {

    if (!interaction.isModalSubmit()) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            'app_setup_modal:'
        )
    ) {
        return false;
    }

    const parts =
        interaction.customId.split(':');

    const roleId =
        parts[1];

    const ownerId =
        parts[2];

    // ========================================================
    // VERIFY OWNER
    // ========================================================

    if (
        ownerId !==
        interaction.user.id
    ) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.PERMISSION,

                message:
                    'You cannot use this application setup form.'
            }
        );

        return true;
    }

    // ========================================================
    // GET APPLICATION NAME
    // ========================================================

    const applicationName =
        interaction.fields
            .getTextInputValue(
                'application_name'
            )
            .trim();

    if (!applicationName) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Application name cannot be empty.'
            }
        );

        return true;
    }

    // ========================================================
    // GET QUESTIONS
    // ========================================================

    const questions = [];

    for (let i = 1; i <= 4; i++) {

        try {

            const question =
                interaction.fields
                    .getTextInputValue(
                        `question_${i}`
                    )
                    .trim();

            if (question) {
                questions.push(
                    question.substring(0, 1000)
                );
            }

        } catch {
            // Optional question was not submitted.
        }
    }

    // ========================================================
    // REQUIRE QUESTION 1
    // ========================================================

    if (questions.length === 0) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'At least one application question is required.'
            }
        );

        return true;
    }

    // ========================================================
    // LOAD CURRENT APPLICATION ROLES
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
    // CHECK DUPLICATE AGAIN
    // ========================================================

    const alreadyExists =
        roles.some(
            application =>
                String(application.roleId) ===
                String(roleId)
        );
    if (alreadyExists) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'An application for this role already exists.'
            }
        );
    }


    // ========================================================
    // SAVE APPLICATION ROLE
    // ========================================================

    roles.push({

        roleId:
            String(roleId),

        name:
            applicationName.substring(0, 50),

        enabled:
            true
    });


    await saveApplicationRoles(
        interaction.client,
        interaction.guild.id,
        roles
    );


    // ========================================================
    // SAVE APPLICATION QUESTIONS
    // ========================================================

    await saveApplicationRoleSettings(
        interaction.client,
        interaction.guild.id,
        String(roleId),
        {
            questions
        }
    );


    // ========================================================
    // ENABLE APPLICATION SYSTEM
    // ========================================================

    const settings =
        await getApplicationSettings(
            interaction.client,
            interaction.guild.id
        );


    if (!settings?.enabled) {

        await ApplicationService.updateSettings(
            interaction.client,
            interaction.guild.id,
            {
                enabled: true
            }
        );
    }


    // ========================================================
    // GET ROLE
    // ========================================================

    const role =
        await interaction.guild.roles
            .fetch(roleId)
            .catch(() => null);


    // ========================================================
    // SUCCESS
    // ========================================================

    return interaction.reply({

        embeds: [

            successEmbed(

                'Application Created',

                `**${applicationName}** has been created` +
                `${role ? ` for ${role}` : ''}.\n\n` +

                `**Questions:** ${questions.length}\n` +

                '**Status:** Enabled\n\n' +

                'Use `/configure applications` to edit it.'
            )
        ],

        flags:
            MessageFlags.Ephemeral
      });
}
