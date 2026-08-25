import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a user")

        .addUserOption((o) =>
            o
                .setName("target")
                .setRequired(true)
                .setDescription("User to warn"),
        )

        .addStringOption((o) =>
            o
                .setName("reason")
                .setRequired(true)
                .setDescription("Reason for the warning"),
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    category: "moderation",

    async execute(interaction, config, client) {

        const deferSuccess =
            await InteractionHelper.safeDefer(interaction);

        if (!deferSuccess) {
            logger.warn(`Warn interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'warn'
            });

            return;
        }

        const target =
            interaction.options.getUser("target");

        const member =
            interaction.options.getMember("target");

        const reason =
            interaction.options.getString("reason");

        const moderator =
            interaction.user;

        const guildId =
            interaction.guildId;


        // Check target
        if (!target) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to warn.',
                {
                    subtype: 'invalid_user'
                },
            );
        }


        // Check reason
        if (!reason) {
            throw new TitanBotError(
                'Missing warning reason',
                ErrorTypes.VALIDATION,
                'You must provide a reason for the warning.',
                {
                    subtype: 'missing_required'
                },
            );
        }


        // Check if member is in server
        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "The target user is not currently in this server."
            );
        }


        // Check moderation hierarchy
        ModerationService.assertModerationHierarchy(
            interaction.member,
            member,
            'warn'
        );


        // Add warning
        const {
            id,
            totalCount
        } = await WarningService.addWarning({
            guildId,
            userId: target.id,
            moderatorId: moderator.id,
            reason,
            timestamp: Date.now()
        });


        // Moderation log
        await logModerationAction({
            client,
            guild: interaction.guild,

            event: {
                action: "User Warned",

                target:
                    `${target.tag} (${target.id})`,

                executor:
                    `${moderator.tag} (${moderator.id})`,

                reason,

                metadata: {
                    userId: target.id,
                    moderatorId: moderator.id,
                    totalWarns: totalCount,
                    warningNumber: totalCount,
                    warningId: id
                }
            }
        });


        // DM the warned user
        try {

            await target.send({
                embeds: [
                    warningEmbed(
                        "You Have Been Warned",

                        `You have received a warning in **${interaction.guild.name}**.\n\n` +

                        `**Reason:** ${reason}\n` +

                        `**Total Warns:** ${totalCount}\n\n` +

                        `**Moderator:** ${moderator.tag}`
                    )
                ]
            });

        } catch (error) {

            logger.warn(
                `Failed to DM warned user`,
                {
                    userId: target.id,
                    guildId,
                    error: error.message
                }
            );

        }


        // Server warning embed
        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    successEmbed(
                        `Warned ${target.tag}`,

                        `**Reason:** ${reason}\n` +
                        `**Total Warns:** ${totalCount}\n` +
                        `**Moderator:** ${moderator.tag}`,
                    ),
                ],
            }
        );

    }
};
