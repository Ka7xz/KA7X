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
                .setRequired(true),
        )

        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the unban")
                .setRequired(false),
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),

    category: "moderation",

    async execute(interaction, config, client) {

        const deferSuccess =
            await InteractionHelper.safeDefer(interaction);

        if (!deferSuccess) {

            logger.warn(
                `Unban interaction defer failed`,
                {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'unban',
                }
            );

            return;
        }


        const rawTarget =
            interaction.options.getString("target");

        const targetId =
            rawTarget
                .replace(/[<@!>]/g, '')
                .trim();


        // Validate user ID
        if (!/^\d{17,20}$/.test(targetId)) {

            return replyUserError(interaction, {
               
