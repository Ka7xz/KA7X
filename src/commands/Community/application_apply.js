// ============================================================
// application_apply.js
// Application Apply Button + Application Submission
// ============================================================

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
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
    getApplicationRoleSettings
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';


// ============================================================
// SHOW APPLICATION PANEL
// ============================================================

export async function showApplicationPanel(
    interaction,
    roleId
) {

    if (!interaction.inGuild()) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.UNKNOWN,

                message:
                    'This can only be used inside a server.'
            }
        );
    }


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

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is no longer configured.'
            }
        );
    }


    // ========================================================
    // CHECK ENABLED
    // ========================================================

    if (
        application.enabled === false
    ) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is currently disabled.'
            }
        );
    }


    // ========================================================
    // APPLICATION ROLE
    // ========================================================

    const role =
        await interaction.guild.roles
            .fetch(roleId)
            .catch(() => null);


    if (!role) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'The application role no longer exists.'
            }
        );
    }


    // ========================================================
    // CHECK USER ALREADY HAS ROLE
    // ========================================================

    const member =
        await interaction.guild.members
            .fetch(interaction.user.id)
            .catch(() => null);


    if (
        member &&
        member.roles.cache.has(role.id)
    ) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.USER_INPUT,

                message:
                    `You already have the ${role.name} role.`
            }
        );
    }


    // ========================================================
    // LOAD QUESTIONS
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


    if (
        questions.length === 0
    ) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application has no questions configured.'
            }
        );
    }


    // ========================================================
    // SHOW APPLICATION FORM
    // ========================================================

    return showApplicationModal(
        interaction,
        application,
        questions
    );
}
// ============================================================
// SHOW APPLICATION MODAL
// ============================================================

async function showApplicationModal(
    interaction,
    application,
    questions
) {

    const modalId =
        `application_modal:${application.roleId}:${interaction.user.id}`;

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
    // ADD QUESTIONS TO MODAL
    // Discord modals support a maximum of 5 inputs.
    // ========================================================

    const limitedQuestions =
        questions.slice(0, 5);


    limitedQuestions.forEach(
        (question, index) => {

            const input =
                new TextInputBuilder()
                    .setCustomId(
                        `answer_${index + 1}`
                    )
                    .setLabel(
                        String(
                            question
                        ).slice(0, 45)
                    )
                    .setPlaceholder(
                        'Enter your answer here...'
                    )
                    .setStyle(
                        TextInputStyle.Paragraph
                    )
                    .setMaxLength(1000)
                    .setRequired(true);


            modal.addComponents(

                new ActionRowBuilder()
                    .addComponents(
                        input
                    )
            );
        }
    );


    // ========================================================
    // SHOW MODAL
    // ========================================================

    try {

        await interaction.showModal(
            modal
        );

    } catch (error) {

        console.error(
            'Failed to show application modal:',
            error
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {

            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.UNKNOWN,

                    message:
                        'I could not open the application form.'
                }
            );
        }

        return;
    }
}


// ============================================================
// APPLICATION MODAL SUBMISSION HANDLER
// ============================================================

export async function handleApplicationModal(
    interaction
) {

    if (
        !interaction.isModalSubmit()
    ) {

        return false;
    }


    if (
        !interaction.customId.startsWith(
            'application_modal:'
        )
    ) {

        return false;
    }


    // ========================================================
    // READ MODAL ID
    // ========================================================

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
                'You cannot submit this application form.'
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
  // ============================================================
// GET APPLICATION QUESTIONS
// ============================================================

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


// ============================================================
// COLLECT ANSWERS
// ============================================================

    const answers = [];

    for (
        let i = 0;
        i < questions.length;
        i++
    ) {

        let answer;

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


// ============================================================
// CHECK ANSWERS
// ============================================================

    const emptyAnswer =
        answers.find(
            item =>
                !item.answer ||
                item.answer.length < 10
        );

    if (emptyAnswer) {

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


// ============================================================
// SUBMIT APPLICATION
// ============================================================

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
                        'Application',

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
           // ============================================================
// APPLICATION SUBMITTED SUCCESSFULLY
// ============================================================

    return interaction.reply({

        embeds: [

            successEmbed(

                'Application Submitted',

                `Your **${application.name || 'staff'}** application ` +
                `has been submitted successfully.\n\n` +

                `**Application ID:** ` +
                `\`${submittedApplication.id}\`\n\n` +

                'Please wait while the staff team reviews your application.'
            )

        ],

        flags:
            MessageFlags.Ephemeral
    });

}


// ============================================================
// APPLICATION BUTTON HANDLER
// ============================================================

export async function handleApplicationButton(
    interaction
) {

    if (
        !interaction.isButton()
    ) {

        return false;
    }


    if (
        !interaction.customId.startsWith(
            'application_apply:'
        )
    ) {

        return false;
    }


    const parts =
        interaction.customId.split(':');


    const roleId =
        parts[1];


    if (!roleId) {

        await replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application button is not configured correctly.'
            }
        );

        return true;
    }


    try {

        await showApplicationPanel(
            interaction,
            roleId
        );

    } catch (error) {

        console.error(
            'Application button error:',
            error
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {

            await replyUserError(
                interaction,
                {
                    type:
                        error?.type ||
                        ErrorTypes.UNKNOWN,

                    message:
                        error?.userMessage ||
                        'I could not open the application.'
                }
            );
        }
    }


    return true;
    }
// ============================================================
// END OF APPLICATION APPLY SYSTEM
// ============================================================

export default {
    handleApplicationButton,
    handleApplicationModal,
    showApplicationPanel
};
