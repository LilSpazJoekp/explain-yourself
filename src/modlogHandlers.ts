import {
    Context,
    Post,
    Subreddit,
    TriggerContext,
    TriggerEventType,
} from "@devvit/public-api";
import { PostCategory } from "./_types.js";
import { WATCHED_MODLOG_ACTIONS } from "./consts.js";
import { PrefixLogger } from "./logger.js";
import { PostData } from "./postData.js";
import { resolveSettings } from "./utils.js";

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
        case "approvecomment":
            await handleApprove(event, context);
            break;
        case "approvelink":
            await handleApprove(event, context);
            break;
        case "removecomment":
            await handleRemove(event, context);
            break;
        case "removelink":
            await handleRemove(event, context);
            break;
        case "spamcomment":
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
 *     Only `approvecomment`, `approvelink`, `removecomment`, `removelink`, `spamcomment`, and `spamlink` are supported.
 *     @param context - The Context object.
 *     @returns The PostData object if found.
 */
async function resolvePostData(
    event: TriggerEventType["ModAction"],
    context: Context | TriggerContext,
): Promise<PostData | undefined> {
    const { reddit } = context;
    const log = logger.injectArgs(
        event.action,
        event.moderator?.name,
        event.action?.includes("link") ? event.targetPost?.id : event.targetComment?.id,
    );
    let postId: string;
    let targetId: string;
    if (event.action?.includes("link")) {
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
    const postData = await resolvePostData(event, context);
    const subreddit: Subreddit = await context.reddit.getCurrentSubreddit();
    if (postData === undefined) {
        return;
    }
    const log = logger.injectArgs(
        event.action,
        event.moderator?.name,
        event.action?.includes("link") ? event.targetPost?.id : event.targetComment?.id,
    );
    const { allowExplanation, explanationPendingComment } = await resolveSettings(
        context.settings,
        "allowExplanation",
        "explanationPendingComment",
    );
    if (await postData.inCategory(PostCategory.Safe)) {
        log.info("Post already marked as safe");
        return;
    }
    const authorName = postData.author
    if ((
        await subreddit.getModerators({username: authorName}).all()
    ).length > 0) {
        log.info("Author is a moderator, marking safe");
        await postData.markApproved();
        return;
    }
    if (await postData.isPendingResponse()) {
        if (postData.sentModmailId === "") {
            const post = await context.reddit.getPostById(postData.postId);
            if (await postData.inCategory(PostCategory.Filtered)) {
                postData.createdAt = new Date().valueOf();
            }
            await postData.initializePostSession(
                explanationPendingComment,
                allowExplanation,
                post,
            );
        } else {
            await postData.setCategory(PostCategory.PendingResponse);
        }
        return;
    }
    await postData.markApproved();
    log.info("Marked Safe");
}

async function handleRemove(
    event: TriggerEventType["ModAction"],
    context: TriggerContext,
): Promise<void> {
    const isComment = event.action?.includes("comment");
    const postData = await resolvePostData(event, context);
    if (postData === undefined) {
        return;
    }
    const log = logger.injectArgs(
        event.action,
        event.moderator?.name,
        event.action?.includes("link") ? event.targetPost?.id : event.targetComment?.id,
    );
    if (await postData.inCategory(PostCategory.Filtered)) {
        log.info("Post already marked filtered");
        return;
    }
    if (
        isComment &&
        event.targetComment?.author == (await context.reddit.getAppUser()).id
    ) {
        log.info("Bot comment was removed. Marking post safe.");
        await postData.markSafe();
        return;
    }
    await postData.markRemoved();
    log.info("Marked Removed");
}

export async function handleFilter(
    event: TriggerEventType["AutomoderatorFilterPost"],
    context: TriggerContext,
): Promise<void> {
    if (event.post === undefined) {
        logger.error("No post found for Automoderator filter event");
        return;
    }
    const post: Post = await context.reddit.getPostById(event.post.id);
    const postData = await PostData.fromPost(context, post);
    if (postData === undefined) {
        return;
    }
    const log = logger.injectArgs("Automod Filtered", "AutoModerator", post);
    await postData.markFiltered();
    log.info("Marked Filtered");
}
