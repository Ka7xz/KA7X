// ============================================================
// apply.js
// Application form + submission
// ============================================================

import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} from 'discord.js';

import {
    getApplicationRoleSettings,
    getApplicationSettings
} from '../../utils/database.js';

import {
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import ApplicationService from '../../services/applicationService.js';


// ============================================================
// SHOW APPLICATION MODAL
// ============================================================

export async function showApplicationModal(
    interaction,
    applicationRole
) {

    if (!interaction.guild) {

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Applications can only be submitted inside a server.'
            }
        );
    }


    const roleId =
        String(applicationRole.roleId);


    // ========================================================
    // GET QUESTIONS
    // ========================================================

    let roleSettings;

    try {

        roleSettings =
            await getApplicationRoleSettings(
                interaction.client,
                interaction.guild.id,
                roleId
            );

    } catch (error) {

        console.error(
            'Could not load application questions:',
            error
        );

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.DATABASE,
                message:
                    'I could not load the application questions.'
            }
        );
    }


    const configuredQuestions =
        Array.isArray(roleSettings?.questions)
            ? roleSettings.questions
            : [];


    if (
        configuredQuestions.length === 0
    ) {

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.CONFIGURATION,
                message:
                    'This application has no questions configured.'
            }
        );
    }


    // Discord modals support a maximum of 5 text inputs.
    const questions =
        configuredQuestions
            .slice(0, 5)
            .map(
                (question, index) => ({
                    id:
                        `question_${index + 1}`,

                    question:
                        String(question)
                            .trim()
                            .slice(0, 45)
                })
            )
            .filter(
                item =>
                    item.question.length > 0
            );


    if (questions.length === 0) {

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.CONFIGURATION,
                message:
                    'This application has no valid questions.'
            }
        );
    }


    // ========================================================
    // MODAL ID
    // ========================================================

    const modalId =
        `application_submit:${roleId}:${interaction.user.id}`;


    const modal =
        new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(
                String(
                    applicationRole.name ||
                    'Staff Application'
                ).slice(0, 45)
            );


    // ========================================================
    // ADD QUESTIONS
    // ========================================================

    for (
        const question of questions
    ) {

        const input =
            new TextInputBuilder()
                .setCustomId(
                    question.id
                )
                .setLabel(
                    question.question
                )
                .setStyle(
                    TextInputStyle.Paragraph
                )
                .setMinLength(10)
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

    return interaction.showModal(
        modal
    );
}


// ============================================================
// HANDLE APPLICATION MODAL SUBMISSION
// ============================================================

