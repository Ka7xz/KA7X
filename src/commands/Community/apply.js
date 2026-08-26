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
// PENDING APPLICATIONS
// ============================================================

const pendingApplications =
    new Map();


// ============================================================
// APPLICATION REQUIREMENTS
// ============================================================

const APPLICATION_REQUIREMENTS = [
    'Be an active member of the server.',
    'Follow all server rules and staff guidelines.',
    'Be respectful, mature, and responsible.',
    'Answer every question honestly.',
    'Do not submit multiple applications for the same position.'
];


// ============================================================
// APPLICATION EMOJIS
// ============================================================

function getApplicationEmoji(
    applicationName
) {

    const name =
        String(
            applicationName || ''
        ).toLowerCase();

    if (
        name.includes('admin')
    ) {
        return '👑';
    }

    if (
        name.includes('moderator') ||
        name.includes('mod')
    ) {
        return '🛡️';
    }

    if (
        name.includes('helper')
    ) {
        return '🤝';
    }

    if (
        name.includes('developer') ||
        name.includes('dev')
    ) {
        return '💻';
    }

    if (
        name.includes('support')
    ) {
        return '🎧';
    }

    if (
        name.includes('event')
    ) {
        return '🎉';
    }

    return '📋';
}


// ============================================================
// QUESTIONS
// ============================================================

function getQuestions(
    settings,
    roleSettings
) {

    let questions = [];


    if (
        Array.isArray(
            roleSettings?.questions
        ) &&
        roleSettings.questions.length
    ) {

        questions =
            roleSettings.questions
                .map(
                    q =>
                        String(q).trim()
                )
                .filter(Boolean);
    }


    if (
        !questions.length &&
        Array.isArray(
            settings?.questions
        ) &&
        settings.questions.length
    ) {

        questions =
            settings.questions
                .map(
                    q =>
                        String(q).trim()
                )
                .filter(Boolean);
    }


    if (
        !questions.length
    ) {

        questions =
            [
                ...DEFAULT_QUESTIONS
            ];
    }


    while (
        questions.length < 10
    ) {

        questions.push(
            DEFAULT_QUESTIONS[
                questions.length
            ]
        );
    }


    return questions.slice(
        0,
        10
    );
}


// ============================================================
// CREATE APPLICATION MODAL
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
                `Application: ${applicationName}`
                    .slice(0, 45)
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
                .setCustomId(
                    `q${i}`
                )
                .setLabel(
                    question.length > 45
                        ? question.slice(
                            0,
                            42
                        ) + '...'
                        : question
                )
                .setStyle(
                    TextInputStyle.Paragraph
                )
                .setMaxLength(
                    1000
                )
                .setRequired(
                    i === 0
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
// /APPLY
// ============================================================

export default {

    data:
        new SlashCommandBuilder()
            .setName(
                'apply'
            )
            .setDescription(
                'View available staff applications'
            ),

    category:
        'Community',


    async execute(
        interaction
    ) {

        if (
            !interaction.inGuild()
        ) {

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


    const configured =
        Array.isArray(
            applications
        )
            ? applications.slice(
                0,
                25
            )
            : [];


    if (
        !configured.length
    ) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'There are currently no applications configured.'
            }
        );
    }


    // ========================================================
    // APPLICATION STATUS
    // ========================================================

    const openCount =
        configured.filter(
            application =>
                application.enabled !== false
        ).length;


    const closedCount =
        configured.length -
        openCount;


    // ========================================================
    // MAIN PANEL
    // ========================================================

    let description =
        '**Join Our Team**\n\n' +

        'Choose the position you want to apply for. ' +
        'Each application is reviewed by our staff team.\n\n' +

        '**Requirements**\n' +

        APPLICATION_REQUIREMENTS
            .map(
                requirement =>
                    `• ${requirement}`
            )
            .join('\n') +

        '\n\n' +

        '**Application Status**\n' +

        `🟢 **${openCount}** Open` +
        '  •  ' +

        `🔴 **${closedCount}** Closed` +

        '\n\n' +

        'Select an application below to begin.';


    // ========================================================
    // APPLICATION FIELDS
    // ========================================================

    const fields =
        configured.map(
            application => {

                const enabled =
                    application.enabled !== false;


                const name =
                    String(
                        application.name ||
                        'Application'
                    )
                        .trim()
                        .slice(
                            0,
                            256
                        );


                const emoji =
                    getApplicationEmoji(
                        name
                    );


                const roleId =
                    String(
                        application.roleId
                    );


                const role =
                    interaction.guild
                        .roles.cache.get(
                            roleId
                        );


                const roleText =
                    role
                        ? `<@&${roleId}>`
                        : 'Role unavailable';


                const status =
                    enabled
                        ? '🟢 **Open**'
                        : '🔴 **Closed**';


                return {

                    name:
                        `${emoji} ${name}`,

                    value:
                        `${status}\n` +
                        `**Position:** ${roleText}\n` +
                        `**Requirements:** Meet the server requirements and answer the application honestly.`,

                    inline:
                        false
                };
            }
        );


    // ========================================================
    // EMBED
    // ========================================================

    const embed =
        createEmbed({

            title:
                'Staff Recruitment',

            description,

            fields,

            footer:
                {
                    text:
                        'Select an application below to get started.'
                }
        });


    // ========================================================
    // BUTTON ROWS
    // ========================================================

    const rows = [];

    let row =
        new ActionRowBuilder();


    for (
        let i = 0;
        i < configured.length;
        i++
    ) {

        const application =
            configured[i];


        const enabled =
            application.enabled !== false;


        const name =
            String(
                application.name ||
                'Application'
            )
                .trim();


        const emoji =
            getApplicationEmoji(
                name
            );


        const button =
            new ButtonBuilder()
                .setCustomId(
                    `application_apply:${application.roleId}`
                )
                .setLabel(
                    enabled
                        ? `Apply for ${name}`
                            .slice(0, 80)
                        : `Closed • ${name}`
                            .slice(0, 80)
                )
                .setEmoji(
                    emoji
                )
                .setStyle(
                    enabled
                        ? ButtonStyle.Primary
                        : ButtonStyle.Secondary
                )
                .setDisabled(
                    !enabled
                );


        row.addComponents(
            button
        );


        // Discord allows maximum 5 buttons
        // in one action row.

        if (
            row.components.length === 5
        ) {

            rows.push(
                row
            );

            row =
                new ActionRowBuilder();
        }
    }


    if (
        row.components.length
    ) {

        rows.push(
            row
        );
    }


    // ========================================================
    // SEND PANEL
    // ========================================================

    return interaction.reply({

        embeds: [
            embed
        ],

        components:
            rows
    });
}


