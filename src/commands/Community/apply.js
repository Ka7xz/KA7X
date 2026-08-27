import {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
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
    getApplicationRoles,
    getApplicationRoleSettings
} from '../../utils/database.js';
// ============================================================
// /APPLY COMMAND
// ============================================================

export default {

    data:
        new SlashCommandBuilder()

            .setName('apply')

            .setDescription(
                'Apply for a staff position'
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


        return showApplicationPanel(
            interaction
        );
    }
};
// ============================================================
// SHOW APPLICATION PANEL
// ============================================================

async function showApplicationPanel(
    interaction
) {

    const roles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const applications =
        Array.isArray(roles)
            ? roles.filter(
                application =>
                    application.enabled !== false
            )
            : [];

    if (applications.length === 0) {

        return interaction.reply({

            embeds: [

                createEmbed({

                    title:
                        'Applications Unavailable',

                    description:
                        'There are currently no staff applications available.'
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
                `apply_select:${interaction.user.id}`
            )
            .setPlaceholder(
                'Select an application'
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
                        'Staff Application'
                    ).slice(0, 100)
                )
                .setDescription(
                    'Apply for this position'
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
    // SEND APPLICATION PANEL
    // ========================================================

    return interaction.reply({

        embeds: [

            createEmbed({

                title:
                    'Staff Applications',

                description:
                    'Select an application below to begin.\n\n' +
                    'Choose the position you want to apply for.'
            })

        ],

        components: [
            row
        ],

        flags:
            MessageFlags.Ephemeral
    });
}
// ============================================================
// HANDLE APPLICATION SELECTION
// ============================================================

export async function handleApplicationSelect(
    interaction
) {

    if (!interaction.isStringSelectMenu()) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            'apply_select:'
        )
    ) {
        return false;
    }

    const ownerId =
        interaction.customId.split(':')[1];

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
                    'This application menu belongs to another user.'
            }
        );

        return true;
    }

    const roleId =
        interaction.values[0];

    if (!roleId) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Please select an application.'
            }
        );

        return true;
    }
      // ========================================================
    // LOAD SELECTED APPLICATION
    // ========================================================

    const roles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const applications =
        Array.isArray(roles)
            ? roles
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
                    'This application could not be found.'
            }
        );

        return true;
    }

    // ========================================================
    // CHECK ENABLED STATUS
    // ========================================================

    if (
        application.enabled === false
    ) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is currently disabled.'
            }
        );

        return true;
    }

    // ========================================================
    // OPEN APPLICATION FORM
    // ========================================================

    return showApplicationForm(
        interaction,
        application
    );
}
// ============================================================
// SHOW APPLICATION FORM
// ============================================================

async function showApplicationForm(
    interaction,
    application
) {

    const roleId =
        String(application.roleId);

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

    if (questions.length === 0) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application has no questions configured.'
            }
        );

        return true;
    }
      // ========================================================
    // CREATE APPLICATION MODAL
    // ========================================================

    const modalId =
        `apply_modal:${roleId}:${interaction.user.id}`;

    const modal =
        new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(
                String(
                    application.name ||
                    'Staff Application'
                ).slice(0, 45)
            );


    // ========================================================
    // ADD QUESTIONS
    // ========================================================

    for (
        let i = 0;
        i < Math.min(questions.length, 5);
        i++
    ) {

        const input =
            new TextInputBuilder()
                .setCustomId(
                    `answer_${i + 1}`
                )
                .setLabel(
                    String(
                        questions[i]
                    ).slice(0, 45)
                )
                .setStyle(
                    TextInputStyle.Paragraph
                )
                .setMaxLength(1000)
                .setRequired(true);

        modal.addComponents(

            new ActionRowBuilder()
                .addComponents(input)
        );
    }


    // ========================================================
    // SHOW MODAL
    // ========================================================

    await interaction.showModal(
        modal
    );

    return true;
}
// ============================================================
// HANDLE APPLICATION MODAL
// ============================================================

export async function handleApplicationModal(
    interaction
) {

    if (!interaction.isModalSubmit()) {
        return false;
    }

    if (
        !interaction.customId.startsWith(
            'apply_modal:'
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
    // VERIFY USER
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
                    'You cannot use this application form.'
            }
        );

        return true;
    }
      // ========================================================
    // LOAD APPLICATION
    // ========================================================

    const roles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const applications =
        Array.isArray(roles)
            ? roles
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
                    'This application no longer exists.'
            }
        );

        return true;
    }

    // ========================================================
    // CHECK APPLICATION STATUS
    // ========================================================

    if (
        application.enabled === false
    ) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is currently disabled.'
            }
        );

        return true;
    }

    // ========================================================
    // GET QUESTIONS
    // ========================================================

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

    if (questions.length === 0) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application has no questions configured.'
            }
        );

        return true;
      }
      // ========================================================
    // READ ANSWERS
    // ========================================================

    const answers = [];

    for (
        let i = 0;
        i < questions.length;
        i++
    ) {

        let answer = '';

        try {

            answer =
                interaction.fields
                    .getTextInputValue(
                        `answer_${i + 1}`
                    )
                    .trim();

        } catch {
            answer = '';
        }

        answers.push({

            question:
                String(
                    questions[i]
                ).substring(0, 200),

            answer:
                answer.substring(0, 1000)
        });
    }


    // ========================================================
    // VALIDATE ANSWERS
    // ========================================================

    const invalidAnswer =
        answers.find(
            item =>
                !item.answer ||
                item.answer.length < 10
        );

    if (invalidAnswer) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    'Each answer must contain at least 10 characters.'
            }
        );

        return true;
    }
      // ========================================================
    // SUBMIT APPLICATION
    // ========================================================

    let submittedApplication;

    try {

        submittedApplication =
            await ApplicationService.submitApplication(
                interaction.client,
                {
                    guildId:
                        interaction.guild.id,

                    userId:
                        interaction.user.id,

                    roleId:
                        String(roleId),

                    roleName:
                        application.name ||
                        'Staff Application',

                    answers
                }
            );

    } catch (error) {

        console.error(
            'Application submission failed:',
            error
        );

        await replyUserError(
            interaction,
            {
                type:
                    error?.type ||
                    ErrorTypes.UNKNOWN,

                message:
                    error?.userMessage ||
                    error?.message ||
                    'Your application could not be submitted.'
            }
        );

        return true;
              }
      // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    return interaction.reply({

        embeds: [

            createEmbed({

                title:
                    'Application Submitted',

                description:
                    `Your **${application.name || 'staff'}** application has been submitted successfully.\n\n` +
                    `**Application ID:** \`${submittedApplication.id}\`\n\n` +
                    'Please wait while the staff team reviews your application.'
            })

        ],

        flags:
            MessageFlags.Ephemeral
    });

    return true;
}
// ============================================================
// END OF APPLY SYSTEM
// ============================================================
