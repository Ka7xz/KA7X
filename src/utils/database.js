// database.js — facade re-exporting split modules for backward compatibility

import { pgDb } from './postgresDatabase.js';
import { logger } from './logger.js';
import { BotConfig, getDefaultApplicationQuestions } from '../config/bot.js';
import { getXpForLevel } from '../services/leveling/leveling.js';

export {
    db,
    initializeDatabase,
    getFromDb,
    setInDb,
    deleteFromDb,
} from './database/wrapper.js';

export {
    getGuildConfigKey,
    getGuildBirthdaysKey,
    getBirthdayLeftBackupKey,
    getBirthdayTrackingKey,
    getTicketKey,
    getTicketCounterKey,
    getInviteTrackingKey,
    getMemberInvitesKey,
    getInviteUsesKey,
    getFakeAccountKey,
    getEconomyKey,
    getEconomyPrefix,
    getAFKKey,
    getWelcomeConfigKey,
    getLevelingKey,
    getUserLevelKey,
    getUserLevelPrefix,
    getApplicationRolesKey,
    getApplicationSettingsKey,
    getUserApplicationsKey,
    getApplicationKey,
    getApplicationsPrefix,
    getJoinToCreateConfigKey,
    getJoinToCreateChannelsKey,
    getWarningsKey,
    getWarningsPrefix,
    getUserNotesKey,
    getUserNotesListKey,
    getReactionRoleKey,
    getReactionRolesPrefix,
    getServerCountersKey,
    getGiveawayEntryKey,
    getGiveawayLockKey,
    canonicalizeKey,
    getLegacyVariantsForCanonical,
} from './database/keys.js';

export {
    getTicketData,
    getOpenTicketCountForUser,
    saveTicketData,
    deleteTicketData,
    getTicketCounter,
    incrementTicketCounter,
    getGuildTicketStats,
} from './database/tickets.js';

import { db, getFromDb, setInDb } from './database/wrapper.js';

import {
    getGuildConfigKey,
    getGuildBirthdaysKey,
    getLevelingKey,
    getUserLevelKey,
    getApplicationRolesKey,
    getApplicationSettingsKey,
    getUserApplicationsKey,
    getApplicationKey,
    getJoinToCreateConfigKey,
    getJoinToCreateChannelsKey,
    getWelcomeConfigKey,
    getEconomyKey,
    getAFKKey,
    getUserLevelPrefix,
} from './database/keys.js';

export async function insertVerificationAudit(record) {
    try {
        if (!db.initialized) {
            await db.initialize();
        }

        if (
            db.isAvailable() &&
            typeof pgDb.insertVerificationAudit === 'function'
        ) {
            return await pgDb.insertVerificationAudit(record);
        }

        const key = `verification:audit:${record.guildId}`;
        const existing = await getFromDb(key, []);
        const auditEntries =
            Array.isArray(existing)
                ? existing
                : [];

        const maxInMemoryAuditEntries =
            BotConfig?.verification?.maxInMemoryAuditEntries ?? 1000;

        auditEntries.push({
            ...record,
            createdAt:
                record.createdAt ||
                new Date().toISOString()
        });

        if (
            auditEntries.length >
            maxInMemoryAuditEntries
        ) {
            auditEntries.splice(
                0,
                auditEntries.length -
                    maxInMemoryAuditEntries
            );
        }

        await setInDb(
            key,
            auditEntries
        );

        return true;

    } catch (error) {
        logger.error(
            'Error storing verification audit:',
            error
        );

        return false;
    }
}

export function unwrapReplitData(data) {
    if (
        typeof data === 'object' &&
        data !== null &&
        data.ok !== undefined &&
        data.value !== undefined
    ) {
        return unwrapReplitData(
            data.value
        );
    }

    return data;
}

export { pgDb };

export const getMessage = (
    key,
    replacements = {}
) => {
    let message =
        BotConfig.messages[key] ||
        key;

    for (
        const [k, v] of Object.entries(
            replacements
        )
    ) {
        message =
            message.replace(
                new RegExp(
                    `\\{${k}\\}`,
                    'g'
                ),
                v
            );
    }

    return message;
};

export const getColor = (
    path,
    fallback = '#000000'
) => {
    const parts =
        path.split('.');

    let current =
        BotConfig.embeds.colors;

    for (
        const part of parts
    ) {
        if (
            current[part] ===
            undefined
        ) {
            logger.warn(
                `Color path '${path}' not found in config, using fallback`
            );

            return fallback;
        }

        current =
            current[part];
    }

    return typeof current === 'string'
        ? current
        : fallback;
};

