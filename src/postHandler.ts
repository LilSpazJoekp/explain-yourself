import { EventSource } from "@devvit/protos/types/devvit/events/v1alpha/events.js";
import { TriggerContext, TriggerEventType } from "@devvit/public-api";
import { CommentType, PostCategory } from "./_types.js";
import { PrefixLogger } from "./logger.js";
import { PostData } from "./postData.js";
import { resolveSettings } from "./utils.js";

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
    log.info("Handling post");
    const { exclusionRegex, exclusionTypes } = await resolveSettings(
        settings,
        "exclusionRegex",
        "exclusionTypes",
    );
    if (exclusionRegex) {
        const regex = new RegExp(exclusionRegex);
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

    const postData = await PostData.fromPost(context, post);

    const { allowExplanation, lockComment, explanationPendingComment } =
        await resolveSettings(
            settings,
            "allowExplanation",
            "explanationPendingComment",
            "lockComment",
        );
    if (explanationPendingComment) {
        const comment = await postData.commentReply(CommentType.Pending);
        if (comment === undefined) {
            log.error("Failed to comment");
            return;
        }
        if (lockComment) {
            await comment.lock();
        }
    }
    if (allowExplanation) {
        await postData.sendMessage(post);
        await postData.savePost(PostCategory.PendingResponse);
    } else {
        await postData.savePost(PostCategory.Active);
    }
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
        await postData.setCategory(PostCategory.Deleted);
    } else {
        log.info("Ignoring non-user deletion");
    }
}
