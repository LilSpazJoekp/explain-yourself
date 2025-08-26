import { Comment, Context, JobContext, Post, TriggerContext } from "@devvit/public-api";
import { CommentType, PlaceholderField, PostCategory, ResponseType } from "./_types.js";
import { PrivateNote } from "./consts.js";
import { PrefixLogger } from "./logger.js";
import {
    humanDuration,
    resolveSetting,
    resolveSettings,
    withRetries,
} from "./utils.js";

interface AcceptedRespondParams {
    responseType: ResponseType.Accepted;
}

interface AlreadyAcceptedRespondParams {
    responseType: ResponseType.AlreadyAccepted;
}

interface ErrorRespondParams {
    responseType: ResponseType.Error;
}

interface IneligibleRespondParams {
    responseType: ResponseType.Ineligible;
}

interface InvalidRespondParams {
    responseType: ResponseType.Invalid;
}

interface TooLateRespondParams {
    responseType: ResponseType.TooLate;
}

interface TooShortRespondParams {
    replyLength: number;
    responseType: ResponseType.TooShort;
}

type RespondType =
    | AcceptedRespondParams
    | AlreadyAcceptedRespondParams
    | ErrorRespondParams
    | IneligibleRespondParams
    | InvalidRespondParams
    | TooLateRespondParams
    | TooShortRespondParams;

export class PostData {
    author: string;
    comment: Comment | null;
    commentId: string;
    context: Context | JobContext | TriggerContext;
    createdAt: number;
    deleted: boolean;
    filtered: boolean;
    log: PrefixLogger = new PrefixLogger("PostData | postId: %s");
    post: Post | null;
    postId: string;
    removed: boolean;
    responseMessageId: string;
    safe: boolean;
    sentModmailId: string;

    constructor(context: Context | JobContext | TriggerContext) {
        this.author = "";
        this.comment = null;
        this.commentId = "";
        this.context = context;
        this.createdAt = 0;
        this.deleted = false;
        this.filtered = false;
        this.post = null;
        this.postId = "";
        this.removed = false;
        this.responseMessageId = "";
        this.safe = false;
        this.sentModmailId = "";
    }

    static async fetchFromCategory(
        category: PostCategory,
        context: Context | JobContext | TriggerContext,
        fetchComments: boolean = false,
        fetchPosts: boolean = false,
    ): Promise<PostData[]> {
        const { redis } = context;
        const results = await redis.zScan(`posts:${category}`, 0);
        if ((await context.settings.get("debugMode")) === "true") {
            console.log(category, results);
        }
        return (
            await Promise.resolve(
                Promise.all(
                    results.members.map(async (item) => {
                        const postData = await PostData.fromPostId(
                            context,
                            item.member,
                        );
                        if (fetchPosts) {
                            await postData?.resolvePost();
                        }
                        if (fetchComments) {
                            await postData?.resolveComment();
                        }
                        return postData;
                    }),
                ),
            )
        ).filter((item) => item !== undefined) as PostData[];
    }

    static async fromPost(
        context: Context | TriggerContext,
        post: Post,
    ): Promise<PostData> {
        const postData = new PostData(context);
        postData.author = (await post.getAuthor())?.username || "";
        postData.createdAt = post.createdAt.valueOf();
        postData.postId = post.id;
        postData.removed = post.removed;
        postData.post = post;
        postData.log._debugMode = (await context.settings.get("debugMode")) === "true";
        return postData;
    }

    static async fromPostId(
        context: Context | TriggerContext,
        postId: string,
    ): Promise<PostData | undefined> {
        const { redis } = context;
        const data: Record<keyof PostData, string> = await redis.hGetAll(postId);
        if (Object.keys(data).length === 0) {
            return undefined;
        }
        const postData = new PostData(context);
        const keys = Object.keys(data) as (keyof PostData)[];
        keys.forEach((key: keyof PostData) => {
            if (
                key == "deleted" ||
                key === "filtered" ||
                key === "removed" ||
                key === "safe"
            ) {
                postData[key] = data[key] === "true";
            } else if (key === "createdAt") {
                postData[key] = parseInt(data[key]);
            } else {
                postData[key] = data[key] as never;
            }
        });
        postData.postId = postId;
        postData.log._debugMode = (await context.settings.get("debugMode")) === "true";
        return postData;
    }

