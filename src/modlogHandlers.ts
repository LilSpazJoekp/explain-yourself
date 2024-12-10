import { Context, TriggerContext, TriggerEventType } from "@devvit/public-api";
import { WATCHED_MODLOG_ACTIONS } from "./consts.js";
import { PrefixLogger } from "./logger.js";
import { PostData } from "./postData.js";

const logger = new PrefixLogger(
    "ModLog Handler | action: %s | Mod: u/%s | targetId: %s",
);

export async function modActionHandler(
    event: TriggerEventType["ModAction"],
    context: TriggerContext,
): Promise<void> {
    if (
        event.moderator &&
        event.moderator.name == (await context.reddit.getAppUser()).username
    )
        return;
    if (!(event.action && WATCHED_MODLOG_ACTIONS.includes(event.action))) {
        return;
    }
    switch (event.action) {
        case "approvelink":
            await handleApprove(event, context);
            break;
        case "removecomment":
            await handleRemove(event, context);
            break;
        case "removelink":
            await handleRemove(event, context);
            break;
        case "spamlink":
            await handleRemove(event, context);
            break;
        default:
            return;
    }
}

/**
 *     Resolve the PostData object from the event data
 *     @param event - The ModAction event.
 *     Only `approvelink`, `removecomment`, `removelink`, and `spamlink` are supported.
 *     @param context - The Context object.
 *     @param validActions - The valid actions to resolve PostData for. First action must be a post related action.
 *     Only `approvelink`, `removecomment`, `removelink`, and `spamlink` are supported.
 *     @returns The PostData object if found.
 */
async function resolvePostData(
    event: TriggerEventType["ModAction"],
    context: Context | TriggerContext,
    validActions: string[],
): Promise<PostData | undefined> {
    const { reddit } = context;
    const log = logger.injectArgs(
        event.action,
        event.moderator?.name,
        event.action?.includes("link") ? event.targetPost?.id : event.targetComment?.id,
    );
    let postId: string;
    let targetId: string;
    if (event.action === validActions[0]) {
        if (event.targetPost === undefined) {
            log.error("No target post found for link related action");
            return;
        }
        targetId = event.targetPost.id;
        postId = targetId;
    } else {
        if (event.targetComment === undefined) {
            log.error(
                "No target comment found for comment related action. This shouldn't be possible.",
            );
            return;
        }
        if (event.targetComment.author !== (await reddit.getAppUser()).id) {
            log.info("Not a bot comment", event.targetComment.author);
            return;
        }
        targetId = event.targetComment.id;
        postId = (await reddit.getCommentById(targetId)).postId;
    }
    log.info(`Handling ${event.action}`);
    return await PostData.fromPostId(context, postId);
}

async function handleApprove(
    event: TriggerEventType["ModAction"],
    context: TriggerContext,
): Promise<void> {
    const postData = await resolvePostData(event, context, ["approvelink"]);
    if (postData === undefined) {
        return;
    }
    const log = logger.injectArgs(
        event.action,
        event.moderator?.name,
        event.action?.includes("link") ? event.targetPost?.id : event.targetComment?.id,
    );
    await postData.markSafe();
    log.info("Marked Safe");
}

async function handleRemove(
    event: TriggerEventType["ModAction"],
    context: TriggerContext,
): Promise<void> {
    const postData = await resolvePostData(event, context, [
        "removelink",
        "removecomment",
    ]);
    if (postData === undefined) {
        return;
    }
    const log = logger.injectArgs(
        event.action,
        event.moderator?.name,
        event.action?.includes("link") ? event.targetPost?.id : event.targetComment?.id,
    );
    await postData.markRemoved();
    log.info("Marked Removed");
}
