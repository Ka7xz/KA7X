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
    getApplicationRoleSettings
} from '../../utils/database.js';


// ============================================================
// DEFAULT QUESTIONS
// ============================================================

const DEFAULT_QUESTIONS = [
    "Why do you want this role?",
    "What experience do you have?",
    "Why should we choose you?",
    "How long have you been in this server?",
    "How active are you?",
    "How would you handle a difficult member?",
    "How would you handle a conflict between members?",
    "What would you do if another staff member broke a rule?",
    "What makes you a good fit for this role?",
    "Is there anything else you would like us to know?"
];


// ============================================================
// TEMPORARY APPLICATION DATA
// ============================================================

const pendingApplications = new Map();


// ============================================================
// NORMALIZE QUESTIONS
// ============================================================

function normalizeQuestions(configuredQuestions = []) {
    if (!Array.isArray(configuredQuestions)) {
        return [];
    }

    return configuredQuestions
        .map(q => String(q || '').trim())
        .filter(q => q.length > 0)
        .slice(0, 10);
}


// ============================================================
// GET 10 QUESTIONS
// ============================================================

function getQuestions(settings, roleSettings) {
    let questions = [];

    // Role-specific questions
    if (
        Array.isArray(roleSettings?.questions) &&
        roleSettings.questions.length > 0
    ) {
        questions = normalizeQuestions(roleSettings.questions);
    }

    // Server-wide questions
    if (
        questions.length === 0 &&
        Array.isArray(settings?.questions) &&
        settings.questions.length > 0
    ) {
        questions = normalizeQuestions(settings.questions);
    }

    // Fill missing questions with defaults
    while (questions.length < 10) {
        questions.push(DEFAULT_QUESTIONS[questions.length]);
    }

    return questions.slice(0, 10);
}


// ============================================================
// APPLICATION STATUS
// ============================================================

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


// ============================================================
// CREATE MODAL
// ============================================================

function createApplicationModal(
    roleId,
    applicationName,
    questions,
    startIndex,
    endIndex,
    page
) {
    const modal = new ModalBuilder()
        .setCustomId(
            `app_modal_${page}_${roleId}`
        )
        .setTitle(
            `Application: ${applicationName}`.slice(0, 45)
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


// ============================================================
// /APPLY COMMAND
// ============================================================

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('apply')
        .setDescription('Manage role applications')

        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View available applications')
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('submit')
                .setDescription('Submit an application')
                .addStringOption(option =>
                    option
                        .setName('application')
                        .setDescription('Application to submit')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your application status')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Application ID')
                        .setRequired(false)
                )
        ),

    category: 'Community',

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'This command can only be used in a server.'
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'list') {
            return handleList(interaction);
        }

        if (subcommand === 'submit') {
            return handleSubmit(interaction);
        }

        if (subcommand === 'status') {
            return handleStatus(interaction);
        }
    }
};


// ============================================================
// /APPLY LIST
// ============================================================

async function handleList(interaction) {
    await InteractionHelper.safeDefer(interaction);

    const applicationRoles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    if (
        !applicationRoles ||
        applicationRoles.length === 0
    ) {
        return InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    createEmbed({
                        title: '📋 Applications',
                        description:
                            'There are currently no applications available.'
                    })
                ],
                components: []
            }
        );
    }

    const embed = createEmbed({
        title: '📋 Staff Applications',
        description:
            'Click an **Apply** button below to start your application.\n\n' +
            '📝 **10 questions total**\n' +
            '✅ **Question 1 is required**\n' +
            '⚪ **Questions 2–10 are optional**'
    });

    const rows = [];
    let row = new ActionRowBuilder();

    for (
        let i = 0;
        i < applicationRoles.length && i < 25;
        i++
    ) {
        const app = applicationRoles[i];

        const role =
            interaction.guild.roles.cache.get(
                app.roleId
            );

        embed.addFields({
            name: `${i + 1}. ${app.name}`,
            value: role
                ? `Role: <@&${app.roleId}>`
                : 'Role unavailable',
            inline: false
        });

        const button = new ButtonBuilder()
            .setCustomId(
                `application_apply:${app.roleId}`
            )
            .setLabel(
                `Apply: ${app.name}`.slice(0, 80)
            )
            .setStyle(ButtonStyle.Primary);

        row.addComponents(button);

        // Discord allows maximum 5 buttons per row
        if (row.components.length === 5) {
            rows.push(row);
            row = new ActionRowBuilder();
        }
    }

    if (row.components.length > 0) {
        rows.push(row);
    }

    return InteractionHelper.safeEditReply(
        interaction,
        {
            embeds: [embed],
            components: rows
        }
    );
}


// ============================================================
// /APPLY SUBMIT
// ============================================================

async function handleSubmit(interaction) {
    const applicationName =
        interaction.options.getString('application');

    const applicationRoles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const applicationRole =
        applicationRoles.find(
            app =>
                app.name.toLowerCase() ===
                applicationName.toLowerCase()
        );

    if (!applicationRole) {
        return replyUserError(interaction, {
            type: ErrorTypes.USER_INPUT,
            message: 'Application not found.'
        });
    }

    return showApplicationModal(
        interaction,
        applicationRole
    );
}


// ============================================================
// SHOW FIRST MODAL
// ============================================================

export async function showApplicationModal(
    interaction,
    applicationRole
) {
    const settings =
        await getApplicationSettings(
            interaction.client,
            interaction.guild.id
        );

    const roleSettings =
        await getApplicationRoleSettings(
            interaction.client,
            interaction.guild.id,
            applicationRole.roleId
        );

    const questions =
        getQuestions(
            settings,
            roleSettings
        );

    const modal =
        createApplicationModal(
            applicationRole.roleId,
            applicationRole.name,
            questions,
            0,
            5,
            1
        );

    return interaction.showModal(modal);
}


