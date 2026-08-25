import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user from the server")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The user to ban")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("Reason for the ban"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    category: "moderation",

    async execute(interaction, config, client) {

        const user =
            interaction.options.getUser("target");

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided";


        // Check target
        if (!user) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to ban.',
                {
                    subtype: 'invalid_user'
                },
            );
        }


        // Prevent self ban
        if (user.id === interaction.user.id) {
            throw new TitanBotError(
                'Cannot ban self',
                ErrorTypes.VALIDATION,
                'You cannot ban yourself.',
            );
        }


        // Prevent bot ban
        if (user.id === client.user.id) {
            throw new TitanBotError(
                'Cannot ban bot',
                ErrorTypes.VALIDATION,
                'You cannot ban the bot.',
            );
        }


        // Ban user
        const result =
            await ModerationService.banUser({
                guild: interaction.guild,
                user,
                moderator: interaction.member,
                reason,
            });


        // DM the banned user
        try {

            await user.send({
                embeds: [
                    warningEmbed(
                        "You Have Been Banned",

                        `You have been banned from ***${interaction.guild.name}***.\n\n` +
                        `**Reason:** ${reason}\n` +
                        `**Moderator:** ${interaction.user.tag}`
                    )
                ]
            });

        } catch (error) {

            console.log(
                `Failed to DM banned user ${user.tag}: ${error.message}`
            );

        }


        // Server response
        await InteractionHelper.universalReply(interaction, {
            embeds: [
                successEmbed(
                    `Banned ${user.tag}`,

                    `**Reason:** ${reason}\n` +
                    `**Moderator:** ${interaction.user.tag}\n` +
                    `**Case ID:** #${result.caseId}`,
                ),
            ],
        });
    },
};
