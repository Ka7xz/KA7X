import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user from the server")

        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The user to kick")
                .setRequired(true),
        )

        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("Reason for the kick"),
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers
        ),

    category: "moderation",

    async execute(interaction, config, client) {

        const targetUser =
            interaction.options.getUser("target");

        const member =
            interaction.options.getMember("target");

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided";


        // Check target
        if (!targetUser) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to kick.',
                {
                    subtype: 'invalid_user'
                },
            );
        }


        // Prevent self kick
        if (targetUser.id === interaction.user.id) {
            throw new TitanBotError(
                "Cannot kick self",
                ErrorTypes.VALIDATION,
                "You cannot kick yourself.",
            );
        }


        // Prevent bot kick
        if (targetUser.id === client.user.id) {
            throw new TitanBotError(
                "Cannot kick bot",
                ErrorTypes.VALIDATION,
                "You cannot kick the bot.",
            );
        }


        // Check member
        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "The target user is not currently in this server.",
                {
                    subtype: 'user_not_found'
                },
            );
        }


        // Kick user
        const result =
            await ModerationService.kickUser({
                guild: interaction.guild,
                member,
                moderator: interaction.member,
                reason,
            });


        // Send DM before server response
        try {

            await targetUser.send({
                embeds: [
                    warningEmbed(
                        "You Have Been Kicked",

                        `You have been kicked from ***${interaction.guild.name}***.\n\n` +
                        `**Reason:** ${reason}\n` +
                        `**Moderator:** ${interaction.user.tag}`
                    )
                ]
            });

        } catch (error) {

            console.log(
                `Failed to DM kicked user ${targetUser.tag}: ${error.message}`
            );

        }


        // Server response
        await InteractionHelper.universalReply(interaction, {
            embeds: [
                successEmbed(
                    `Kicked ${targetUser.tag}`,

                    `**Reason:** ${reason}\n` +
                    `**Moderator:** ${interaction.user.tag}\n` +
                    `**Case ID:** #${result.caseId}`,
                ),
            ],
        });
    },
};
