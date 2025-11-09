import { Context, TriggerContext, TriggerEventType } from "@devvit/public-api";
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
    const log = logger.injectArgs(
        event.action,
        event.moderator?.name,
        event.action?.includes("link") ? event.targetPost?.id : event.targetComment?.id,
    );
    if (event.targetPost === undefined) {
        log.error("No target post found for approve action");
        return;
    }
    let postData = await resolvePostData(event, context);
    const filteredPosts = await context.redis.zScan(
        "posts:filtered",
        0,
        event.targetPost?.id,
    );
    if (postData === undefined && filteredPosts.members.length === 0) {
        // If no PostData, check if in filtered set to see if we need to reprocess it
        log.info("No post data found for post");
        return;
    }
    const {
        exclusionRegex,
        exclusionTypes,
        postFlairIds,
        postFlairListType,
        allowExplanation,
        explanationPendingComment,
        ignoreModerators,
    } = await resolveSettings(
        context.settings,
        "exclusionRegex",
        "exclusionTypes",
        "postFlairIds",
        "postFlairListType",
        "allowExplanation",
        "explanationPendingComment",
        "ignoreModerators",
    );
    let post;
    if (event.targetPost.id) {
        post = await context.reddit.getPostById(event.targetPost.id);
    } else {
        if (event.targetComment === undefined) {
            log.error("No target comment found for approve action");
            return;
        }
        post = await context.reddit.getPostById(
            (await context.reddit.getCommentById(event.targetComment.id)).parentId,
        );
    }
    if (postData === undefined) {
        // If no PostData, but in filtered set, rebuild it
        postData = await PostData.fromPost(context, post);
    }
    if (await postData.inCategory(PostCategory.Safe)) {
        log.info("Post already marked as safe");
        return;
    }
    if (filteredPosts.members.length > 0) {
        log.info("Post was in filtered set, reprocessing");
        if (exclusionRegex) {
            const regex = new RegExp(exclusionRegex, "i");
            const toCheck = [];
            if (exclusionTypes) {
                if (exclusionTypes.includes("title")) {
                    toCheck.push(post.title);
                }
                if (exclusionTypes.includes("body")) {
                    toCheck.push(post.body || "");
                }
            }
            if (toCheck.some((text) => regex.test(text))) {
                log.info("Post excluded by regex");
                return;
            }
        }

        if (postFlairIds) {
            const flairIds = postFlairIds.split("\n");
            const postFlairExclusion: boolean = postFlairListType[0] === "exclusion";
            const postFlairId = post.flair?.templateId || "";
            if (postFlairExclusion) {
                if (flairIds.includes(postFlairId)) {
                    log.info("Post excluded by flair");
                    return;
                }
            } else {
                if (!flairIds.includes(postFlairId)) {
                    log.info("Post does not have the required flair");
                    return;
                }
            }
        }

        if (ignoreModerators) {
            const authorName = post.authorName || "";
            const subreddit = await context.reddit.getCurrentSubreddit();
            if (
                (await subreddit.getModerators({ username: authorName }).all()).length >
                0
            ) {
                log.info("Post author is a moderator, ignoring");
                await postData.markApproved();
                log.info("Marked Safe");
                return;
            }
        }
    }
    if (await postData.isPendingResponse()) {
        postData.createdAt = new Date().valueOf();
        await postData.writeToRedis()
        if (postData.sentModmailId === "") {
            const post = await context.reddit.getPostById(postData.postId);
            await postData.initializePostSession(
                explanationPendingComment,
                allowExplanation,
                post,
                ignoreModerators,
            );
        } else if (postData.responseMessageId) {
            await postData.markApproved();
            log.info("Marked Safe");
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
    await context.redis.zAdd(`posts:filtered`, {
        member: event.post.id,
        score: event.post.createdAt,
    });
    const log = logger.injectArgs("Automod Filtered", "AutoModerator", event.post.id);
    log.info("Marked Filtered");
}
