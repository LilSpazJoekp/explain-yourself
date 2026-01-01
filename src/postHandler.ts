import { EventSource } from "@devvit/protos/types/devvit/events/v1alpha/events.js";
import { TriggerContext, TriggerEventType } from "@devvit/public-api";
import { PostCategory } from "./_types.js";
import { PrefixLogger } from "./logger.js";
import { PostData } from "./postData.js";
import { checkFlair, checkRegex, resolveSettings } from "./utils.js";

const logger = new PrefixLogger("Post Handler | %s | u/%s | postId: %s | title: %s");

export async function handlePost(
    event: TriggerEventType["PostCreate"],
    context: TriggerContext,
) {
    if (event.post === undefined || event.post.id === undefined) {
        return;
    }
    const { reddit, settings } = context;
    const post = await reddit.getPostById(event.post.id);
    const log = logger.injectArgs(
        event.type,
        <string>event.author?.name,
        post.id,
        event.post.title,
    );
    const {
        exclusionRegex,
        exclusionTypes,
        postFlairIds,
        postFlairListType,
        allowExplanation,
        explanationPendingComment,
        ignoreModerators,
        ignoreFilteredPosts,
    } = await resolveSettings(
        settings,
        "exclusionRegex",
        "exclusionTypes",
        "postFlairIds",
        "postFlairListType",
        "allowExplanation",
        "explanationPendingComment",
        "ignoreModerators",
        "ignoreFilteredPosts",
    );
    if (checkRegex(exclusionRegex, exclusionTypes, post, log)) return;

    if (checkFlair(postFlairIds, postFlairListType, post, log)) return;

    if (ignoreModerators) {
        const authorName = event.author?.name || "";
        const subreddit = await reddit.getCurrentSubreddit();
        if (
            (await subreddit.getModerators({ username: authorName }).all()).length > 0
        ) {
            log.info("Post author is a moderator, ignoring");
            return;
        }
    }
    if (await PostData.exists(context, post.id)) {
        log.info("Post already processed");
        return;
    }
    const postData = await PostData.fromPost(context, post);
    if ((await postData.inCategory(PostCategory.Filtered)) && ignoreFilteredPosts) {
        log.info("Post is filtered and ignoring filtered posts is enabled, ignoring");
        return;
    }
    await postData.initializePostSession(
        explanationPendingComment,
        allowExplanation,
        post,
        ignoreModerators,
    );
}

export async function handleDeletion(
    event: TriggerEventType["PostDelete"],
    context: TriggerContext,
) {
    const { reddit } = context;
    const post = await reddit.getPostById(event.postId);
    const log = logger.injectArgs(
        event.type,
        <string>event.author?.name,
        event.postId,
        post.title,
    );
    if (event.source == EventSource.USER) {
        log.info("Handling deletion");
        const postData = await PostData.fromPost(context, post);
        await postData.markDeleted();
    } else {
        log.info("Ignoring non-user deletion");
    }
}