export async function getGuildBirthdays(
    client,
    guildId
) {
    const key =
        getGuildBirthdaysKey(
            guildId
        );

    try {
        if (
            !client.db ||
            typeof client.db.get !==
                'function'
        ) {
            logger.error(
                'Database client is not available for getGuildBirthdays.'
            );

            return {};
        }

        const rawData =
            await client.db.get(
                key,
                {}
            );

        return (
            unwrapReplitData(
                rawData
            ) || {}
        );

    } catch (error) {
        logger.error(
            `Error retrieving birthdays for guild ${guildId}:`,
            error
        );

        return {};
    }
}

export async function setBirthday(
    client,
    guildId,
    userId,
    month,
    day
) {
    try {
        if (
            !client.db ||
            typeof client.db.set !==
                'function'
        ) {
            logger.error(
                'Database client is not available for setBirthday.'
            );

            return false;
        }

        const key =
            getGuildBirthdaysKey(
                guildId
            );

        const birthdays =
            await getGuildBirthdays(
                client,
                guildId
            );

        birthdays[userId] = {
            month,
            day
        };

        await client.db.set(
            key,
            birthdays
        );

        return true;

    } catch (error) {
        logger.error(
            `Error setting birthday for user ${userId} in guild ${guildId}:`,
            error
        );

        return false;
    }
}

export async function deleteBirthday(
    client,
    guildId,
    userId
) {
    try {
        if (
            !client.db ||
            typeof client.db.set !==
                'function'
        ) {
            logger.error(
                'Database client is not available for deleteBirthday.'
            );

            return false;
        }

        const key =
            getGuildBirthdaysKey(
                guildId
            );

        const birthdays =
            await getGuildBirthdays(
                client,
                guildId
            );

        if (birthdays[userId]) {
            delete birthdays[userId];

            await client.db.set(
                key,
                birthdays
            );
        }

        return true;

    } catch (error) {
        logger.error(
            `Error deleting birthday for user ${userId} in guild ${guildId}:`,
            error
        );

        return false;
    }
}

export function getMonthName(
    monthNum
) {
    const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];

    const index =
        Math.max(
            0,
            Math.min(
                monthNum - 1,
                11
            )
        );

    return monthNum >= 1 &&
        monthNum <= 12
        ? months[index]
        : 'Invalid Month';
}

function isPostgresSqlReady(
    dbWrapper
) {
    return Boolean(
        dbWrapper?.db?.pool &&
        typeof dbWrapper.db.isAvailable ===
            'function' &&
        dbWrapper.db.isAvailable()
    );
}

async function getEndedGiveawaysFromKv(
    client
) {
    const wrapper =
        client?.db;

    if (
        !wrapper ||
        typeof wrapper.list !==
            'function' ||
        typeof wrapper.get !==
            'function'
    ) {
        return [];
    }

    const keys =
        await wrapper.list(
            'guild:'
        );

    const ended = [];
    const now =
        Date.now();

    for (
        const key of keys
    ) {
        if (
            !key.endsWith(
                ':giveaways'
            )
        ) {
            continue;
        }

        const guildId =
            key.split(':')[1];

        if (!guildId) {
            continue;
        }

        const rawGiveaways =
            await wrapper.get(
                key,
                {}
            );

        const unwrapped =
            unwrapReplitData(
                rawGiveaways
            ) || {};

        const giveaways =
            Array.isArray(
                unwrapped
            )
                ? unwrapped
                : Object.values(
                    unwrapped
                );

        for (
            const giveaway of giveaways
        ) {
            if (
                !giveaway?.messageId ||
                giveaway.ended ||
                giveaway.isEnded
            ) {
                continue;
            }

            const endTime =
                giveaway.endsAt ||
                giveaway.endTime;

            if (
                !endTime ||
                now <
                    Number(endTime)
            ) {
                continue;
            }

            ended.push({
                id:
                    giveaway.id ||
                    giveaway.messageId,

                guild_id:
                    guildId,

                message_id:
                    giveaway.messageId,

                data:
                    giveaway,

                ends_at:
                    new Date(
                        Number(
                            endTime
                        )
                    )
            });
        }
    }

    return ended.sort(
        (a, b) =>
            new Date(a.ends_at) -
            new Date(b.ends_at)
    );
}

