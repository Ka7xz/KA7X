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
            interaction
