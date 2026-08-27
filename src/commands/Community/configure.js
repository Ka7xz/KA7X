import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
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
    getApplicationRoleSettings,
    saveApplicationRoles,
    saveApplicationRoleSettings
} from '../../utils/database.js';

import ApplicationService
    from '../../services/applicationService.js';


// ============================================================
// /CONFIGURE APPLICATIONS
// ============================================================

export default {

    data:
        new SlashCommandBuilder()

            .setName('configure')

            .setDescription(
                'Configure existing applications'
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageGuild
            )

            .addSubcommand(subcommand =>
                subcommand
                    .setName('applications')
                    .setDescription(
                        'Configure an existing application'
                    )
            ),

    category:
        'Community',
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

        try {

            await ApplicationService.checkManagerPermission(
                interaction.client,
                interaction.guild.id,
                interaction.member
            );

            return showConfigurator(
                interaction
            );

        } catch (error) {

            console.error(
                'Configure applications error:',
                error
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
                        error?.message ||
                        'Unable to open the application configurator.'
                }
            );
        }
    }
};
// ============================================================
// SHOW APPLICATION CONFIGURATOR
// ============================================================

async function showConfigurator(
    interaction
) {

    const existing =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const applications =
        Array.isArray(existing)
            ? existing
            : [];

    if (applications.length === 0) {

        return interaction.reply({

            embeds: [

                createEmbed({

                    title:
                        'No Applications',

                    description:
                        'No applications have been created yet.\n\n' +
                        'Use `/app-admin setup` to create one first.'
                })

            ],

            flags:
                MessageFlags.Ephemeral
        });
    }

    // ========================================================
    // APPLICATION SELECT MENU
    // ========================================================

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `configure_select:${interaction.user.id}`
            )
            .setPlaceholder(
                'Select an application to configure'
            )
            .setMinValues(1)
            .setMaxValues(1);

    for (
        const application of applications.slice(0, 25)
    ) {

        menu.addOptions(

            new StringSelectMenuOptionBuilder()

                .setLabel(
                    String(
                        application.name ||
                        'Application'
                    ).slice(0, 100)
                )

                .setDescription(
                    application.enabled === false
                        ? 'Currently disabled'
                        : 'Currently enabled'
                )

                .setValue(
                    String(
                        application.roleId
                    )
                )
        );
    }

    const row =
        new ActionRowBuilder()
            .addComponents(menu);
      // ========================================================
    // SEND CONFIGURATOR
    // ========================================================

    await interaction.reply({

        embeds: [

            createEmbed({

                title:
                    'Application Configurator',

                description:
                    'Select an existing application below.\n\n' +
                    'You can configure its name, questions, and enabled status.'
            })

        ],

        components: [
            row
        ],

        flags:
            MessageFlags.Ephemeral
    });

    // ========================================================
    // WAIT FOR APPLICATION SELECTION
    // ========================================================

    const message =
        await interaction.fetchReply();

    let selection;

    try {

        selection =
            await message.awaitMessageComponent({

                time:
                    120000,

                filter:
                    component =>
                        component.user.id ===
                            interaction.user.id &&

                        component.customId ===
                            `configure_select:${interaction.user.id}`
            });

    } catch {

        return interaction.editReply({

            embeds: [

                createEmbed({

                    title:
                        'Configurator Expired',

                    description:
                        'The configuration session expired.\n\n' +
                        'Run `/configure applications` again.'
                })

            ],

            components: []
        });
    }
      // ========================================================
    // GET SELECTED APPLICATION
    // ========================================================

    const roleId =
        selection.values[0];

    const selectedApplication =
        applications.find(
            application =>
                String(application.roleId) ===
                String(roleId)
        );

    if (!selectedApplication) {

        return selection.update({

            embeds: [

                createEmbed({

                    title:
                        'Application Not Found',

                    description:
                        'The selected application could not be found.'
                })

            ],

            components: []
        });
    }

    // ========================================================
    // CONFIGURATION OPTIONS
    // ========================================================

    const optionMenu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `configure_option:${interaction.user.id}:${roleId}`
            )
            .setPlaceholder(
                'Choose what you want to configure'
            )
            .setMinValues(1)
            .setMaxValues(1)

            .addOptions(

                new StringSelectMenuOptionBuilder()
                    .setLabel(
                        'Application Name'
                    )
                    .setDescription(
                        'Change the name of this application'
                    )
                    .setValue(
                        'name'
                    ),

                new StringSelectMenuOptionBuilder()
                    .setLabel(
                        'Application Questions'
                    )
                    .setDescription(
                        'Edit the questions applicants answer'
                    )
                    .setValue(
                        'questions'
                    ),

                new StringSelectMenuOptionBuilder()
                    .setLabel(
                        'Enable / Disable'
                    )
                    .setDescription(
                        'Change whether applicants can apply'
                    )
                    .setValue(
                        'enabled'
                    )
            );

    const optionRow =
        new ActionRowBuilder()
            .addComponents(
                optionMenu
            );
      // ========================================================
    // SHOW CONFIGURATION OPTIONS
    // ========================================================

    return selection.update({

        embeds: [

            createEmbed({

                title:
                    `Configure: ${
                        selectedApplication.name ||
                        'Application'
                    }`,

                description:
                    `**Role:** <@&${roleId}>\n\n` +
                    'Choose what you want to configure.'
            })

        ],

        components: [
            optionRow
        ]
    });
}


