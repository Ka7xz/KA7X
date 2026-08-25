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
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('User to warn')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    category: 'moderation',

    async execute(interaction, config, client) {
        const target = interaction.options.getUser('target');
        const member = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason');
        const moderator = interaction.user;
        const guild = interaction.guild;
        const guildId = interaction.guildId;

        if (!target) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to warn.',
                { subtype: 'invalid_user' }
            );
        }

        if (!reason) {
            throw new TitanBotError(
                'Missing warning reason',
                ErrorTypes.VALIDATION,
                'You must provide a reason for the warning.',
                { subtype: 'missing_required' }
            );
        }

        if (!member) {
            throw new TitanBotError(
                'Target not found',
                ErrorTypes.USER_INPUT,
                'The target user is not currently in this server.'
            );
        }

        ModerationService.assertModerationHierarchy(
            interaction.member,
            member,
            'warn'
        );

        /*
         * Add the warning.
         * WarningService keeps the warning count per server.
         */
        const { id, totalCount } = await WarningService.addWarning({
            guildId,
            userId: target.id,
            moderatorId: moderator.id,
            reason,
            timestamp: Date.now()
        });

        /*
         * Send the server response immediately.
         * This helps prevent the interaction from expiring.
         */
        const serverEmbed = successEmbed(
            `Warned ${target.tag}`,
            `**Reason:** ${reason}\n` +
            `**Total Warns:** ${totalCount}\n` +
            `**Moderator:** ${moderator.tag}\n` +
            `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
        );

        try {
            await interaction.reply({
                embeds: [serverEmbed]
            });
        } catch (error) {
            logger.error('Failed to send warn response', {
                userId: target.id,
                guildId,
                error: error.message
            });
        }

        /*
         * Send warning DM.
         */
        try {
            const dmEmbed = warningEmbed(
                'You Have Been Warned',
                `You have received a warning in **${guild.name}**.\n\n` +
                `**Reason:** ${reason}\n` +
                `**Total Warns:** ${totalCount}\n` +
                `**Moderator:** ${moderator.tag}\n` +
                `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
            );

            await target.send({
                embeds: [dmEmbed]
            });
        } catch (error) {
            logger.warn('Could not DM warned user', {
                userId: target.id,
                guildId,
                error: error.message
            });
        }

        /*
         * Log moderation action.
         */
        try {
            await logModerationAction({
                client,
                guild,
                event: {
                    action: 'User Warned',
                    target: `${target.tag} (${target.id})`,
                    executor: `${moderator.tag} (${moderator.id})`,
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
        } catch (error) {
            logger.error('Failed to log warning', {
                userId: target.id,
                guildId,
                error: error.message
            });
        }
    }
};