// ============================================================
// SHOW FIRST MODAL
// ============================================================

export async function showApplicationModal(
    interaction,
    applicationRole
) {

    // Re-check the application status.
    // This prevents users from applying through
    // an old button after an admin disables it.

    if (
        applicationRole.enabled === false
    ) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is currently closed.'
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

    if (
        !interaction.isModalSubmit()
    ) {

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
        interaction.customId.split(
            '_'
        );


    const page =
        parts[2];


    const roleId =
        parts
            .slice(3)
            .join('_');


    // ========================================================
    // GET APPLICATION
    // ========================================================

    const roles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );


    const applicationRole =
        Array.isArray(
            roles
        )
            ? roles.find(
                item =>
                    String(
                        item.roleId
                    ) ===
                    String(
                        roleId
                    )
            )
            : null;


    if (
        !applicationRole
    ) {

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


    // ========================================================
    // CHECK STATUS AGAIN
    // ========================================================

    if (
        applicationRole.enabled === false
    ) {

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.CONFIGURATION,

                message:
                    'This application is currently closed.'
            }
        );
    }


    // ========================================================
    // GET QUESTIONS
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
    // ========================================================

    if (
        page === '1'
    ) {

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
                            .getTextInputValue(
                                `q${i}`
                            ) ||
                        ''
                    ).trim()
            });
        }


        if (
            !answers[0].answer
        ) {

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
            `${interaction.guild.id}:` +
            `${interaction.user.id}:` +
            `${roleId}`;


        pendingApplications.set(
            key,
            {

                guildId:
                    interaction.guild.id,

                userId:
                    interaction.user.id,

                roleId:
                    String(
                        roleId
                    ),

                roleName:
                    applicationRole.name,

                username:
                    interaction.user.tag,

                avatar:
                    interaction.user
                        .displayAvatarURL(),

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

    if (
        page === '2'
    ) {

        const key =
            `${interaction.guild.id}:` +
            `${interaction.user.id}:` +
            `${roleId}`;


        const pending =
            pendingApplications.get(
                key
            );


        if (
            !pending
        ) {

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
            [
                ...pending.answers
            ];


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
                            .getTextInputValue(
                                `q${i}`
                            ) ||
                        ''
                    ).trim()
            });
        }


        try {

            const application =
   
