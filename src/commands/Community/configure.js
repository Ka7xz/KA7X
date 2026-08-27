// ============================================================
// configure.js
// Configure an existing staff application
// ============================================================

import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
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
    getApplicationRoleSettings,
    saveApplicationRoles,
    saveApplicationRoleSettings
} from '../../utils/database.js';

import ApplicationService from '../../services/applicationService.js';


// ============================================================
// /CONFIGURE APPLICATIONS
// ============================================================

export default {

    data:
        new SlashCommandBuilder()

            .setName('configure')

            .setDescription(
                'Configure existing staff applications'
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageGuild
            )

            .addSubcommand(subcommand =>
                subcommand

                    .setName('applications')

                    .setDescription(
                        'Configure an existing application'
                    )
            ),


    category:
        'Community',


    // ========================================================
    // EXECUTE
    // ========================================================

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


        try {

            await ApplicationService.checkManagerPermission(
                interaction.client,
                interaction.guild.id,
                interaction.member
            );


            return showApplicationConfigurator(
                interaction
            );

        } catch (error) {

            console.error(
                'Application configurator error:',
                error
            );


            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return;
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
                        'The application configurator could not be opened.'
                }
            );
        }
    }
};


// ============================================================
// SHOW APPLICATION CONFIGURATOR
// ============================================================

async function showApplicationConfigurator(
    interaction
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
            'Could not load application roles:',
            error
        );

        return replyUserError(
            interaction,
            {
                type:
                    ErrorTypes.DATABASE,

                message:
                    'I could not load your configured applications.'
            }
        );
    }


    const roles =
        Array.isArray(applicationRoles)
            ? applicationRoles
            : [];


    if (roles.length === 0) {

        return interaction.reply({

            embeds: [

                createEmbed({

                    title:
                        'No Applications',

                    description:
                        'No applications have been created yet.\n\n' +
                        'Use `/app-admin setup` to create your first application.'
                })

            ],

            flags:
                MessageFlags.Ephemeral
        });
    }


    // ========================================================
    // APPLICATION SELECT MENU
    // ========================================================

    const menu =
        new StringSelectMenuBuilder()

            .setCustomId(
                `configure_application:${interaction.user.id}`
            )

            .setPlaceholder(
                'Select an application to configure'
            )

            .setMinValues(1)

            .setMaxValues(1);


    for (
        const application of roles.slice(0, 25)
    ) {

        const role =
            await interaction.guild.roles
                .fetch(
                    application.roleId
                )
                .catch(() => null);


        menu.addOptions(

            new StringSelectMenuOptionBuilder()

                .setLabel(
                    String(
                        application.name ||
                        'Application'
                    ).slice(0, 100)
                )

                .setDescription(
                    role
                        ? `Role: ${role.name}`.slice(0, 100)
                        : 'Application role no longer exists'
                )

                .setValue(
                    String(
                        application.roleId
                    )
                )
        );
    }


    const row =
        new ActionRowBuilder()
            .addComponents(menu);


    await interaction.reply({

        embeds: [

            createEmbed({

                title:
                    'Application Configurator',

                description:
                    'Select an existing application below.\n\n' +
                    'You can edit its name, questions, and other configuration.'
            })

        ],

        components: [
            row
        ],

        flags:
            MessageFlags.Ephemeral
    });


    // ========================================================
    // WAIT FOR APPLICATION SELECTION
    // ========================================================

    const message =
        await interaction.fetchReply();


    let selection;


    try {

        selection =
            await message.awaitMessageComponent({

                time:
                    120000,

                filter:
                    component =>
                        component.user.id ===
                            interaction.user.id &&

                        component.customId ===
                            `configure_application:${interaction.user.id}`
            });

    } catch {

        return interaction.editReply({

            embeds: [

                createEmbed({

                    title:
                        'Configurator Expired',

                    description:
                        'The configuration session expired. Run `/configure applications` again.'
                })

            ],

            components: []
        });
    }


    const roleId =
        selection.values[0];


    const selectedApplication =
        roles.find(
            application =>
                String(application.roleId) ===
                String(roleId)
        );


    if (!selectedApplication) {

        return selection.update({

            embeds: [

                createEmbed({

                    title:
                        'Application Not Found',

                    description:
                        'That application could not be found.'
                })

            ],

            components: []
        });
    }


    // ========================================================
    // CONFIGURATION MENU
    // ========================================================

    const configureMenu =
        new StringSelectMenuBuilder()

            .setCustomId(
                `configure_option:${interaction.user.id}:${roleId}`
            )

            .setPlaceholder(
                'Choose what you want to edit'
            )

            .setMinValues(1)

            .setMaxValues(1)

            .addOptions(

                new StringSelectMenuOptionBuilder()

                    .setLabel(
                        'Application Name'
                    )

                    .