    static async getPostDataByConversationId(
        context: Context | TriggerContext,
        conversationId: string,
    ): Promise<PostData | undefined> {
        const { redis } = context;
        const postId = await redis.hGet(`conversation:${conversationId}`, "postId");
        if (postId === undefined) {
            return undefined;
        }
        return await PostData.fromPostId(context, postId);
    }

    age(now: number | undefined = undefined): number {
        return (now || Date.now()) - this.createdAt;
    }

    async commentReply(
        commentType: CommentType,
        explanation?: string,
    ): Promise<Comment | undefined> {
        let text = "";
        let comment: Comment | undefined = undefined;
        if (this.commentId) {
            comment = await this.context.reddit.getCommentById(this.commentId);
        }
        if (this.post === null) {
            this.post = await this.resolvePost();
        }
        await this.#injectLogArgs();
        let commentModified = false;
        switch (commentType) {
            case CommentType.Accepted:
                if (explanation) {
                    text =
                        await this.#generateExplanationAcceptedCommentBody(explanation);
                    commentModified = true;
                }
                break;
            case CommentType.Pending:
                text = await this.#replacePlaceholders(
                    PlaceholderField.explanationPendingComment,
                );
                if (text) {
                    commentModified = true;
                }
                break;
            case CommentType.Removed:
                text = await this.#replacePlaceholders(
                    PlaceholderField.postRemovalCommentHeader,
                );
                {
                    const result = this.#modifyComment(text, comment, commentType);
                    if (result.alreadyModified) break;
                    text = result.text;
                    commentModified = result.modified;
                }
                break;
            case CommentType.Safe:
                text = await this.#replacePlaceholders(
                    PlaceholderField.postMarkedSafeCommentHeader,
                );
                {
                    const result = this.#modifyComment(text, comment, commentType);
                    if (result.alreadyModified) break;
                    text = result.text;
                    commentModified = result.modified;
                }
                break;
            default:
                throw new Error(`Unhandled comment type ${commentType}`);
        }
        if (!commentModified) {
            this.log.info(`Comment was not added or modified`);
            return;
        }
        if (comment) {
            this.log.info(`Editing comment with Comment${commentType} text`);
            try {
                comment = await withRetries(() => comment?.edit({ text }));
            } catch (error) {
                this.log.error("Failed to edit comment", error);
                return;
            }
        } else {
            this.log.info(
                `Adding comment to ${this.post.id} with Comment${commentType} text`,
            );
            try {
                comment = await withRetries(() => this.post?.addComment({ text }), 5);
            } catch (error) {
                this.log.error("Failed to add comment", error);
                return;
            }
            if (!comment) {
                this.log.error("No comment to associate");
                return;
            }
            await comment.distinguish(true);
            this.commentId = comment.id;
            await this.writeToRedis();
            await this.#associateIdWithPost("comment", comment.id);
        }
        if ((await resolveSetting(this.context.settings, "lockComment")) && comment) {
            this.log.info(`Locking comment ${comment.id}`);
            await comment.lock();
        }
        return comment;
    }

    humanAge(): string {
        return humanDuration(this.age() / 60000);
    }

    async inCategory(category: PostCategory): Promise<boolean> {
        const results = await this.context.redis.zScan(
            `posts:${category}`,
            0,
            this.postId,
        );
        return results.members.length > 0;
    }

    /**
     * Initializes the post session by commenting and sending a message if allowed.
     * @param explanationPendingComment - The comment to be posted if an explanation is pending.
     * @param allowExplanation - Whether to allow sending an explanation message.
     * @param post - The post to be processed.
     */
    async initializePostSession(
        explanationPendingComment: string,
        allowExplanation: boolean,
        post: Post,
    ) {
        if (explanationPendingComment) {
            const comment = await this.commentReply(CommentType.Pending);
            if (comment === undefined) {
                this.log.error("Failed to comment");
                return;
            }
        }
        if (allowExplanation) {
            await this.sendMessage(post);
        }
        await this.savePost(
            allowExplanation ? PostCategory.PendingResponse : PostCategory.Active,
        );
    }

    async isPendingResponse(): Promise<boolean> {
        return this.responseMessageId === "";
    }

    async leavePrivateModNote(noteType: PrivateNote): Promise<void> {
        await this.context.reddit.modMail.reply({
            conversationId: this.sentModmailId,
            body: noteType.valueOf(),
            isInternal: true,
        });
        await withRetries(() =>
            this.context.reddit.modMail.archiveConversation(this.sentModmailId),
        );
    }

    async markApproved(): Promise<void> {
        this.safe = true;
        await this.setCategory(PostCategory.Safe);
        await this.commentReply(CommentType.Safe);
        await this.writeToRedis();
        await this.leavePrivateModNote(PrivateNote.Approved);
    }

    async markDeleted(): Promise<void> {
        this.deleted = true;
        await this.setCategory(PostCategory.Deleted);
        await this.writeToRedis();
        await this.leavePrivateModNote(PrivateNote.Deleted);
    }

    async markFiltered(): Promise<void> {
        this.filtered = true;
        await this.setCategory(PostCategory.Filtered);
        await this.writeToRedis();
        await this.leavePrivateModNote(PrivateNote.Filtered);
    }

    async markRemoved(): Promise<void> {
        this.removed = true;
        await this.setCategory(PostCategory.Removed);
        await this.writeToRedis();
        await this.leavePrivateModNote(PrivateNote.Removed);
    }

    async markSafe(): Promise<void> {
        this.safe = true;
        await this.setCategory(PostCategory.Safe);
        await this.commentReply(CommentType.Safe);
        await this.writeToRedis();
        await this.leavePrivateModNote(PrivateNote.Safe);
    }

    olderThan(minutes: number, now: number | undefined = undefined): boolean {
        if (minutes == 0) {
            return false;
        }
        const age = this.age(now);
        const milliseconds = minutes * 60000;
        const result = age > milliseconds;
        this.log.debug(
            "olderThan this.age(now) > (minutes * 60000): %s | this.age(now): %s | minutes * 60000: %s",
            this.postId,
            result,
            age,
            milliseconds,
        );
        return result;
    }

    async removalScore(now: number | undefined = undefined): Promise<number> {
        const {
            removalScore: staticRemovalScore,
            useScoreRatio,
            removalScoreRatioBase,
            removalScoreRatioOffset,
        } = await resolveSettings(
            this.context.settings,
            "removalScore",
            "useScoreRatio",
            "removalScoreRatioBase",
            "removalScoreRatioOffset",
        );
        await this.#injectLogArgs();
        let score = staticRemovalScore;
        if (useScoreRatio) {
            score = Math.floor(
                (removalScoreRatioBase / 10) ** (this.age(now) / 1000 / 60 / 60 - 1) -
                    removalScoreRatioOffset,
            );
            this.log.debug("removalScoreRatioBase", removalScoreRatioBase);
            this.log.debug("removalScoreRatioOffset", removalScoreRatioOffset);
            this.log.debug("this.age(now)", this.age(now));
            this.log.debug(
                "this.age(now) / 1000 / 60 / 60",
                this.age(now) / 1000 / 60 / 60,
            );
            this.log.debug(
                "Math.floor(removalScoreRatioBase / 10) ** ((this.age(now) / 1000 / 60 / 60) - 1) - removalScoreRatioOffset)",
                score,
            );
        }
        this.log.debug("removalScore", score);
        return score;
    }

    async report() {
        if (this.comment === null) {
            this.comment = await this.resolveComment();
        }
        await this.#injectLogArgs();
        await this.context.reddit.report(this.comment, {
            reason: (
                await this.#replacePlaceholders(PlaceholderField.reportReason)
            ).slice(0, 100),
        });
        this.log.info("Comment reported");
    }

    async resolveComment(): Promise<Comment> {
        if (!this.comment)
            this.comment = await this.context.reddit.getCommentById(this.commentId);
        return this.comment;
    }

    async resolvePost(): Promise<Post> {
        if (!this.post) this.post = await this.context.reddit.getPostById(this.postId);
        return this.post;
    }

    async respond(params: RespondType): Promise<void> {
        if (this.post === null) {
            this.post = await this.resolvePost();
        }
        if (this.comment === null && this.commentId) {
            this.comment = await this.resolveComment();
        }
        let body: string;
        switch (params.responseType) {
            case ResponseType.Accepted:
                body = await this.#replacePlaceholders(
                    PlaceholderField.explanationAcceptedMessageBody,
                );
                break;
            case ResponseType.AlreadyAccepted:
                body = await this.#replacePlaceholders(
                    PlaceholderField.explanationAlreadyAcceptedMessageBody,
                );
                break;
            case ResponseType.Error:
                body = `An error occurred while processing your response. Please try again or send a [message](https://www.reddit.com/message/compose/?to=r/${this.context.subredditName}) to the subreddit moderators.`;
                break;
            case ResponseType.Ineligible:
                body = `Your post is not eligible for a response. Please ensure that you are responding to an eligible post.`;
                break;
            case ResponseType.Invalid:
                body = await this.#replacePlaceholders(
                    PlaceholderField.explanationInvalidMessageBody,
                );
                break;
            case ResponseType.TooLate:
                body = await this.#replacePlaceholders(
                    PlaceholderField.explanationTooLateMessageBody,
                );
                break;
            case ResponseType.TooShort:
                body = (
                    await this.#replacePlaceholders(
                        PlaceholderField.explanationTooShortMessageBody,
                    )
                ).replace(/\{replyLength}/g, params.replyLength.toString());
                break;
        }
        if (!body) {
            await withRetries(() =>
                this.context.reddit.modMail.archiveConversation(this.sentModmailId),
            );
            return;
        }
        await this.context.reddit.modMail.reply({
            conversationId: this.sentModmailId,
            body,
            isAuthorHidden: true,
        });
        await withRetries(() =>
            this.context.reddit.modMail.archiveConversation(this.sentModmailId),
        );
    }

    async savePost(category: PostCategory): Promise<void> {
        await this.context.redis.zAdd(`posts:${category}`, {
            member: this.postId,
            score: this.createdAt,
        });
        await this.writeToRedis();
    }

    async sendMessage(post: Post): Promise<void> {
        const { reddit, subredditName } = this.context;
        const postIdPrefix = `[${post.id}]: `;
        const subject =
            postIdPrefix +
            (await this.#replacePlaceholders(PlaceholderField.messageSubject)).slice(
                0,
                100 - postIdPrefix.length,
            );
        const body = await this.#replacePlaceholders(PlaceholderField.messageBody);
        let conversationData;
        try {
            conversationData = await withRetries(() =>
                reddit.modMail.createConversation({
                    body: body,
                    isAuthorHidden: true,
                    subject: subject,
                    subredditName: subredditName as string,
                    to: post.authorName,
                }),
            );
        } catch (error) {
            this.log.error("Failed to send modmail", error);
            return;
        }
        if (conversationData) {
            await this.#associateIdWithPost(
                "conversation",
                conversationData.conversation.id as string,
            );
            this.sentModmailId = conversationData.conversation.id as string;
            await this.writeToRedis();
        }
        try {
            await withRetries(() =>
                this.context.reddit.modMail.archiveConversation(
                    conversationData.conversation.id as string,
                ),
            );
        } catch (error) {
            this.log.error("Failed to archive conversation", error);
        }
    }

    async setCategory(newCategory: PostCategory): Promise<void> {
        await this.#injectLogArgs();
        this.log.info(`Moving post ${this.postId} to ${newCategory}`);
        await Promise.all(
            Object.values(PostCategory).map(
                async (category) =>
                    await this.context.redis.zRem(`posts:${category}`, [this.postId]),
            ),
        );
        await this.context.redis.zAdd(`posts:${newCategory}`, {
            member: this.postId,
            score: this.createdAt,
        });
    }

    async writeToRedis(): Promise<void> {
        const data: Partial<Record<keyof PostData, string>> = {};
        const keys = Object.keys(this);
        for (const key of keys) {
            if (
                key === "comment" ||
                key === "context" ||
                key === "post" ||
                key === "log"
            ) {
                continue;
            }
            if (key !== "postId")
                data[key as keyof PostData] = this[key as keyof PostData]?.toString();
        }
        await this.context.redis.hSet(this.postId, data);
    }

    async #associateIdWithPost(
        idType: "conversation" | "comment",
        otherId: string,
    ): Promise<void> {
        await this.#injectLogArgs();
        this.log.info(`Associating ${this.postId} with ${otherId}`);
        await this.context.redis.hSet(`${idType}:${otherId}`, {
            postId: this.postId,
        });
    }

    async #generateExplanationAcceptedCommentBody(
        explanation: string,
    ): Promise<string> {
        if (this.post === null) {
            this.post = await this.resolvePost();
        }
        const text = await this.#replacePlaceholders(
            PlaceholderField.explanationAcceptedComment,
        );
        const spoilerExplanation = await resolveSetting(
            this.context.settings,
            "spoilerExplanation",
        );
        return text.replace(
            /\{explanation}/g,
            spoilerExplanation
                ? this.#spoiler(explanation)
                : "> " + explanation.replace("\n", "\n> "),
        );
    }

    async #injectLogArgs(): Promise<void> {
        let additionalArgs: string[] = [];
        if ((await this.context.settings.get("debugMode")) === "true") {
            this.log.prefix = `${this.log.prefix} | u/%s | commentId: %s | conversationId: %s | deleted: %s | filtered: %s | removed: %s | safe: %s`;
            additionalArgs = [
                this.author,
                this.commentId,
                this.sentModmailId,
                this.deleted.toString(),
                this.filtered.toString(),
                this.removed.toString(),
                this.safe.toString(),
            ];
        }
        this.log.injectArgs(this.postId, ...additionalArgs);
    }

    #modifyComment(
        text: string,
        comment: Comment | undefined,
        commentType: CommentType,
    ): { text: string; modified: boolean; alreadyModified: boolean } {
        if (!text || !comment) {
            return { alreadyModified: false, modified: false, text: text };
        }
        if (comment.body.startsWith(text)) {
            this.log.info(`Comment already has Comment${commentType} text`);
            return { alreadyModified: true, modified: false, text: text };
        }
        return {
            alreadyModified: false,
            modified: true,
            text: `${text}\n${comment.body}`,
        };
    }

    async #replacePlaceholders(field: PlaceholderField): Promise<string> {
        if (this.post === null) {
            this.post = await this.resolvePost();
        }
        const { replyDuration, lateReplyDuration } = await resolveSettings(
            this.context.settings,
            "replyDuration",
            "lateReplyDuration",
        );
        let text = (await resolveSetting(this.context.settings, field)) || "";
        text = text.replace(/\{subreddit}/g, this.post.subredditName);
        text = text.replace(/\{author}/g, this.post.authorName);
        text = text.replace(/\{title}/g, this.post.title);
        text = text.replace(/\{url}/g, `https://www.reddit.com${this.post.permalink}`);
        text = text.replace(/\{link}/g, this.post.url);
        text = text.replace(/\{score}/g, this.post.score.valueOf().toString());
        text = text.replace(/\{replyDuration}/g, humanDuration(replyDuration));
        text = text.replace(/\{lateReplyDuration}/g, humanDuration(lateReplyDuration));
        return text.replace(
            /\{commentUrl}/g,
            this.comment !== null
                ? `https://www.reddit.com${this.comment.permalink}`
                : "",
        );
    }

    #spoiler(text: string) {
        text = text.replace(">!", "\\>\\!");
        text = text.replace("!<", "\\!\\<");
        const parts = text.split("\n\n");
        return parts.map((part) => `>!${part}!<`).join("\n\n");
    }
}
