import { TriggerContext, TriggerEventType } from "@devvit/public-api";
import { CHECK_CRON, JOB_WATCHER } from "./consts.js";
import { PrefixLogger } from "./logger.js";

const logger = new PrefixLogger("%s Handler");

export async function appInstalledHandler(
    event: TriggerEventType["AppInstall" | "AppUpgrade"],
    context: TriggerContext,
) {
    const log = logger.injectArgs(event.type);
    let jobs = await context.scheduler.listJobs();
    const pendingResponseComment = (await context.settings.get(
        "explanationPendingComment",
    )) as string;
    if (!pendingResponseComment || pendingResponseComment.trim() === "") {
        await context.reddit.modMail.createModInboxConversation({
            subredditId: context.subredditId,
            subject: "Explain Yourself setup",
            bodyMarkdown: `Hello!\n\nI'm writing to let you know that 'Pending Explanation Comment' is now a required configuration setting. Please set it [here](https://developers.reddit.com/r/${context.subredditName}/apps/${context.appName}) for the bot to function correctly.\n\nThanks!`,
        });
    }
    while (jobs.length > 0) {
        await Promise.all(
            jobs.map(async (job) => {
                log.info("Cancelling job %s", job.name);
                await context.scheduler.cancelJob(job.id);
                jobs = await context.scheduler.listJobs();
            }),
        );
    }
    log.info("All jobs cancelled");
    log.info(`Setting up ${JOB_WATCHER}`);
    await context.scheduler.runJob({ cron: CHECK_CRON, name: JOB_WATCHER });
}
