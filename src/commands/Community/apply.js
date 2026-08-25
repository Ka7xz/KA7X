import {
    SlashCommandBuilder,
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

import { logger } from '../../utils/logger.js';

import {
    withErrorHandling,
    createError,
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import ApplicationService from '../../services/applicationService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import {
    getApplicationSettings,
    getUserApplications,
    getApplication,
    getApplicationRoles,
    getApplicationRoleSettings,
    updateApplication
} from '../../utils/database.js';

import {
    logEvent,
    EVENT_TYPES,
    resolveApplicationLogChannel
} from '../../services/loggingService.js';

import {
    formatLogLine,
    resolveUserAuthor
} from '../../utils/logging/logEmbeds.js';

import { getGuildConfig } from '../../services/config/guildConfig.js';


/*
|--------------------------------------------------------------------------
| Default questions
|--------------------------------------------------------------------------
|
| Total: 10
| Q1: required
| Q2-Q10: optional
|
*/

const DEFAULT_QUESTIONS = [
    "Why do you want this role?",
    "What experience do you have?",
    "Why should we choose you?",
    "How active are you?",
    "What are your strengths?",
    "What are your weaknesses?",
    "How would you handle a difficult situation?",
    "How would you deal with a rule violation?",
    "What would you contribute to the server?",
    "Is there anything else you would like us to know?"
];


/*
|--------------------------------------------------------------------------
| Temporary applications
|--------------------------------------------------------------------------
|
| Discord allows only 5 text inputs in one modal.
|
| Modal 1 = Q1-Q5
| Modal 2 = Q6-Q10
|
*/

const pendingApplications = new Map();


/*
|--------------------------------------------------------------------------
| Normalize questions
|--------------------------------------------------------------------------
*/

function normalizeQuestions(configuredQuestions = []) {
    const questions = Array.isArray(configuredQuestions)
        ? configuredQuestions
            .map(q => String(q || '').trim())
            .filter(q => q.length > 0)
            .slice(0, 10)
        : [];

    return questions;
}


/*
|--------------------------------------------------------------------------
| Get exactly up to 10 questions
|--------------------------------------------------------------------------
*/

function getQuestions(settings, roleSettings) {
    let questions = [];

    if (
        roleSettings?.questions &&
        Array.isArray(roleSettings.questions)
    ) {
        questions = normalizeQuestions(roleSettings.questions);
    }

    if (
        questions.length === 0 &&
        settings?.questions &&
        Array.isArray(settings.questions)
    ) {
        questions = normalizeQuestions(settings.questions);
    }

    if (questions.length === 0) {
        questions = [...DEFAULT_QUESTIONS];
    }

    /*
     * Always allow a maximum of 10.
     * If fewer than 10 were configured, use the defaults
     * to fill the remaining questions.
     */

    if (questions.length < 10) {
        for (const question of DEFAULT_QUESTIONS) {
            if (questions.length >= 10) break;

            if (!questions.includes(question)) {
                questions.push(question);
            }
        }
    }

    return questions.slice(0, 10);
}


/*
|--------------------------------------------------------------------------
| Application status
|--------------------------------------------------------------------------
*/

function getApplicationStatusPresentation(statusValue) {
    const normalized =
        typeof statusValue === 'string'
            ? statusValue.trim().toLowerCase()
            : 'unknown';

    const statusLabel =
        normalized === 'pending'
            ? 'In Progress'
            : normalized === 'approved'
                ? 'Accepted'
                : normalized === 'denied'
                    ? 'Denied'
                    : 'Unknown';

    const statusEmoji =
        normalized === 'pending'
            ? '🟡'
            : normalized === 'approved'
                ? '🟢'
                : normalized === 'denied'
                    ? '🔴'
                    : '⚪';

    return {
        normalized,
        statusLabel,
        statusEmoji
    };
}


/*
|--------------------------------------------------------------------------
| Create modal
|--------------------------------------------------------------------------
*/

function createQuestionModal(applicationRole, questions, startIndex, page) {
    const endIndex = Math.min(startIndex + 5, questions.length);

    const modal = new ModalBuilder()
        .setCustomId(
            `app_modal_${page}_${applicationRole.roleId}`
        )
        .setTitle(
            `Application: ${applicationRole.name}`.slice(0, 45)
        );

    for (let i = startIndex; i < endIndex; i++) {
        const question = questions[i];

        const input = new TextInputBuilder()
            .setCustomId(`q${i}`)
            .setLabel(
                question.length > 45
                    ? `${question.substring(0, 42)}...`
                    : question
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(i === 0)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );
    }

    return modal;
}


/*
|--------------------------------------------------------------------------
| Show first application modal
|--------------------------------------------------------------------------
*/

export async function showApplicationModal(
    interaction,
    applicationRole
) {
    const settings = await getApplicationSettings(
        interaction.client,
        interaction.guild.id
    );

    const roleSettings = await getApplicationRoleSettings(
        interaction.client,
        interaction.guild.id,
        applicationRole.roleId
    );

    const questions = getQuestions(settings, roleSettings);

    /*
     * Check pending application before opening form.
     */

    const userApps = await getUserApplications(
        interaction.client,
        interaction.guild.id,
        interaction.user.id
    );

    const pendingApp = userApps.find(
        app => app.status === 'pending'
    );

    if (pendingApp) {
        return replyUserError(interaction, {
            type: ErrorTypes.UNKNOWN,
            message:
                'You already have a pending application. Please wait for it to be reviewed.'
        });
    }

    /*
     * Store temporary application information.
     */

    const key =
        `${interaction.guild.id}:${interaction.user.id}:${applicationRole.roleId}`;

    pendingApplications.set(key, {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        roleId: applicationRole.roleId,
        roleName: applicationRole.name,
        questions,
        answers: []
    });

    const modal = createQuestionModal(
        applicationRole,
        questions,
        0,
        1
    );

    await interaction.showModal(modal);
}


/*
|--------------------------------------------------------------------------
| Handle application modal
|--------------------------------------------------------------------------
*/

export async function handleApplicationModal(interaction) {
    if (!interaction.isModalSubmit()) return;

    if (!interaction.customId.startsWith('app_modal_')) {
        return;
    }

    /*
     * Format:
     *
     * app_modal_1_ROLEID
     * app_modal_2_ROLEID
     */

    const parts = interaction.customId.split('_');

    const page = Number(parts[2]);
    const roleId = parts.slice(3).join('_');

    if (![1, 2].includes(page) || !roleId) {
        return replyUserError(interaction, {
            type: ErrorTypes.USER_INPUT,
            message: 'Invalid application form.'
        });
    }

    const key =
        `${interaction.guild.id}:${interaction.user.id}:${roleId}`;

    const pending = pendingApplications.get(key);

    if (!pending) {
        return replyUserError(interaction, {
            type: ErrorTypes.UNKNOWN,
            message:
                'This application session has expired. Please click the Apply button again.'
        });
    }

    /*
     * Collect answers from this modal.
     */

    const startIndex = page === 1 ? 0 : 5;
    const endIndex = page === 1
        ? Math.min(5, pending.questions.length)
        : pending.questions.length;

    for (let i = startIndex; i < endIndex; i++) {
        let answer = '';

        try {
            answer =
                interaction.fields.getTextInputValue(`q${i}`) || '';
        } catch {
            answer = '';
        }

        pending.answers[i] = answer.trim();
    }

    /*
     * Q1 is the ONLY required question.
     */

    if (
        page === 1 &&
        !pending.answers[0]
    ) {
        return replyUserError(interaction, {
            type: ErrorTypes.USER_INPUT,
            message: 'Question 1 is required.'
        });
    }

    /*
     * First modal finished.
     * Open Q6-Q10.
     */

    if (
        page === 1 &&
        pending.questions.length > 5
    ) {
        const applicationRole = {
            roleId: pending.roleId,
            name: pending.roleName
        };

        const secondModal = createQuestionModal(
            applicationRole,
            pending.questions,
            5,
            2
        );

        return interaction.showModal(secondModal);
    }

    /*
     * Build final answers.
     */

    const answers = pending.questions.map(
        (question, index) => ({
            question,
            answer: pending.answers[index] || ''
        })
    );

    /*
     * Submit application.
     */

    try {
        const application =
            await ApplicationService.submitApplication(
                interaction.client,
                {
                    guildId: pending.guildId,
                    userId: pending.userId,
                    roleId: pending.roleId,
                    roleName: pending.roleName,
                    username: interaction.user.tag,
                    avatar: interaction.user.displayAvatarURL(),
                    answers
                }
            );

        /*
         * Remove temporary data.
         */

        pendingApplications.delete(key);

        /*
         * Confirmation embed.
         */

        const embed = successEmbed(
            '✅ Application Submitted',
            `Your application for **${pending.roleName}** has been submitted successfully!\n\n` +
            `**Application ID:** \`${application.id}\`\n` +
            `**Status:** 🟡 In Progress\n\n` +
            `Staff will review your application and you can check its status with:\n` +
            `\`/apply status id:${application.id}\``
        );

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