export async function getEndedGiveaways(
    client
) {
    try {
        const wrapper =
            client?.db;

        if (
            !wrapper ||
            typeof wrapper.get !==
                'function'
        ) {
            return [];
        }

        if (
            isPostgresSqlReady(
                wrapper
            )
        ) {
            const {
                pgConfig
            } =
                await import(
                    '../config/database/postgres.js'
                );

            const result =
                await wrapper.db.pool.query(
                    `SELECT id, guild_id, message_id, data, ends_at 
                     FROM ${pgConfig.tables.giveaways} 
                     WHERE ends_at <= NOW() 
                     AND COALESCE((data->>'ended')::boolean, false) = false
                     ORDER BY ends_at ASC`
                );

            return result.rows || [];
        }

        return await getEndedGiveawaysFromKv(
            client
        );

    } catch (error) {
        logger.error(
            'Error getting ended giveaways:',
            error
        );

        try {
            return await getEndedGiveawaysFromKv(
                client
            );
        } catch {
            return [];
        }
    }
}

export async function markGiveawayEnded(
    client,
    giveawayId,
    endedData
) {
    try {
        const wrapper =
            client?.db;

        if (
            !wrapper ||
            typeof wrapper.get !==
                'function'
        ) {
            return false;
        }

        if (
            isPostgresSqlReady(
                wrapper
            )
        ) {
            const {
                pgConfig
            } =
                await import(
                    '../config/database/postgres.js'
                );

            await wrapper.db.pool.query(
                `UPDATE ${pgConfig.tables.giveaways} 
                 SET data = $1, updated_at = NOW() 
                 WHERE id = $2`,
                [
                    endedData,
                    giveawayId
                ]
            );

            return true;
        }

        const guildId =
            endedData?.guildId;

        if (
            !guildId ||
            !endedData?.messageId
        ) {
            return false;
        }

        const {
            saveGiveaway
        } =
            await import(
                './giveaways.js'
            );

        return saveGiveaway(
            client,
            guildId,
            endedData
        );

    } catch (error) {
        logger.error(
            'Error marking giveaway as ended:',
            error
        );

        return false;
    }
}

function normalizeWelcomeConfig(
    raw = {}
) {
    const base =
        typeof raw === 'object' &&
        raw !== null
            ? raw
            : {};

    const channelId =
        base.channelId ??
        null;

    const goodbyeChannelId =
        base.goodbyeChannelId ??
        null;

    const welcomeMessage =
        base.welcomeMessage ??
        'Welcome {user} to {server}!';

    const leaveMessage =
        base.leaveMessage ??
        '{user.tag} has left the server.';

    const welcomeEmbed =
        base.welcomeEmbed ?? {
            title:
                '🎉 Welcome!',

            description:
                'Welcome {user} to {server}!',

            color:
                getColor('success'),

            thumbnail:
                true,

            footer:
                'Welcome to {server}!'
        };

    const leaveEmbed =
        base.leaveEmbed ?? {
            title:
                '👋 Goodbye',

            description:
                '{user.tag} has left the server.',

            color:
                getColor('error'),

            thumbnail:
                true,

            footer:
                'Goodbye from {server}!'
        };

    const roleIds =
        Array.isArray(
            base.roleIds
        )
            ? base.roleIds
            : [];

    return {
        ...base,

        enabled:
            Boolean(base.enabled),

        channelId,

        welcomeMessage,

        welcomeEmbed,

        welcomePing:
            Boolean(
                base.welcomePing
            ),

        welcomeImage:
            base.welcomeImage ??
            null,

        goodbyeEnabled:
            Boolean(
                base.goodbyeEnabled
            ),

        goodbyeChannelId,

        leaveMessage,

        leaveEmbed,

        dmMessage:
            base.dmMessage ?? '',

        goodbyePing:
            Boolean(
                base.goodbyePing
            ),

        roleIds,

        autoRoleDelay:
            base.autoRoleDelay ?? 0,

        joinLogs:
            base.joinLogs ?? {
                enabled: false,
                channelId: null
            },

        leaveLogs:
            base.leaveLogs ?? {
                enabled: false,
                channelId: null
            }
    };
}

