import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';

import {
    getColor,
    getDefaultApplicationQuestions
} from '../../config/bot.js';

import {
    createEmbed,
    successEmbed
} from '../../utils/embeds.js';

import { logger } from '../../utils/logger.js';

import {
    handleInteractionError,
    withErrorHandling,
    createError,
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import ApplicationService from '../../services/applicationService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

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

import {
    getApplicationSettings,
    getUserApplications,
    getApplication,
    getApplicationRoles,
    updateApplication,
    getApplicationRoleSettings
} from '../../utils/database.js';


/*
|--------------------------------------------------------------------------
| Temporary application answers
|--------------------------------------------------------------------------
|
| Discord modals are limited to 5 inputs.
| Therefore:
|
| Modal 1 = Questions 1-5
| Modal 2 = Questions 6-10
|
*/

const pendingApplications = new Map();


/*
|--------------------------------------------------------------------------
| Default 10 Questions
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| Application Status
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
            ? 'In Progress'
            : normalized === 'approved'
                ? 'Accepted'
                : normalized === 'denied'
                    ? 'Denied'
                    : 'Unknown';

    return {
        normalized,
        statusLabel,
        statusEmoji
    };
}


/*
|--------------------------------------------------------------------------
| Get Exactly 10 Questions
|--------------------------------------------------------------------------
*/

function normalizeQuestions(configuredQuestions = []) {
    function normalizeQuestions(configuredQuestions = []) {
    const questions = Array.isArray(configuredQuestions)
        ? configuredQuestions
            .map(q => String(q || '').trim())
            .filter(q => q.length > 0)
            .slice(0, 10)
        : [];

    return questions;
}

function getQuestions(settings, roleSettings) {
    let questions = [];

    if (roleSettings?.questions && Array.isArray(roleSettings.questions)) {
        questions = normalizeQuestions(roleSettings.questions);
    }

    if (questions.length === 0 && settings?.questions && Array.isArray(settings.questions)) {
        questions = normalizeQuestions(settings.questions);
    }

    if (questions.length === 0) {
        questions = [
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
    }

    return questions.slice(0, 10);
}
 export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName("apply")
        .setDescription("Apply for a server role")
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("View available applications")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("submit")
                .setDescription("Submit an application")
                .addStringOption(option =>
                    option
                        .setName("application")
                        .setDescription("Application to submit")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("status")
                .setDescription("Check your application status")
                .addStringOption(option =>
                    option
                        .setName("id")
                        .setDescription("Application ID")
                        .setRequired(false)
                )
        ),

    category: "Community",

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: "This command can only be used in a server."
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "list") {
            return handleList(interaction);
        }

        if (subcommand === "submit") {
            return handleSubmit(interaction);
        }

        if (subcommand === "status") {
            return handleStatus(interaction);
        }
    }
};
    async function handleList(interaction) {
    await InteractionHelper.safeDefer(interaction);

    const applicationRoles = await getApplicationRoles(
        interaction.client,
        interaction.guild.id
    );

    if (!applicationRoles || applicationRoles.length === 0) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [
                createEmbed({
                    title: "Applications",
                    description: "There are currently no applications available."
                })
            ]
        });
    }

    const embed = createEmbed({
        title: "Staff Applications",
        description:
            "Select an application below to apply.\n\n" +
            "Each application contains up to 10 questions. " +
            "Only the first question is required."
    });

    const rows = [];

    for (const app of applicationRoles.slice(0, 25)) {
        const role = interaction.guild.roles.cache.get(app.roleId);

        embed.addFields({
            name: app.name,
            value: role
                ? `Application for ${role}`
                : "Application role unavailable",
            inline: false
        });

        const button = new ButtonBuilder()
            .setCustomId(`application_apply:${app.roleId}`)
            .setLabel(`Apply: ${app.name}`.slice(0, 80))
            .setStyle(ButtonStyle.Primary);

        rows.push(
            new ActionRowBuilder().addComponents(button)
        );
    }

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
        components: rows
    });
            }
    async function handleSubmit(interaction) {
    const applicationName = interaction.options.getString("application");

    const applicationRoles = await getApplicationRoles(
        interaction.client,
        interaction.guild.id
    );

    const applicationRole = applicationRoles.find(
        app => app.name.toLowerCase() === applicationName.toLowerCase()
    );

    if (!applicationRole) {
        return replyUserError(interaction, {
            type: ErrorTypes.USER_INPUT,
            message: "Application not found."
        });
    }

    await showApplicationModal(interaction, applicationRole);
}

