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

const pendingApplications = new Map();


// ============================================================
// QUESTIONS
// ============================================================

function getQuestions(
    settings,
    roleSettings
) {

    let questions = [];

    if (
        Array.isArray(roleSettings?.questions) &&
        roleSettings.questions.length
    ) {

        questions =
            roleSettings.questions
                .map(q => String(q).trim())
                .filter(Boolean);
    }

    if (
        !questions.length &&
        Array.isArray(settings?.questions) &&
        settings.questions.length
    ) {

        questions =
            settings.questions
                .map(q => String(q).trim())
                .filter(Boolean);
    }

    if (!questions.length) {
        questions = [...DEFAULT_QUESTIONS];
    }

    while (questions.length < 10) {

        questions.push(
            DEFAULT_QUESTIONS[questions.length]
        );
    }

    return questions.slice(0, 10);
}


// ============================================================
// CREATE MODAL
// ============================================================

function createApplicationModal(
    roleId,
    applicationName,
    questions,
    start,
    end,
    page
) {

    const modal =
        new ModalBuilder()
            .setCustomId(
                `app_modal_${page}_${roleId}`
            )
            .setTitle(
                `Application: ${applicationName}`.slice(0, 45)
            );

    for (
        let i = start;
        i < end;
        i++
    ) {

        const question =
            questions[i];

        const input =
            new TextInputBuilder()
                .setCustomId(`q${i}`)
                .setLabel(
                    question.length > 45
                        ? question.slice(0, 42) + '...'
                        : question
                )
                .setStyle(
                    TextInputStyle.Paragraph
                )
                .setMaxLength(1000)
                .setRequired(i === 0);

        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(input)
        );
    }

    return modal;
}


// ============================================================
// /APPLY
// ============================================================

export default {

    data:
        new SlashCommandBuilder()
            .setName('apply')
            .setDescription(
                'Show available staff applications'
            ),

    category:
        'Community',

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

        return sendApplicationPanel(
            interaction
        );
    }
};


// ============================================================
// SEND APPLICATION PANEL
// ============================================================

export async function sendApplicationPanel(
    interaction
) {

    const applications =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const enabled =
        Array.isArray(applications)
            ? applications.filter(
                application =>
                    application.enabled !== false
            )
            : [];

    if (!enabled.length) {

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

    const embed =
        createEmbed({

            title:
                'Staff Applications',

            description:
                'Choose an application below.\n\n' +
                'Click the Apply button for the role you want.'
        });


    const rows = [];

    let row =
        new ActionRowBuilder();

    for (
        let i = 0;
        i < Math.min(enabled.length, 25);
        i++
    ) {

        const application =
            enabled[i];

        row.addComponents(

            new ButtonBuilder()
                .setCustomId(
                    `application_apply:${application.roleId}`
                )
                .setLabel(
                    `Apply: ${application.name}`.slice(0, 80)
                )
                .setStyle(
                    ButtonStyle.Primary
                )
        );

        if (row.components.length === 5) {

            rows.push(row);

            row =
                new ActionRowBuilder();
        }
    }

    if (row.components.length) {
        rows.push(row);
    }

    return interaction.reply({

        embeds: [embed],

        components: rows
    });
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

    return interaction.showModal(
        modal
    );
}


// ============================================================
// APPLICATION MODALS
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

    const parts =
        interaction.customId.split('_');

    const page =
        parts[2];

    const roleId =
        parts.slice(3).join('_');


    const roles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    const applicationRole =
        Array.isArray(roles)
            ? roles.find(
                item =>
                    String(item.roleId) ===
                    String(roleId)
            )
            : null;

    if (!applicationRole) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is no longer available.'
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

        for (
            let i = 0;
            i < 5;
            i++
        ) {

            answers.push({

                question:
                    questions[i],

                answer:
                    (
                        interaction.fields
                            .getTextInputValue(`q${i}`) ||
                        ''
                    ).trim()
            });
        }

        if (!answers[0].answer) {

            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.USER_INPUT,

                    message:
                        'Question 1 is required.'
                }
            );
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

                roleId:
                    String(roleId),

                roleName:
                    applicationRole.name,

                username:
                    interaction.user.tag,

                avatar:
                    interaction.user.displayAvatarURL(),

                answers,

                createdAt:
                    Date.now()
            }
        );

        return interaction.showModal(
            createApplicationModal(
                roleId,
                applicationRole.name,
                questions,
                5,
                10,
                2
            )
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

            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.UNKNOWN,

                    message:
                        'Your application session expired. Click Apply again.'
                }
            );
        }

        const answers =
            [...pending.answers];

        for (
            let i = 5;
            i < 10;
            i++
        ) {

            answers.push({

                question:
                    questions[i],

                answer:
                    (
                        interaction.fields
                            .getTextInputValue(`q${i}`) ||
                        ''
                    ).trim()
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

            pendingApplications.delete(
                key
            );

            return interaction.reply({

                embeds: [
                    successEmbed(
                        'Application Submitted',

                        `Your application for **${pending.roleName}** has been submitted.\n\n` +
                        `Application ID: \`${application.id}\`\n` +
                        `Status: **Pending**`
                    )
                ],

                flags:
                    MessageFlags.Ephemeral
            });

        } catch (error) {

            pendingApplications.delete(
                key
            );

            console.error(
                'Application submission error:',
                error
            );

            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.UNKNOWN,

                    message:
                        'Your application could not be submitted.'
                }
            );
        }
    }

    return false;
}

export {
    getQuestions,
    createApplicationModal
};