export async function getWelcomeConfig(
    client,
    guildId
) {
    if (!client.db) {
        logger.warn(
            'Database not available for getWelcomeConfig'
        );

        return normalizeWelcomeConfig();
    }

    const key =
        getWelcomeConfigKey(
            guildId
        );

    try {
        const config =
            await client.db.get(
                key,
                {}
            );

        const unwrapped =
            unwrapReplitData(
                config
            );

        return normalizeWelcomeConfig(
            unwrapped
        );

    } catch (error) {
        logger.error(
            `Error getting welcome config for guild ${guildId}:`,
            error
        );

        return normalizeWelcomeConfig();
    }
}

export async function saveWelcomeConfig(
    client,
    guildId,
    config
) {
    const key =
        getWelcomeConfigKey(
            guildId
        );

    try {
        if (
            !client.db ||
            typeof client.db.set !==
                'function'
        ) {
            logger.error(
                'Database client is not available for saveWelcomeConfig.'
            );

            return false;
        }

        const existingConfig =
            await getWelcomeConfig(
                client,
                guildId
            );

        const mergedConfig = {
            ...existingConfig,
            ...config
        };

        await client.db.set(
            key,
            mergedConfig
        );

        return true;

    } catch (error) {
        logger.error(
            `Error saving welcome config for guild ${guildId}:`,
            error
        );

        return false;
    }
}

export async function updateWelcomeConfig(
    client,
    guildId,
    updates
) {
    try {
        const currentConfig =
            await getWelcomeConfig(
                client,
                guildId
            );

        const updatedConfig = {
            ...currentConfig,
            ...updates
        };

        await saveWelcomeConfig(
            client,
            guildId,
            updatedConfig
        );

        return updatedConfig;

    } catch (error) {
        logger.error(
            `Error updating welcome config for guild ${guildId}:`,
            error
        );

        throw error;
    }
}

export async function getLevelingConfig(
    client,
    guildId
) {
    const key =
        getLevelingKey(
            guildId
        );

    try {
        return await getFromDb(
            key,
            {
                enabled: false,
                xpPerMessage: 10,
                xpPerMinute: 60,
                cooldownEnabled: true,
                messageLengthMultiplier: true,
                levelUpMessages: true,
                levelUpChannel: null,
                roles: {},
                milestones: {}
            }
        );

    } catch (error) {
        logger.error(
            'Error getting leveling config:',
            error
        );

        return {
            enabled: false,
            xpPerMessage: 10,
            xpPerMinute: 60,
            cooldownEnabled: true,
            messageLengthMultiplier: true,
            levelUpMessages: true,
            levelUpChannel: null,
            roles: {},
            milestones: {}
        };
    }
}

export async function saveLevelingConfig(
    client,
    guildId,
    config
) {
    const key =
        getLevelingKey(
            guildId
        );

    try {
        await setInDb(
            key,
            config
        );

        return true;

    } catch (error) {
        logger.error(
            `Error saving leveling config for guild ${guildId}:`,
            error
        );

        return false;
    }
}

export async function getUserLevelData(
    client,
    guildId,
    userId
) {
    const key =
        getUserLevelKey(
            guildId,
            userId
        );

    try {
        const data =
            await getFromDb(
                key,
                null
            );

        if (!data) {
            return {
                xp: 0,
                level: 0,
                totalXp: 0,
                lastMessage: 0,
                rank: 0,
                xpToNextLevel:
                    getXpForLevel(1)
            };
        }

        return {
            xp:
                data.xp || 0,

            level:
                data.level || 0,

            totalXp:
                                data.totalXp || 0,

            lastMessage:
                data.lastMessage || 0,

            rank:
                data.rank || 0,

            xpToNextLevel:
                getXpForLevel(
                    (data.level || 0) + 1
                )
        };

    } catch (error) {

        logger.error(
            `Error getting user level data for ${guildId}/${userId}:`,
            error
        );

        return {
            xp: 0,
            level: 0,
            totalXp: 0,
            lastMessage: 0,
            rank: 0,
            xpToNextLevel:
                getXpForLevel(1)
        };
    }
}
// ============================================================
// APPLICATION DATABASE FUNCTIONS
// ============================================================

const getApplicationRoleSettingsKey = (guildId, roleId) =>
    `guild:${guildId}:applications:role:${roleId}:settings`;

export { getApplicationRoleSettingsKey };

function getClientDb(client) {
    if (client?.db && typeof client.db.get === 'function') {
        return client.db;
    }

    return db;
}