async function showApplicationModal(interaction, applicationRole) {
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

    const modal = new ModalBuilder()
        .setCustomId(`app_modal_${applicationRole.roleId}`)
        .setTitle(`Application: ${applicationRole.name}`.slice(0, 45));

    questions.forEach((question, index) => {
        const input = new TextInputBuilder()
            .setCustomId(`q${index}`)
            .setLabel(
                question.length > 45
                    ? `${question.substring(0, 42)}...`
                    : question
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(index === 0)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );
    });

    await interaction.showModal(modal);
            }
    export async function handleApplicationModal(interaction) {
    if (!interaction.isModalSubmit()) return;

    if (!interaction.customId.startsWith("app_modal_")) return;

    const roleId = interaction.customId.replace("app_modal_", "");

    const applicationRoles = await getApplicationRoles(
        interaction.client,
        interaction.guild.id
    );

    const applicationRole = applicationRoles.find(
        app => app.roleId === roleId
    );

    if (!applicationRole) {
        return replyUserError(interaction, {
            type: ErrorTypes.CONFIGURATION,
            message: "Application configuration was not found."
        });
    }

    const settings = await getApplicationSettings(
        interaction.client,
        interaction.guild.id
    );

    const roleSettings = await getApplicationRoleSettings(
        interaction.client,
        interaction.guild.id,
        roleId
    );

    const questions = getQuestions(settings, roleSettings);

    const answers = [];

    for (let i = 0; i < questions.length; i++) {
        const answer = interaction.fields.getTextInputValue(`q${i}`) || "";

        answers.push({
            question: questions[i],
            answer: answer.trim()
        });
    }

    if (!answers[0].answer) {
        return replyUserError(interaction, {
            type: ErrorTypes.USER_INPUT,
            message: "Question 1 is required."
        });
    }

    const application = await ApplicationService.submitApplication(
        interaction.client,
        {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            roleId,
            roleName: applicationRole.name,
            username: interaction.user.tag,
            avatar: interaction.user.displayAvatarURL(),
            answers
        }
    );

    const embed = successEmbed(
        "Application Submitted",
        `Your application for **${applicationRole.name}** has been submitted.\n\n` +
        `**Application ID:** \`${application.id}\`\n` +
        `**Status:** In Progress`
    );

    return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
    });
    }
    async function handleStatus(interaction) {
    const appId = interaction.options.getString("id");

    await InteractionHelper.safeDefer(interaction, {
        flags: ["Ephemeral"]
    });

    if (appId) {
        const application = await getApplication(
            interaction.client,
            interaction.guild.id,
            appId
        );

        if (!application || application.userId !== interaction.user.id) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: "Application not found or you do not have permission to view it."
            });
        }

        const status = getApplicationStatusPresentation(
            application.status
        );

        const embed = createEmbed({
            title: `Application #${application.id}`,
            description:
                `**Application:** ${application.roleName}\n` +
                `**Status:** ${status.statusLabel}\n` +
                `**Application ID:** \`${application.id}\``
        });

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            components: []
        });
    }

    const applications = await getUserApplications(
        interaction.client,
        interaction.guild.id,
        interaction.user.id
    );

    if (!applications || applications.length === 0) {
        return InteractionHelper.safeEditReply(interaction, {
            embeds: [
                createEmbed({
                    title: "Your Applications",
                    description: "You have not submitted any applications."
                })
            ]
        });
    }

    const embed = createEmbed({
        title: "Your Applications",
        description: `You have submitted **${applications.length}** application(s).`
    });

    applications.slice(0, 10).forEach(application => {
        const status = getApplicationStatusPresentation(
            application.status
        );

        embed.addFields({
            name: `${application.roleName} — ${status.statusLabel}`,
            value: `**ID:** \`${application.id}\``,
            inline: false
        });
    });

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
        components: []
    });
        }
