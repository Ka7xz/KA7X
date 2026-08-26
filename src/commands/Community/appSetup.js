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
// APPLICATION SETUP
// ============================================================

export async function handleApplicationSetup(
    interaction
) {

    const customId =
        `app_setup_role:${interaction.user.id}`;

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
                    'Application Setup',

                description:
                    'Select the Discord role that users will apply for.'
            })
        ],

        components: [row],

        flags:
            MessageFlags.Ephemeral
    });


    // ========================================================
    // WAIT FOR ROLE
    // ========================================================

    let roleInteraction;

    try {

        roleInteraction =
            await interaction.awaitMessageComponent({

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

    } catch {

        return interaction.editReply({

            embeds: [
                createEmbed({
                    title:
                        'Setup Expired',

                    description:
                        'The setup session expired. Run `/app-admin setup` again.'
                })
            ],

            components: []
        });
    }


    const roleId =
        roleInteraction.values?.[0];

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
    // CHECK DUPLICATE
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

    if (
        roles.some(
            item =>
                String(item.roleId) ===
                String(role.id)
        )
    ) {

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
    // CONFIGURATION MODAL
    // ========================================================

    const modalId =
        `app_setup_modal:${role.id}:${interaction.user.id}`;

    const modal =
        new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(
                'Application Configuration'
            );


    const nameInput =
        new TextInputBuilder()
            .setCustomId('app_name')
            .setLabel('Application Name')
            .setPlaceholder('Moderator')
            .setStyle(
                TextInputStyle.Short
            )
            .setMaxLength(50)
            .setRequired(true);


    const q1 =
        new TextInputBuilder()
            .setCustomId('question_1')
            .setLabel('Question 1')
            .setPlaceholder(
                'Why do you want this role?'
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setMaxLength(1000)
            .setRequired(true);


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


    const q4 =
        new TextInputBuilder()
            .setCustomId('question_4')
            .setLabel('Question 4')
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
            .addComponents(q1),

        new ActionRowBuilder()
            .addComponents(q2),

        new ActionRowBuilder()
            .addComponents(q3),

        new ActionRowBuilder()
            .addComponents(q4)
    );


    await roleInteraction.showModal(
        modal
    );


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
                    modal =>
                        modal.user.id ===
                            interaction.user.id &&

                        modal.customId ===
                            modalId
            });

    } catch {

        return;
    }


    // ========================================================
    // READ DATA
    // ========================================================

    const appName =
        submitted.fields
            .getTextInputValue('app_name')
            .trim();

    const questions = [
        submitted.fields
            .getTextInputValue('question_1')
            .trim(),

        submitted.fields
            .getTextInputValue('question_2')
            .trim(),

        submitted.fields
            .getTextInputValue('question_3')
            .trim(),

        submitted.fields
            .getTextInputValue('question_4')
            .trim()
    ].filter(Boolean);


    // ========================================================
    // SAVE ROLE
    // ========================================================

    roles.push({

        roleId:
            String(role.id),

        name:
            appName,

        enabled:
            true
    });

    await saveApplicationRoles(
        submitted.client,
        submitted.guild.id,
        roles
    );


    // ========================================================
    // ENABLE APPLICATION SYSTEM
    // ========================================================

    const settings =
        await getApplicationSettings(
            submitted.client,
            submitted.guild.id
        );

    if (!settings.enabled) {

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
        String(role.id),
        {
            questions
        }
    );


    // ========================================================
    // SUCCESS
    // ========================================================

    return submitted.reply({

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