// ============================================================
// HANDLE CONFIGURATION OPTION
// ============================================================

export async function handleConfigureOption(
    interaction
) {

    if (
        !interaction.isStringSelectMenu()
    ) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            'configure_option:'
        )
    ) {
        return false;
    }

    const parts =
        interaction.customId.split(':');

    const ownerId =
        parts[1];

    const roleId =
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
                    'This configuration menu belongs to another user.'
            }
        );

        return true;
    }

    const option =
        interaction.values[0];
      // ========================================================
    // EDIT APPLICATION NAME
    // ========================================================

    if (option === 'name') {

        const modal =
            new ModalBuilder()
                .setCustomId(
                    `configure_name:${roleId}:${interaction.user.id}`
                )
                .setTitle(
                    'Edit Application Name'
                );

        const input =
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

        modal.addComponents(

            new ActionRowBuilder()
                .addComponents(input)

        );

        await interaction.showModal(
            modal
        );

        return true;
    }
      // ========================================================
    // EDIT APPLICATION QUESTIONS
    // ========================================================

    if (option === 'questions') {

        const settings =
            await getApplicationRoleSettings(
                interaction.client,
                interaction.guild.id,
                roleId
            );

        const questions =
            Array.isArray(settings?.questions)
                ? settings.questions
                : [];

        const modal =
            new ModalBuilder()
                .setCustomId(
                    `configure_questions:${roleId}:${interaction.user.id}`
                )
                .setTitle(
                    'Edit Application Questions'
                );

        for (
            let i = 0;
            i < Math.min(
                Math.max(questions.length, 1),
                5
            );
            i++
        ) {

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        `question_${i + 1}`
                    )
                    .setLabel(
                        `Question ${i + 1}`
                    )
                    .setPlaceholder(
                        'Enter your application question'
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setMaxLength(1000)
                    .setRequired(
                        i === 0
                    );

            if (questions[i]) {

                input.setValue(
                    String(
                        questions[i]
                    ).slice(0, 1000)
                );
            }

            modal.addComponents(

                new ActionRowBuilder()
                    .addComponents(input)
            );
        }

        await interaction.showModal(
            modal
        );

        return true;
    }
      // ========================================================
    // ENABLE / DISABLE APPLICATION
    // ========================================================

    if (option === 'enabled') {

        const existing =
            await getApplicationRoles(
                interaction.client,
                interaction.guild.id
            );

        const applications =
            Array.isArray(existing)
                ? existing
                : [];

        const application =
            applications.find(
                item =>
                    String(item.roleId) ===
                    String(roleId)
            );

        if (!application) {

            await replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.CONFIGURATION,

                    message:
                        'Application not found.'
                }
            );

            return true;
        }

        application.enabled =
            application.enabled === false;

        await saveApplicationRoles(
            interaction.client,
            interaction.guild.id,
            applications
        );

        return interaction.update({

            embeds: [

                successEmbed(

                    application.enabled
                        ? 'Application Enabled'
                        : 'Application Disabled',

                    `**${application.name || 'Application'}** is now ` +
                    `**${application.enabled ? 'enabled' : 'disabled'}**.`
                )

            ],

            components: []
        });
    }

    return true;
}
// ============================================================
// HANDLE CONFIGURATION MODALS
// ============================================================

export async function handleConfigureModal(
    interaction
) {

    if (!interaction.isModalSubmit()) {
        return false;
    }

    // ========================================================
    // EDIT APPLICATION NAME
    // ========================================================

    if (
        interaction.customId.startsWith(
            'configure_name:'
        )
    ) {

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
                        'You cannot use this configuration form.'
                }
            );

            return true;
        }

        const name =
            interaction.fields
                .getTextInputValue(
                    'application_name'
                )
                .trim();

        if (!name) {

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

        const existing =
            await getApplicationRoles(
                interaction.client,
                interaction.guild.id
            );

        const applications =
            Array.isArray(existing)
                ? existing
                : [];

        const application =
            applications.find(
                item =>
                    String(item.roleId) ===
                    String(roleId)
            );

        if (!application) {

            await replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.CONFIGURATION,

                    message:
                        'Application not found.'
                }
            );

            return true;
        }

        application.name =
            name.substring(0, 50);

        await saveApplicationRoles(
            interaction.client,
            interaction.guild.id,
            applications
        );

        return interaction.reply({

            embeds: [

                successEmbed(
                    'Application Updated',
                    `The application name is now **${
                        { 
     // ========================================================
    // EDIT APPLICATION QUESTIONS
    // ========================================================

    if (
        interaction.customId.startsWith(
            'configure_questions:'
        )
                        {

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
                        'You cannot use this configuration form.'
                }
            );

            return true;
        }

        const questions = [];

        for (
            let i = 1;
            i <= 5;
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
                        question.substring(0, 1000)
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
                        'At least one question is required.'
                }
            );

            return true;
        }

        await saveApplicationRoleSettings(
            interaction.client,
            interaction.guild.id,
            String(roleId),
            {
                questions
            }
        );

        return interaction.reply({

            embeds: [
    

                successEmbed(
                    'Questions Updated',
                    `The application now has **${questions.length}** question${questions.length === 1 ? '' : 's'}.`
                )

            ],

            flags:
                MessageFlags.Ephemeral
        });
     }

    return false;
}
