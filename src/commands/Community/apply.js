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
// TEMPORARY APPLICATION DATA
// ============================================================

const pendingApplications = new Map();


// ============================================================
// NORMALIZE QUESTIONS
// ============================================================

function normalizeQuestions(questions = []) {

    if (!Array.isArray(questions)) {
        return [];
    }

    return questions
        .map(question => String(question || '').trim())
        .filter(question => question.length > 0)
        .slice(0, 10);
}


// ============================================================
// GET QUESTIONS
// ============================================================

function getQuestions(settings, roleSettings) {

    let questions = [];


    // Role-specific questions
    if (
        Array.isArray(roleSettings?.questions) &&
        roleSettings.questions.length > 0
    ) {
        questions = normalizeQuestions(
            roleSettings.questions
        );
    }


    // Server-wide questions
    if (
        questions.length === 0 &&
        Array.isArray(settings?.questions) &&
        settings.questions.length > 0
    ) {
        questions = normalizeQuestions(
            settings.questions
        );
    }


    // Default questions
    if (questions.length === 0) {
        questions = [...DEFAULT_QUESTIONS];
    }


    // Always make 10 questions
    for (
        let i = questions.length;
        i < 10;
        i++
    ) {
        questions.push(DEFAULT_QUESTIONS[i]);
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

    const modal = new ModalBuilder()
        .setCustomId(
            `app_modal_${page}_${roleId}`
        )
        .setTitle(
            `Application: ${applicationName}`.slice(0, 45)
        );


    for (
        let i = startIndex;
        i < endIndex;
        i++
    ) {

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
            new ActionRowBuilder()
                .addComponents(input)
        );
    }


    return modal;
}


// ============================================================
// /APPLY
//
// Sends the application panel with Apply buttons.
// ============================================================

export default {

    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('apply')
        .setDescription(
            'Show available staff applications'
        ),

    category: 'Community',


    async execute(interaction) {

        if (!interaction.inGuild()) {

            return replyUserError(
                interaction,
                {
                    type: ErrorTypes.UNKNOWN,
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

    let applicationRoles;

    try {

        applicationRoles =
            await getApplicationRoles(
                interaction.client,
                interaction.guild.id
            );

    } catch (error) {

        console.error(
            'Failed to load application roles:',
            error
        );

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Unable to load applications right now.'
            }
        );
    }


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
                type: ErrorTypes.CONFIGURATION,
                message:
                    'There are currently no applications available.'
            }
        );
    }


    // ========================================================
    // EMBED
    // ========================================================

    const embed = createEmbed({

        title:
            'Staff Applications',

        description:
            'Choose an application below to apply.\n\n' +
            'Click the **Apply** button for the role you want.'
    });


    // ========================================================
    // APPLICATION BUTTONS
    // ========================================================

    const rows = [];

    let row =
        new ActionRowBuilder();


    for (
        let i = 0;
        i < enabledApplications.length && i < 25;
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
                    `Apply: ${application.name}`.slice(0, 80)
                )
                .setStyle(
                    ButtonStyle.Primary
                );


        row.addComponents(button);


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
    // SEND
    // ========================================================

    const payload = {
        embeds: [embed],
        components: rows
    };


    if (targetChannel) {
        return targetChannel.send(payload);
    }


    return interaction.reply(payload);
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
                type: ErrorTypes.UNKNOWN,
                message:
                    'Applications can only be used in a server.'
            }
        );
    }


    if (!applicationRole) {

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.CONFIGURATION,
                message:
                    'Application configuration was not found.'
            }
        );
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
// APPLICATION MODAL HANDLER
// ============================================================

