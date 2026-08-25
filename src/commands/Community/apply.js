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

import {
    ErrorTypes,
    replyUserError
} from '../../utils/errorHandler.js';

import {
    getApplicationRoles,
    getApplicationSettings,
    getApplicationRoleSettings
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';


// ============================================================
// DEFAULT QUESTIONS
// ============================================================

const DEFAULT_QUESTIONS = [
    'Why do you want this role?',
    'What experience do you have?',
    'Why should we choose you?',
    'How long have you been in this server?',
    'How active are you?',
    'How would you handle a difficult member?',
    'How would you handle a conflict between members?',
    'What would you do if another staff member broke a rule?',
    'What makes you a good fit for this role?',
    'Is there anything else you would like us to know?'
];


// ============================================================
// TEMPORARY APPLICATION SESSIONS
// ============================================================

const pendingApplications = new Map();


// ============================================================
// NORMALIZE QUESTIONS
// ============================================================

function normalizeQuestions(
    questions
) {

    if (!Array.isArray(questions)) {
        return [];
    }

    return questions
        .map(
            question =>
                String(question || '').trim()
        )
        .filter(
            question =>
                question.length > 0
        )
        .slice(0, 10);
}


// ============================================================
// GET APPLICATION QUESTIONS
// ============================================================

function getQuestions(
    settings,
    roleSettings
) {

    let questions = [];


    // --------------------------------------------------------
    // Role-specific questions
    // --------------------------------------------------------

    if (
        Array.isArray(
            roleSettings?.questions
        ) &&
        roleSettings.questions.length > 0
    ) {

        questions =
            normalizeQuestions(
                roleSettings.questions
            );
    }


    // --------------------------------------------------------
    // Server-wide questions
    // --------------------------------------------------------

    if (
        questions.length === 0 &&
        Array.isArray(
            settings?.questions
        ) &&
        settings.questions.length > 0
    ) {

        questions =
            normalizeQuestions(
                settings.questions
            );
    }


    // --------------------------------------------------------
    // Default questions
    // --------------------------------------------------------

    if (
        questions.length === 0
    ) {

        questions =
            [...DEFAULT_QUESTIONS];
    }


    // --------------------------------------------------------
    // Fill to exactly 10
    // --------------------------------------------------------

    for (
        let i = questions.length;
        i < 10;
        i++
    ) {

        questions.push(
            DEFAULT_QUESTIONS[i]
        );
    }


    return questions.slice(0, 10);
}


// ============================================================
// CREATE APPLICATION MODAL
// ============================================================

function createApplicationModal(
    roleId,
    applicationName,
    questions,
    startIndex,
    endIndex,
    page
) {

    const modal =
        new ModalBuilder()
            .setCustomId(
                `app_modal_${page}_${roleId}`
            )
            .setTitle(
                `Application: ${applicationName}`
                    .slice(0, 45)
            );


    for (
        let i = startIndex;
        i < endIndex;
        i++
    ) {

        const question =
            questions[i];


        const input =
            new TextInputBuilder()
                .setCustomId(
                    `q${i}`
                )
                .setLabel(
                    question.length > 45
                        ? `${question.substring(0, 42)}...`
                        : question
                )
                .setStyle(
                    TextInputStyle.Paragraph
                )
                .setRequired(
                    i === 0
                )
                .setMaxLength(
                    1000
                );


        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(
                    input
                )
        );
    }


    return modal;
}


// ============================================================
// /APPLY COMMAND
//
// This command sends the application embed.
// Users then click the Apply button.
// ============================================================

export default {

    slashOnly: true,

    data:
        new SlashCommandBuilder()
            .setName('apply')
            .setDescription(
                'Show available applications'
            ),

    category:
        'Community',


    async execute(
        interaction
    ) {

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


        return sendApplicationPanel(
            interaction
        );
    }
};


// ============================================================
// SEND APPLICATION PANEL
// ============================================================

export async function sendApplicationPanel(
    interaction,
    targetChannel = null
) {

    const applicationRoles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );


    // --------------------------------------------------------
    // Only enabled applications
    // --------------------------------------------------------

    const enabledApplications =
        Array.isArray(applicationRoles)

            ? applicationRoles.filter(
                application =>
                    application.enabled !== false
            )

            : [];


    if (
        enabledApplications.length === 0
    ) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'There are currently no applications available.'
            }
        );
    }


    // ========================================================
    // CREATE EMBED
    // ========================================================

    const embed =
        createEmbed({

            title:
                'Staff Applications',

            description:
                'Choose an application below to submit your application.\n\n' +
                'Click the appropriate **Apply** button to begin.'
        });


    // ========================================================
    // CREATE BUTTONS
    // ========================================================

    const rows = [];

    let row =
        new ActionRowBuilder();


    for (
        let i = 0;
        i < enabledApplications.length &&
        i < 25;
        i++
    ) {

        const application =
            enabledApplications[i];


        const button =
            new ButtonBuilder()
                .setCustomId(
                    `application_apply:${application.roleId}`
                )
                .setLabel(
                    `Apply: ${application.name}`
                        .slice(0, 80)
                )
                .setStyle(
                    ButtonStyle.Primary
                );


        row.addComponents(
            button
        );


        // Discord allows 5 buttons per row

        if (
            row.components.length === 5
        ) {

            rows.push(row);

            row =
                new ActionRowBuilder();
        }
    }


    if (
        row.components.length > 0
    ) {

        rows.push(row);
    }


    // ========================================================
    // SEND PANEL
    // ========================================================

    const payload = {
        embeds: [
            embed
        ],

        components:
            rows
    };


    if (targetChannel) {

        return targetChannel.send(
            payload
        );
    }


    return interaction.reply(
        payload
    );
}


// ============================================================
// SHOW APPLICATION MODAL
// ============================================================

export async function showApplicationModal(
    interaction,
    applicationRole
) {

    if (!interaction.inGuild()) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.UNKNOWN,

                message:
                    'Applications can only be used in a server.'
            }
        );
    }


    // ========================================================
    // GET SETTINGS
    // ========================================================

    const settings =
        await getApplicationSettings(
            interaction.client,
            interaction.guild.id
        );


    // ========================================================
    // GET ROLE SETTINGS
    // ========================================================

    const roleSettings =
        await getApplicationRoleSettings(
            interaction.client,
            interaction.guild.id,
            applicationRole.roleId
        );


    // ========================================================
    // GET QUESTIONS
    // ========================================================

    const questions =
        getQuestions(
            settings,
            roleSettings
        );


    // ========================================================
    // CREATE FIRST MODAL
    // ========================================================

    const modal =
        createApplicationModal(
           
