import { TriggerContext, TriggerEventType } from "@devvit/public-api";
import { parse } from "node-html-parser";
import { CommentType, PostCategory, ResponseType } from "./_types.js";
import { URL_REGEX } from "./consts.js";
import { PrefixLogger } from "./logger.js";
import { PostData } from "./postData.js";
import { humanDuration, resolveSettings } from "./utils.js";

const logger = new PrefixLogger(
    "Message Handler | u/%s | conversationId: %s | messageId: %s",
);

export async function handleMessage(
    event: TriggerEventType["ModMail"],
    context: TriggerContext,
) {
    if (
        event.messageId === undefined ||
        event.conversationId === undefined ||
        event.messageAuthor === undefined
    ) {
        return;
    }
    const conversationId = event.conversationId.split("_")[1];
    const messageId = event.messageId.split("_")[1];
    const { reddit, settings } = context;
    if (event.messageAuthor.name == (await reddit.getAppUser()).username) {
        return;
    }
    const log = logger.injectArgs(event.messageAuthor.name, conversationId, messageId);
    const postData = await PostData.getPostDataByConversationId(
        context,
        conversationId,
    );
    if (event.messageAuthor.name !== postData?.author) {
        log.info(
            "Post data author (%s) does not match message author (%s), ignoring",
            postData?.author,
            event.messageAuthor.name,
        );
        return;
    }
    if (postData === undefined) {
        log.error("No post data found for message");
        return;
    }
    if (postData.responseMessageId !== "") {
        log.info(
            "Post already has a response message (%s), ignoring",
            postData.responseMessageId,
        );
        await postData.respond({ responseType: ResponseType.AlreadyAccepted });
        return;
    }
    const post = await reddit.getPostById(postData.postId);
    postData.post = post;
    const { conversation } = await reddit.modMail.getConversation({
        conversationId,
    });
    const messages = conversation?.messages || {};
    const message = messages[messageId];
    if (message === undefined) {
        log.error("No message found");
        await postData.respond({ responseType: ResponseType.Error });
        return;
    }
    const { body: bodyHtml, bodyMarkdown: body } = message;
    if (body === undefined || bodyHtml === undefined) {
        log.error("No body found");
        await postData.respond({ responseType: ResponseType.Error });
        return;
    }
    const {
        blockUrlsInExplanation,
        lateReplyDuration,
        messageRequiredLength,
        replyDuration,
        requireUrlInExplanation,
    } = await resolveSettings(
        settings,
        "blockUrlsInExplanation",
        "lateReplyDuration",
        "messageRequiredLength",
        "replyDuration",
        "requireUrlInExplanation",
    );
    const now = new Date().valueOf();
    const lateReply = replyDuration > 0 && postData.olderThan(replyDuration, now);
    const tooLateReply =
        lateReplyDuration > 0 && postData.olderThan(lateReplyDuration, now);
    const status = lateReply ? (tooLateReply ? "too late" : "late") : "on-time";
    log.info("Received %s reply (%s): %s", status, postData.humanAge(), body);
    if (tooLateReply) {
        log.info(
            "Reply too late (%s > %s)",
            postData.humanAge(),
            humanDuration(lateReplyDuration),
        );
        await postData.respond({ responseType: ResponseType.TooLate });
        return;
    }
    if (lateReply) {
        log.info(
            "Reply late (%s > %s)",
            postData.humanAge(),
            humanDuration(replyDuration),
        );
    }
    const parsedHtml = parse(bodyHtml);
    if (parsedHtml === undefined) {
        log.error("Failed to parse HTML");
        await postData.respond({ responseType: ResponseType.Error });
        return;
    }
    const aTags = parsedHtml.querySelectorAll("a");
    if (blockUrlsInExplanation && (aTags.length > 0 || body.match(URL_REGEX))) {
        log.info("Author included one or more URLs, rejecting message");
        await postData.respond({ responseType: ResponseType.Invalid });
        return;
    }
    if (requireUrlInExplanation && aTags.length === 0 && !body.match(URL_REGEX)) {
        log.info("Author did not include a URL, rejecting message");
        await postData.respond({ responseType: ResponseType.Invalid });
        return;
    }
    const cleanedReply = parsedHtml.text.replace(/\W/g, "");
    if (cleanedReply.length >= messageRequiredLength) {
        if (await postData.isPendingResponse()) {
            log.info("Reply accepted");
            const comment = await postData.commentReply(CommentType.Accepted, body);
            if (comment === undefined) {
                log.error("Failed to comment");
                await postData.respond({ responseType: ResponseType.Error });
                return;
            }
            await postData.respond({ responseType: ResponseType.Accepted });
            postData.responseMessageId = messageId;
            await postData.writeToRedis();
            if (await postData.inCategory(PostCategory.NoResponse)) {
                await reddit.approve(post.id);
            }
            await postData.setCategory(PostCategory.Active);
        } else {
            log.error(
                `Post not in pending response category or in no response category and eligible for response`,
            );
            await postData.respond({ responseType: ResponseType.Ineligible });
        }
    } else {
        log.info(
            "Reply too short (%s < %s)",
            cleanedReply.length.toString(),
            messageRequiredLength.toString(),
        );
        await postData.respond({
            replyLength: cleanedReply.length,
            responseType: ResponseType.TooShort,
        });
    }
    await reddit.modMail.archiveConversation(conversationId);
}
