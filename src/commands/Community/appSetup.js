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
    saveApplicationSettings,
    saveApplicationRoleSettings
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';

// ============================================================
// APPLICATION SETUP
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

    const customId =
        `app_setup_role:${interaction.user.id}`;

    const roleMenu =
        new RoleSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(
                'Select the role applicants will apply for'
            )
            .setMinValues(1)
            .setMaxValues(1);

    const row =
        new ActionRowBuilder()
            .addComponents(
                roleMenu
            );

    await interaction.reply({
        embeds: [
            createEmbed({
                title:
                    'Create Application',
                description:
                    'Select the Discord role that applicants will apply for.'
            })
        ],
        components: [row],
        flags:
            MessageFlags.Ephemeral
    });

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
    } catch {
        return interaction.editReply({
            embeds: [
                createEmbed({
                    title:
                        'Setup Expired',
                    description:
                        'The setup session expired. Please run `/app-admin setup` again.'
                })
            ],
            components: []
        });
    }

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
                        `I cannot manage ${role} because my bot role is not above it.`
                })
            ],
            components: []
        });
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
                        `${role} already has an application configured.`
                })
            ],
            components: []
        });
    }

    return showApplicationSetupModal(
        roleInteraction,
        role
    );
}

// ============================================================
// APPLICATION CREATION MODAL
// ============================================================

async function showApplicationSetupModal(
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

    return interaction.showModal(
        modal
    );
}

// ============================================================
// HANDLE SETUP MODAL
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

    const questions = [];

    for (
        let i = 1;
        i <= 4;
        i++
    ) {
        try {
            const question =
                interaction.fields
                    .getTextInputValue(
                        `question_${i}`
                    )
                    .trim();

            if (question) {
                questions.push(
                    question.substring(
                        0,
                        1000
                    )
                );
            }
        } catch {
            // Optional question was not submitted.
        }
    }

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
            application =>
                String(application.roleId) ===
                String(roleId)
        )
    ) {
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

    const role =
        await interaction.guild.roles
            .fetch(roleId)
            .catch(() => null);

    const roleEntry = {
        roleId:
            String(roleId),

        name:
            applicationName.substring(
                0,
                50
            ),

        enabled:
            true
    };

    roles.push(
        roleEntry
    );

    const rolesSaved =
        await saveApplicationRoles(
            interaction.client,
            interaction.guild.id,
            roles
        );

    if (!rolesSaved) {
        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.DATABASE,
                message:
                    'I could not save the application role.'
            }
        );
    }

    const settingsSaved =
        await saveApplicationRoleSettings(
            interaction.client,
            interaction.guild.id,
            String(roleId),
            {
                questions
            }
        );

    if (!settingsSaved) {
        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.DATABASE,
                message:
                    'The application role was saved, but I could not save its questions.'
            }
        );
    }

    const settings =
        await getApplicationSettings(
            interaction.client,
            interaction.guild.id
        );

    if (!settings.enabled) {
        await ApplicationService.updateSettings(
            interaction.client,
            interaction.guild.id,
            {
                enabled: true
            }
        );
    }

    return interaction.reply({
        embeds: [
            successEmbed(
                'Application Created',
                `**${applicationName}** has been created` +
                `${role ? ` for ${role}` : ''}.\n\n` +
                `**Questions:** ${questions.length}\n` +
                '**Status:** Enabled\n\n' +
                'Users can now submit applications for this role.'
            )
        ],
        flags:
            MessageFlags.Ephemeral
    });
                }
