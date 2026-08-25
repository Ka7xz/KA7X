export async function handleApplicationModal(
    interaction
) {
    if (!interaction.isModalSubmit()) {
        return;
    }

    if (
        !interaction.customId.startsWith(
            'app_modal_'
        )
    ) {
        return;
    }

    /*
     * Custom IDs:
     *
     * app_modal_1_ROLE_ID
     * app_modal_2_ROLE_ID
     */

    const parts =
        interaction.customId.split('_');

    const page = parts[2];

    const roleId =
        parts.slice(3).join('_');

    const applicationRoles =
        await getApplicationRoles(
            interaction.client,
            interaction.guild.id
        );

    // FIX:
    // Compare role IDs as strings so the lookup works
    // whether the database returns the ID as a string
    // or another value type.
    const applicationRole =
        applicationRoles.find(
            app =>
                String(app.roleId) ===
                String(roleId)
        );

    if (!applicationRole) {
        return replyUserError(interaction, {
            type: ErrorTypes.CONFIGURATION,
            message:
                'Application configuration was not found.'
        });
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
            roleId
        );

    const questions =
        getQuestions(
            settings,
            roleSettings
        );


    // ========================================================
    // PAGE 1 — QUESTIONS 1-5
    // ========================================================

    if (page === '1') {
        const answers = [];

        for (let i = 0; i < 5; i++) {
            const answer =
                interaction.fields.getTextInputValue(
                    `q${i}`
                ) || '';

            answers.push({
                question: questions[i],
                answer: answer.trim()
            });
        }

        // Q1 required
        if (!answers[0].answer) {
            return replyUserError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message:
                    'Question 1 is required.'
            });
        }

        const key =
            `${interaction.guild.id}:${interaction.user.id}:${roleId}`;

        pendingApplications.set(
            key,
            {
                guildId:
                    interaction.guild.id,

                userId:
                    interaction.user.id,

                roleId,

                roleName:
                    applicationRole.name,

                username:
                    interaction.user.tag,

                avatar:
                    interaction.user.displayAvatarURL(),

                answers,

                createdAt:
                    Date.now()
            }
        );

        // Open Q6-Q10
        const secondModal =
            createApplicationModal(
                roleId,
                applicationRole.name,
                questions,
                5,
                10,
                2
            );

        return interaction.showModal(
            secondModal
        );
    }


    // ========================================================
    // PAGE 2 — QUESTIONS 6-10
    // ========================================================

    if (page === '2') {
        const key =
            `${interaction.guild.id}:${interaction.user.id}:${roleId}`;

        const pending =
            pendingApplications.get(key);

        if (!pending) {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Your application session expired. Please click Apply again.'
            });
        }

        const answers = [
            ...pending.answers
        ];

        // Q6-Q10
        for (let i = 5; i < 10; i++) {
            const answer =
                interaction.fields.getTextInputValue(
                    `q${i}`
                ) || '';

            answers.push({
                question: questions[i],
                answer: answer.trim()
            });
        }

        try {
            const application =
                await ApplicationService.submitApplication(
                    interaction.client,
                    {
                        guildId:
                            pending.guildId,

                        userId:
                            pending.userId,

                        roleId:
                            pending.roleId,

                        roleName:
                            pending.roleName,

                        username:
                            pending.username,

                        avatar:
                            pending.avatar,

                        answers
                    }
                );

            pendingApplications.delete(key);

            const embed =
                successEmbed(
                    'Application Submitted',
                    `Your application for **${pending.roleName}** has been submitted successfully!\n\n` +
                    `**Application ID:** \`${application.id}\`\n` +
                    `**Status:** 🟡 In Progress`
                );

            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error(
                'Application submission failed',
                {
                    error: error.message,
                    guildId:
                        interaction.guild.id,
                    userId:
                        interaction.user.id,
                    roleId,
                    stack:
                        error.stack
                }
            );

            pendingApplications.delete(key);

            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message:
                    'Something went wrong while submitting your application.'
            });
        }
    }
}