async function ensureDatabase(client) {
    const database = getClientDb(client);

    if (!database.initialized && typeof database.initialize === 'function') {
        await database.initialize();
    }

    return database;
}

// ------------------------------------------------------------
// APPLICATION ROLES
// ------------------------------------------------------------

export async function getApplicationRoles(client, guildId) {
    try {
        const database = await ensureDatabase(client);

        const key = getApplicationRolesKey(guildId);
        const value = await database.get(key, []);
        const roles = unwrapReplitData(value);

        return Array.isArray(roles) ? roles : [];
    } catch (error) {
        logger.error(
            `Error getting application roles for ${guildId}:`,
            error
        );

        return [];
    }
}

export async function saveApplicationRoles(
    client,
    guildId,
    roles
) {
    try {
        const database = await ensureDatabase(client);

        const key = getApplicationRolesKey(guildId);

        await database.set(
            key,
            Array.isArray(roles) ? roles : []
        );

        return true;
    } catch (error) {
        logger.error(
            `Error saving application roles for ${guildId}:`,
            error
        );

        return false;
    }
}

// ------------------------------------------------------------
// ROLE-SPECIFIC SETTINGS
// ------------------------------------------------------------

export async function getApplicationRoleSettings(
    client,
    guildId,
    roleId
) {
    try {
        const database = await ensureDatabase(client);

        const key =
            getApplicationRoleSettingsKey(
                guildId,
                roleId
            );

        const value =
            await database.get(
                key,
                null
            );

        return unwrapReplitData(value) || {
            questions:
                getDefaultApplicationQuestions()
        };
    } catch (error) {
        logger.error(
            `Error getting application role settings for ${guildId}/${roleId}:`,
            error
        );

        return {
            questions:
                getDefaultApplicationQuestions()
        };
    }
}

export async function saveApplicationRoleSettings(
    client,
    guildId,
    roleId,
    settings
) {
    try {
        const database =
            await ensureDatabase(client);

        const key =
            getApplicationRoleSettingsKey(
                guildId,
                roleId
            );

        const current =
            await getApplicationRoleSettings(
                client,
                guildId,
                roleId
            );

        const merged = {
            ...current,
            ...(settings || {})
        };

        await database.set(
            key,
            merged
        );

        return true;
    } catch (error) {
        logger.error(
            `Error saving application role settings for ${guildId}/${roleId}:`,
            error
        );

        return false;
    }
}

// ------------------------------------------------------------
// APPLICATION SETTINGS
// ------------------------------------------------------------

function defaultApplicationSettings() {
    return {
        enabled: false,
        applicationChannelId: null,
        logChannelId: null,
        questions:
            getDefaultApplicationQuestions(),
        managerRoles: [],
        roles: {
            admin: null,
            reviewer: null,
            accepted: null,
            denied: null
        },
        requiredRoles: [],
        deniedRoles: [],
        minAccountAge: 0,
        maxApplications: 1,
        cooldown:
            BotConfig.applications?.applicationCooldown ??
            24,
        allowMultipleApplications: false,
        requireVerification: false,
        customWelcomeMessage: '',
        pendingApplicationRetentionDays: 30,
        reviewedApplicationRetentionDays:
            BotConfig.applications?.deleteApprovedAfter ??
            30
    };
}

export async function getApplicationSettings(
    client,
    guildId
) {
    try {
        const database =
            await ensureDatabase(client);

        const key =
            getApplicationSettingsKey(
                guildId
            );

        const value =
            await database.get(
                key,
                defaultApplicationSettings()
            );

        return {
            ...defaultApplicationSettings(),
            ...(unwrapReplitData(value) || {})
        };
    } catch (error) {
        logger.error(
            `Error getting application settings for ${guildId}:`,
            error
        );

        return defaultApplicationSettings();
    }
}

export async function saveApplicationSettings(
    client,
    guildId,
    settings
) {
    try {
        const database =
            await ensureDatabase(client);

        const current =
            await getApplicationSettings(
                client,
                guildId
            );

        const merged = {
            ...current,
            ...(settings || {})
        };

        await database.set(
            getApplicationSettingsKey(guildId),
            merged
        );

        return true;
    } catch (error) {
        logger.error(
            `Error saving application settings for ${guildId}:`,
            error
        );

        return false;
    }
}

// ------------------------------------------------------------
// APPLICATIONS
// ------------------------------------------------------------