export async function handleApplicationModal(
    interaction
) {

    if (!interaction.isModalSubmit()) {
        return false;
    }


    if (
        !interaction.customId.startsWith(
            'application_submit:'
        )
    ) {
        return false;
    }


    // ========================================================
    // GET ROLE ID
    // ========================================================

    const parts =
        interaction.customId.split(':');

    const roleId =
        parts[1];


    if (!roleId) {

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.CONFIGURATION,
                message:
                    'This application form is invalid.'
            }
        );

        return true;
    }


    if (!interaction.guild) {

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Applications can only be submitted inside a server.'
            }
        );

        return true;
    }


    // ========================================================
    // CHECK APPLICATION SETTINGS
    // ========================================================

    let settings;

    try {

        settings =
            await getApplicationSettings(
                interaction.client,
                interaction.guild.id
            );

    } catch (error) {

        console.error(
            'Could not load application settings:',
            error
        );

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.DATABASE,
                message:
                    'I could not load the application system.'
            }
        );

        return true;
    }


    if (!settings?.enabled) {

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.CONFIGURATION,
                message:
                    'Applications are currently disabled in this server.'
            }
        );

        return true;
    }


    // ========================================================
    // GET APPLICATION ROLE
    // ========================================================

    let applicationRoles;

    try {

        applicationRoles =
            await import(
                '../../utils/database.js'
            ).then(
                module =>
                    module.getApplicationRoles(
                        interaction.client,
                        interaction.guild.id
                    )
            );

    } catch (error) {

        console.error(
            'Could not load application roles:',
            error
        );

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.DATABASE,
                message:
                    'I could not load the application configuration.'
            }
        );

        return true;
    }


    const roles =
        Array.isArray(applicationRoles)
            ? applicationRoles
            : [];


    const applicationRole =
        roles.find(
            item =>
                String(item?.roleId) ===
                String(roleId)
        );


    if (!applicationRole) {

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.CONFIGURATION,
                message:
                    'This application is no longer available.'
            }
        );

        return true;
    }


    if (
        applicationRole.enabled === false
    ) {

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.CONFIGURATION,
                message:
                    'This application is currently disabled.'
            }
        );

        return true;
    }


    // ========================================================
    // PREVENT DUPLICATE ROLE
    // ========================================================

    if (
        interaction.member?.roles?.cache?.has(
            roleId
        )
    ) {

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.USER_INPUT,
                message:
                    'You already have this role.'
            }
        );

        return true;
    }


    // ========================================================
    // GET QUESTIONS
    // ========================================================

    let roleSettings;

    try {

        roleSettings =
            await getApplicationRoleSettings(
                interaction.client,
                interaction.guild.id,
                roleId
            );

    } catch (error) {

        console.error(
            'Could not retrieve application questions:',
            error
        );

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.DATABASE,
                message:
                    'I could not retrieve the application questions.'
            }
        );

        return true;
    }


    const configuredQuestions =
        Array.isArray(roleSettings?.questions)
            ? roleSettings.questions
            : [];


    // ========================================================
    // READ ANSWERS
    // ========================================================

    const answers = [];


    for (
        let index = 0;
        index < configuredQuestions.length &&
        index < 5;
        index++
    ) {

        const question =
            String(
                configuredQuestions[index] ?? ''
            ).trim();


        if (!question) {
            continue;
        }


        const fieldId =
            `question_${index + 1}`;


        let answer = '';

        try {

            answer =
                interaction.fields
                    .getTextInputValue(
                        fieldId
                    )
                    .trim();

        } catch {

            answer = '';
        }


        answers.push({

            question,

            answer
        });
    }


    // ========================================================
    // CHECK ANSWERS
    // ========================================================

    if (
        answers.length === 0
    ) {

        await replyUserError(
            interaction,
            {
                type: ErrorTypes.VALIDATION,
                message:
                    'No application answers were submitted.'
            }
        );

        return true;
    }


    for (
        const answer of answers
    ) {

        if (
            !answer.answer ||
            answer.answer.length < 10
        ) {

            await replyUserError(
                interaction,
                {
                    type: ErrorTypes.VALIDATION,
                    message:
                        'Please provide meaningful answers to all questions.'
                }
            );

            return true;
        }
    }


    // ========================================================
    // SUBMIT APPLICATION
    // ========================================================

    try {

        const application =
            await ApplicationService.submitApplication(

                interaction.client,

                {
                    guildId:
                        interaction.guild.id,

                    userId:
                        interaction.user.id,

                    roleId,

                    roleName:
                        applicationRole.name ||
                        'Application Role',

                    answers
                }
            );


        // ====================================================
        // SUCCESS
        // ====================================================

        return interaction.reply({

            embeds: [

                {
                    title:
                        'Application Submitted',

                    description:
                        `Your application for **${applicationRole.name || 'this position'}** has been submitted successfully.\n\n` +
                        `**Application ID:** \`${application.id}\`\n` +
                        `**Status:** Pending`,

                    timestamp:
                        new Date().toISOString()
                }

            ],

            flags:
                MessageFlags.Ephemeral
        });

    } catch (error) {

        console.error(
            'Application submission failed:',
            error
        );


        if (
            interaction.replied ||
            interaction.deferred
        ) {
            return true;
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
                    'Your application could not be submitted.'
            }
        );
    }
                }