// ============================================================
// MODAL HANDLER
// ============================================================

export async function handleApplicationModal(
    interaction
) {
    if (!interaction.isModalSubmit()) {
        return;
    }

    if (
        !interaction.customId.startsWith(
            'app_modal_'
        )
    ) {
        return;
    }

    const parts =
        interaction.customId.split('_');

    const page = parts[2];
    const roleId = parts.slice(3).join('_');

    const applicationRoles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const applicationRole =
        applicationRoles.find(
            app => app.roleId === roleId
        );

    if (!applicationRole) {
        return replyUserError(interaction, {
            type: ErrorTypes.CONFIGURATION,
            message:
                'Application configuration was not found.'
        });
    }

    const settings =
        await getApplicationSettings(
            interaction.client,
            interaction.guild.id
        );

    const roleSettings =
        await getApplicationRoleSettings(
            interaction.client,
            interaction.guild.id,
            roleId
        );

    const questions =
        getQuestions(
            settings,
            roleSettings
        );


    // ========================================================
    // PAGE 1
    // ========================================================

    if (page === '1') {
        const answers = [];

        for (let i = 0; i < 5; i++) {
            const answer =
                interaction.fields.getTextInputValue(
                    `q${i}`
                ) || '';

            answers.push({
                question: questions[i],
                answer: answer.trim()
            });
        }

        // Q1 required
        if (!answers[0].answer) {
            return replyUserError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message: 'Question 1 is required.'
            });
        }

        const key =
            `${interaction.guild.id}:${interaction.user.id}:${roleId}`;

        pendingApplications.set(
            key,
            {
                guildId:
                    interaction.guild.id,

                userId:
                    interaction.user.id,

                roleId,

                roleName:
                    applicationRole.name,

                username:
                    interaction.user.tag,

                avatar:
                    interaction.user.displayAvatarURL(),

                answers,

                createdAt: Date.now()
            }
        );

        // Automatically open questions 6-10
        const secondModal =
            createApplicationModal(
                roleId,
                applicationRole.name,
                questions,
                5,
                10,
                2
            );

        return interaction.showModal(
            secondModal
        );
    }


    // ========================================================
    // PAGE 2
    // ========================================================

    if (page === '2') {
        const key =
            `${interaction.guild.id}:${interaction.user.id}:${roleId}`;

        const pending =
            pendingApplications.get(key);

        if (!pending) {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Your application session expired. Please click Apply again.'
            });
        }

        const answers = [
            ...pending.answers
        ];

        for (let i = 5; i < 10; i++) {
            const answer =
                interaction.fields.getTextInputValue(
                    `q${i}`
                ) || '';

            answers.push({
                question: questions[i],
                answer: answer.trim()
            });
        }

        try {
            const application =
                await ApplicationService.submitApplication(
                    interaction.client,
                    {
                        guildId:
                            pending.guildId,

                        userId:
                            pending.userId,

                        roleId:
                            pending.roleId,

                        roleName:
                            pending.roleName,

                        username:
                            pending.username,

                        avatar:
                            pending.avatar,

                        answers
                    }
                );

            pendingApplications.delete(key);

            const embed =
                successEmbed(
                    'Application Submitted',
                    `Your application for **${pending.roleName}** has been submitted successfully!\n\n` +
                    `**Application ID:** \`${application.id}\`\n` +
                    `**Status:** 🟡 In Progress`
                );

            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error(
                'Application submission failed',
                {
                    error: error.message,
                    guildId:
                        interaction.guild.id,
                    userId:
                        interaction.user.id,
                    roleId,
                    stack: error.stack
                }
            );

            pendingApplications.delete(key);

            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Something went wrong while submitting your application.'
            });
        }
    }
}


// ============================================================
// STATUS
// ============================================================

async function handleStatus(interaction) {
    const appId =
        interaction.options.getString('id');

    await InteractionHelper.safeDefer(
        interaction,
        {
            flags: ['Ephemeral']
        }
    );

    if (appId) {
        const application =
            await getApplication(
                interaction.client,
                interaction.guild.id,
                appId
            );

        if (
            !application ||
            application.userId !==
                interaction.user.id
        ) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message:
                    'Application not found or you do not have permission to view it.'
            });
        }

        const status =
            getApplicationStatusPresentation(
                application.status
            );

        const embed = createEmbed({
            title:
                `Application #${application.id}`,

            description:
                `**Application:** ${application.roleName || 'Unknown'}\n` +
                `**Status:** ${status.statusEmoji} ${status.statusLabel}\n` +
                `**Application ID:** \`${application.id}\``
        });

        return InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [embed],
                components: []
            }
        );
    }

    const applications =
        await getUserApplications(
            interaction.client,
            interaction.guild.id,
            interaction.user.id
        );

    if (
        !applications ||
        applications.length === 0
    ) {
        return InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    createEmbed({
                        title:
                            '📋 Your Applications',

                        description:
                            'You have not submitted any applications yet.'
                    })
                ],
                components: []
            }
        );
    }

    const embed = createEmbed({
        title: '📋 Your Applications',
        description:
            `You have submitted **${applications.length}** application(s).`
    });

    applications
        .slice(0, 10)
        .forEach(application => {
            const status =
                getApplicationStatusPresentation(
                    application.status
                );

            embed.addFields({
                name:
                    `${application.roleName || 'Unknown'} — ${status.statusLabel}`,

                value:
                    `**ID:** \`${application.id}\`\n` +
                    `**Status:** ${status.statusEmoji} ${status.statusLabel}`,

                inline: false
            });
        });

    return InteractionHelper.safeEditReply(
        interaction,
