import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

import {
    getDefaultApplicationQuestions,
} from '../../config/bot.js';

import {
    createEmbed,
    successEmbed,
} from '../../utils/embeds.js';

import { logger } from '../../utils/logger.js';

import {
    handleInteractionError,
    withErrorHandling,
    createError,
    ErrorTypes,
    replyUserError,
} from '../../utils/errorHandler.js';

import ApplicationService from '../../services/applicationService.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';

import {
    logEvent,
    EVENT_TYPES,
    resolveApplicationLogChannel,
} from '../../services/loggingService.js';

import {
    formatLogLine,
    resolveUserAuthor,
} from '../../utils/logging/logEmbeds.js';

import {
    getGuildConfig,
} from '../../services/config/guildConfig.js';

import {
    getApplicationSettings,
    getUserApplications,
    getApplication,
    getApplicationRoles,
    updateApplication,
    getApplicationRoleSettings,
} from '../../utils/database.js';


/*
|--------------------------------------------------------------------------
| APPLICATION TEMPORARY DATA
|--------------------------------------------------------------------------
|
| Used between modal page 1 and modal page 2.
|
*/

const pendingApplicationAnswers = new Map();


/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const MAX_QUESTIONS = 10;
const REQUIRED_QUESTIONS = 1;


/*
|--------------------------------------------------------------------------
| DEFAULT QUESTIONS
|--------------------------------------------------------------------------
*/

const DEFAULT_QUESTIONS = [
    "Why do you want this role?",
    "What experience do you have?",
    "What are your strengths?",
    "What are your weaknesses?",
    "How active are you?",
    "How would you handle a difficult situation?",
    "Why should we choose you?",
    "How would you help the server?",
    "Do you have any previous staff experience?",
    "Anything else you would like us to know?",
];


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

function getApplicationStatusPresentation(statusValue) {
    const normalized =
        typeof statusValue === 'string'
            ? statusValue.trim().toLowerCase()
            : 'unknown';

    const statusLabel =
        normalized === 'pending'
            ? 'In Progress'
            : normalized === 'approved'
                ? 'Accepted'
                : normalized === 'denied'
                    ? 'Denied'
                    : 'Unknown';

    const statusEmoji =
        normalized === 'pending'
            ?
