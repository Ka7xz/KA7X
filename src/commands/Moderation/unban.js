import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user from the server")

        .addStringOption(option =>
            option
                .setName("target")
                .setDescription("The ID (or mention) of the user to unban")
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the unban")
                .setRequired(false)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),

    category: "moderation",

    async execute(interaction, config, client) {

        const deferSuccess =
            await InteractionHelper.safeDefer(interaction);

        if (!deferSuccess) {
            logger.warn(`Unban interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unban',
            });
            return;
        }

        const rawTarget =
            interaction.options.getString("target");

        const targetId =
            rawTarget
                .replace(/[<@!>]/g, '')
                .trim();

        if (!/^\d{17,20}$/.test(targetId)) {
            return replyUserError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message:
                    'Please provide a valid user ID or mention.',
            });
        }

        const targetUser =
            await client.users.fetch(targetId).catch(() => null);

        if (!targetUser) {
            return replyUserError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message:
                    `Could not find a user with the ID \`${targetId}\`.`,
            });
        }

        const reason =
            interaction.options.getString("reason") ||
            "No reason provided";


        // Unban the user
        const result =
            await ModerationService.unbanUser({
                guild: interaction.guild,
                user: targetUser,
                moderator: interaction.member,
                reason,
            });


        // Reply to the server FIRST
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    `User Unbanned`,
                    `Successfully unbanned **${targetUser.tag}** from the server.\n\n` +
                    `**Reason:** ${reason}\n` +
                    `**Moderator:** ${interaction.user.tag}\n` +
                    `**Case ID:** #${result.caseId}`,
                ),
            ],
        });


        // Send DM AFTER the interaction has been answered
        try {

            await targetUser.send({
                embeds: [
                    warningEmbed(
                        "You Have Been Unbanned",

                        `You have been unbanned from ***${interaction.guild.name}***.\n\n` +
                        `**Reason:** ${reason}\n` +
                        `**Moderator:** ${interaction.user.tag}`
                    ),
                ],
            });

        } catch (error) {

            logger.warn(`Failed to DM unbanned user`, {
                userId: targetUser.id,
                guildId: interaction.guildId,
                error: error.message,
            });

        }
    },
};
