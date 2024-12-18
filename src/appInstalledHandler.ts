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
    // await context.scheduler.runJob({ cron: CHECK_CRON, name: COMMENT_WATCHER });
    // log.info(`Setting up ${POST_WATCHER}`);
    // await context.scheduler.runJob({ cron: CHECK_CRON, name: POST_WATCHER });
    // log.info(`Setting up ${RESPONSE_WATCHER}`);
    // await context.scheduler.runJob({ cron: CHECK_CRON, name: RESPONSE_WATCHER });
}