export async function handleApplicationModal(
    interaction
) {

    if (!interaction.isModalSubmit()) {
        return false;
    }


    if (
        !interaction.customId.startsWith(
            'app_modal_'
        )
    ) {
        return false;
    }


    // ========================================================
    // READ MODAL CUSTOM ID
    //
    // app_modal_1_ROLE_ID
    // app_modal_2_ROLE_ID
    // ========================================================

    const parts =
        interaction.customId.split('_');


    const page =
        parts[2];


    const roleId =
        parts.slice(3).join('_');


    // ========================================================
    // LOAD APPLICATION ROLES
    // ========================================================

    let applicationRoles;

    try {

        applicationRoles =
            await getApplicationRoles(
                interaction.client,
                interaction.guild.id
            );

    } catch (error) {

        console.error(
            'Failed to load application roles:',
            error
        );

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Unable to load applications right now.'
            }
        );
    }


    // ========================================================
    // FIND APPLICATION ROLE
    // ========================================================

    const applicationRole =
        Array.isArray(applicationRoles)
            ? applicationRoles.find(
                application =>
                    String(application.roleId) ===
                    String(roleId)
            )
            : null;


    if (!applicationRole) {

        return replyUserError(
            interaction,
            {
                type: ErrorTypes.CONFIGURATION,
                message:
                    'Application configuration was not found.'
            }
        );
    }


    // ========================================================
    // LOAD QUESTIONS
    // ========================================================

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
    // QUESTIONS 1-5
    // ========================================================

    if (page === '1') {

        const answers = [];


        for (
            let i = 0;
            i < 5;
            i++
        ) {

            const answer =
                interaction.fields
                    .getTextInputValue(`q${i}`) || '';


            answers.push({

                question:
                    questions[i],

                answer:
                    answer.trim()
            });
        }


        // Q1 required
        if (!answers[0].answer) {

            return replyUserError(
                interaction,
                {
                    type: ErrorTypes.USER_INPUT,
                    message:
                        'Question 1 is required.'
                }
            );
        }


        // ====================================================
        // SAVE TEMPORARY APPLICATION
        // ====================================================

        const key =
            `${interaction.guild.id}:${interaction.user.id}:${roleId}`;


        pendingApplications.set(
            key,
            {

                guildId:
                    interaction.guild.id,

                userId:
                    interaction.user.id,

                roleId:
                    roleId,

                roleName:
                    applicationRole.name,

                username:
                    interaction.user.tag,

                avatar:
                    interaction.user.displayAvatarURL(),

                answers:
                    answers,

                createdAt:
                    Date.now()
            }
        );


        // ====================================================
        // OPEN QUESTIONS 6-10
        // ====================================================

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
    // QUESTIONS 6-10
    // ========================================================

    if (page === '2') {

        const key =
            `${interaction.guild.id}:${interaction.user.id}:${roleId}`;


        const pending =
            pendingApplications.get(key);


        if (!pending) {

            return replyUserError(
                interaction,
                {
                    type: ErrorTypes.UNKNOWN,
                    message:
                        'Your application session expired. Please click Apply again.'
                }
            );
        }


        const answers = [
            ...pending.answers
        ];


        for (
            let i = 5;
            i < 10;
            i++
        ) {

            const answer =
                interaction.fields
                    .getTextInputValue(`q${i}`) || '';


            answers.push({

                question:
                    questions[i],

                answer:
                    answer.trim()
            });
        }


        // ====================================================
        // SUBMIT APPLICATION
        // ====================================================

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

                        answers:
                            answers
                    }
                );


            pendingApplications.delete(
                key
            );


            const embed =
                successEmbed(
                    'Application Submitted',
                    `Your application for **${pending.roleName}** has been submitted successfully!\n\n` +
                    `**Application ID:** \`${application.id}\`\n` +
                    `**Status:** In Progress`
                );


            return interaction.reply({

                embeds: [
                    embed
                ],

                flags:
                    MessageFlags.Ephemeral
            });


        } catch (error) {

            console.error(
                'Application submission failed:',
                error
            );


            pendingApplications.delete(
                key
            );


            return replyUserError(
                interaction,
                {
                    type: ErrorTypes.UNKNOWN,
                    message:
                        'Something went wrong while submitting your application.'
                }
            );
        }
    }


    return false;
}


// ============================================================
// EXPORT HELPERS
// ============================================================

export {
    getQuestions,
    createApplicationModal
};