function makeApplicationId() {
    return (
        `${Date.now().toString(36)}-` +
        `${Math.random().toString(36).slice(2, 10)}`
    );
}

export async function getApplication(
    client,
    guildId,
    applicationId
) {
    try {
        const database =
            await ensureDatabase(client);

        const key =
            getApplicationKey(
                guildId,
                applicationId
            );

        const value =
            await database.get(
                key,
                null
            );

        return unwrapReplitData(value);
    } catch (error) {
        logger.error(
            `Error getting application ${applicationId}:`,
            error
        );

        return null;
    }
}

export async function createApplication(
    client,
    data
) {
    const database =
        await ensureDatabase(client);

    const application = {
        id:
            data.id ||
            makeApplicationId(),

        guildId:
            String(data.guildId),

        userId:
            String(data.userId),

        roleId:
            String(data.roleId),

        roleName:
            data.roleName ||
            null,

        answers:
            Array.isArray(data.answers)
                ? data.answers
                : [],

        status:
            'pending',

        createdAt:
            data.createdAt ||
            new Date().toISOString(),

        reviewer:
            null,

        reviewMessage:
            null,

        reviewedAt:
            null
    };

    await database.set(
        getApplicationKey(
            data.guildId,
            application.id
        ),
        application
    );

    const userKey =
        getUserApplicationsKey(
            data.guildId,
            data.userId
        );

    const current =
        await database.get(
            userKey,
            []
        );

    const userApplications =
        Array.isArray(current)
            ? current
            : [];

    userApplications.push(
        application
    );

    await database.set(
        userKey,
        userApplications
    );

    return application;
}

export async function updateApplication(
    client,
    guildId,
    applicationId,
    updates
) {
    const database =
        await ensureDatabase(client);

    const current =
        await getApplication(
            client,
            guildId,
            applicationId
        );

    if (!current) {
        return null;
    }

    const updated = {
        ...current,
        ...(updates || {}),
        id:
            current.id,
        guildId:
            current.guildId ||
            String(guildId)
    };

    await database.set(
        getApplicationKey(
            guildId,
            applicationId
        ),
        updated
    );

    if (updated.userId) {
        const userKey =
            getUserApplicationsKey(
                guildId,
                updated.userId
            );

        const list =
            await database.get(
                userKey,
                []
            );

        const applications =
            Array.isArray(list)
                ? list
                : [];

        const index =
            applications.findIndex(
                item =>
                    String(item.id) ===
                    String(applicationId)
            );

        if (index >= 0) {
            applications[index] =
                updated;
        } else {
            applications.push(updated);
        }

        await database.set(
            userKey,
            applications
        );
    }

    return updated;
}

export async function getUserApplications(
    client,
    guildId,
    userId
) {
    try {
        const database =
            await ensureDatabase(client);

        const key =
            getUserApplicationsKey(
                guildId,
                userId
            );

        const value =
            await database.get(
                key,
                []
            );

        const applications =
            unwrapReplitData(value);

        return Array.isArray(applications)
            ? applications
            : [];
    } catch (error) {
        logger.error(
            `Error getting applications for user ${userId}:`,
            error
        );

        return [];
    }
}

export async function getApplications(
    client,
    guildId,
    filters = {}
) {
    try {
        const database =
            await ensureDatabase(client);

        const prefix =
            getApplicationsPrefix(
                guildId
            );

        const keys =
            await database.list(
                prefix
            );

        const applications = [];

        for (const key of keys) {
            if (
                key.endsWith(':roles') ||
                key.endsWith(':settings') ||
                key.includes(':users:')
            ) {
                continue;
            }

            const value =
                await database.get(
                    key,
                    null
                );

            const application =
                unwrapReplitData(value);

            if (!application) {
                continue;
            }

            if (
                filters.status &&
                application.status !==
                    filters.status
            ) {
                continue;
            }

            if (
                filters.userId &&
                String(application.userId) !==
                    String(filters.userId)
            ) {
                continue;
            }

            if (
                filters.roleId &&
                String(application.roleId) !==
                    String(filters.roleId)
            ) {
                continue;
            }

            applications.push(
                application
            );
        }

        applications.sort(
            (a, b) =>
                new Date(b.createdAt || 0) -
                new Date(a.createdAt || 0)
        );

        return applications;
    } catch (error) {
        logger.error(
            `Error getting applications for ${guildId}:`,
            error
        );

        return [];
    }
                }
