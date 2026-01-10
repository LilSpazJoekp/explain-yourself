import {
    Comment,
    Context,
    JobContext,
    Post,
    TriggerContext,
    User,
} from "@devvit/public-api";

import {
    AnyContext,
    CATEGORY_REMOVAL_MAPPING,
    CommentType,
    PlaceholderField,
    PostCategory,
    ResponseType,
    TERMINAL_CATEGORIES,
    TerminalCategory,
} from "./_types.js";
import {
    MAX_MESSAGE_SUBJECT_LENGTH,
    MAX_REPORT_REASON_LENGTH,
    PrivateNote,
} from "./consts.js";
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
    commentId: string;
    createdAt: number;
    deleted: boolean;
    filtered: boolean;
    log: PrefixLogger = new PrefixLogger("PostData | postId: %s");
    responseMessageId: string;
    safe: boolean;
    sentModmailId: string;

    constructor(
        public context: AnyContext,
        public postId: string,
    ) {
        this.commentId = "";
        this.createdAt = 0;
        this.deleted = false;
        this.filtered = false;
        this.responseMessageId = "";
        this.safe = false;
        this.sentModmailId = "";
    }

    _author: User | undefined;

    get author(): User {
        if (this._author) return this._author;
        let _author;
        this.post.getAuthor().then((author) => {
            _author = author;
        });
        return _author!;
    }

    set author(value: User | undefined) {
        this._author = value;
    }

    _comment: Comment | undefined;

    get comment(): Comment | null {
        if (this._comment) return this._comment;
        let _comment = null;
        if (this.commentId)
            this.context.reddit.getCommentById(this.commentId!).then((comment) => {
                _comment = comment;
            });
        return _comment;
    }

    set comment(value: Comment) {
        this._comment = value;
    }

    _post: Post | undefined;

    get post(): Post {
        if (this._post) return this._post;
        let _post = null;
        this.context.reddit.getPostById(this.postId).then((post) => {
            _post = post;
        });
        return _post!;
    }

    set post(value: Post) {
        this._post = value;
    }

    _removed: boolean = false;

    get removed(): boolean {
        if (this._removed !== undefined) return this._removed;
        return this.post.removed;
    }

    set removed(value: boolean) {
        this._removed = value;
    }

    static async exists(
        context: Context | TriggerContext,
        postId: string,
    ): Promise<boolean> {
        const { redis } = context;
        const data: Record<string, string> = await redis.hGetAll(postId);
        return Object.keys(data).length > 0;
    }

    static async fetchFromCategory(
        category: PostCategory,
        context: Context | JobContext | TriggerContext,
        fetchComments: boolean = false,
        fetchPosts: boolean = false,
    ): Promise<PostData[]> {
        const { redis, settings, reddit } = context;
        const results = await redis.zScan(`posts:${category}`, 0);
        if ((await settings.get("debugMode")) === "true") {
            console.log(category, results);
        }
        const postDataItems = await Promise.all(
            results.members.map(async (item) => {
                try {
                    const postData = await PostData.fromPostId(context, item.member);
                    if (!postData) return undefined;

                    if (fetchPosts) {
                        postData.post = await reddit.getPostById(postData.postId);
                    }
                    if (fetchComments) {
                        postData.comment = await reddit.getCommentById(
                            postData.commentId,
                        );
                    }
                    return postData;
                } catch (error) {
                    console.error(
                        `Failed to fetch post data for ${item.member}:`,
                        error,
                    );
                    return undefined;
                }
            }),
        );
        return postDataItems.filter((item): item is PostData => item !== undefined);
    }

    static async fromPost(
        context: Context | TriggerContext,
        post: Post,
    ): Promise<PostData> {
        const postData = new PostData(context, post.id);
        await postData.loadFromRedis();

        let additionalArgs: string[] = [];
        if ((await context.settings.get("debugMode")) === "true") {
            postData.log._debugMode = true;
            postData.log.prefix = `${postData.log.prefix} | u/%s | commentId: %s | conversationId: %s | deleted: %s | filtered: %s | removed: %s | safe: %s`;
            additionalArgs = [
                postData.author?.username || "[deleted]",
                postData.commentId,
                postData.sentModmailId,
                postData.deleted.toString(),
                postData.filtered.toString(),
                postData.removed.toString(),
                postData.safe.toString(),
            ];
        }
        postData.log.injectArgs(postData.postId, ...additionalArgs);
        postData.author = await post.getAuthor();
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
        try {
            return await PostData.fromPost(
                context,
                await context.reddit.getPostById(postId),
            );
        } catch (error) {
            console.error(`Failed to fetch post by ID ${postId}:`, error);
            return undefined;
        }
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
        this.log.info(`Replying with Comment${commentType}`);
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
     * @param ignoreModerators - Whether to ignore moderators when sending messages.
     */
    async initializePostSession(
        explanationPendingComment: string,
        allowExplanation: boolean,
        post: Post,
        ignoreModerators: boolean,
    ) {
        await this.loadFromRedis();
        if (explanationPendingComment) {
            if (this.commentId) {
                this.log.info(
                    "Comment already exists, skipping adding pending comment",
                );
                return;
            } else {
                const comment = await this.commentReply(CommentType.Pending);
                if (!comment) {
                    this.log.error("Failed to comment");
                    return;
                }
            }
        }
        if (allowExplanation) {
            if (this.sentModmailId) {
                this.log.info("Modmail already sent, skipping sending message");
            } else {
                await this.sendMessage(post);
                const subreddit = await this.context.reddit.getCurrentSubreddit();
                if (
                    (
                        await subreddit
                            .getModerators({ username: this.author?.username || "" })
                            .all()
                    ).length > 0
                ) {
                    if (!ignoreModerators) {
                        this.log.info(
                            "Author is a moderator, sending PM with link to modmail thread",
                        );
                        await this.context.reddit.sendPrivateMessage({
                            to: post.authorName,
                            subject: `Re: [${this.postId}] Response Required`,
                            text: `Please respond to this modmail thread to add your explanation:\n\nhttps://mod.reddit.com/mail/all/${this.sentModmailId}`,
                        });
                    }
                }
            }
        }
        await this.setCategory(PostCategory.Seen);
        await this.savePost(
            allowExplanation ? PostCategory.PendingResponse : PostCategory.Active,
        );
    }

    async isPendingResponse(): Promise<boolean> {
        const isSafe = await this.inCategory(PostCategory.Safe);
        const isActive = await this.inCategory(PostCategory.Active);
        const isPendingResponse = await this.inCategory(PostCategory.PendingResponse);
        this.log.info(
            `isPendingResponse: inPendingResponse: ${isPendingResponse} isSafe=${isSafe}, isActive=${isActive}, responseMessageId=${this.responseMessageId}`,
        );
        return isPendingResponse || !(isSafe || isActive || this.responseMessageId);
    }

    async leavePrivateModNote(noteType: PrivateNote): Promise<void> {
        if (!this.sentModmailId) {
            this.log.error("No modmail to leave a note on");
            return;
        }
        await this.context.reddit.modMail.reply({
            conversationId: this.sentModmailId,
            body: noteType.valueOf(),
            isInternal: true,
        });
        if (
            (
                await this.context.reddit.modMail.getConversation({
                    conversationId: this.sentModmailId,
                })
            ).conversation?.isInternal
        ) {
            this.log.info("Conversation is internal. Not archiving.");
            return;
        }
        await withRetries(() =>
            this.context.reddit.modMail.archiveConversation(this.sentModmailId),
        );
    }

    async loadFromRedis(): Promise<void> {
        const { redis, settings } = this.context;
        const data: Record<keyof PostData, string> = await redis.hGetAll(this.postId);
        if (Object.keys(data).length === 0) {
            return;
        }
        (Object.keys(data) as (keyof PostData)[]).forEach((key: keyof PostData) => {
            if (key == "deleted" || key === "filtered" || key === "safe") {
                this[key] = data[key] === "true";
            } else if (key === "createdAt") {
                this[key] = parseInt(data[key]);
            } else {
                this[key] = data[key] as never;
            }
        });
        this.log._debugMode = (await settings.get("debugMode")) === "true";
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

    async markRemoved(modRemoved: boolean = false): Promise<void> {
        this.removed = true;
        await this.setCategory(PostCategory.Removed);
        await this.writeToRedis();
        await this.leavePrivateModNote(
            modRemoved ? PrivateNote.ModRemoved : PrivateNote.BotRemoved,
        );
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
        if (!this.comment) {
            this.log.error("No comment to report");
            return;
        }
        await this.context.reddit.report(this.comment, {
            reason: (
                await this.#replacePlaceholders(PlaceholderField.reportReason)
            ).slice(0, MAX_REPORT_REASON_LENGTH),
        });
        this.log.info("Comment reported");
    }

    async respond(params: RespondType): Promise<void> {
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
            await this.#archiveConversationIfNotInternal(this.sentModmailId);
            return;
        }
        try {
            await this.context.reddit.modMail.reply({
                conversationId: this.sentModmailId,
                body,
                isAuthorHidden: true,
            });
        } catch (error) {
            this.log.error("Failed to send modmail reply", error);
            return;
        }
        await this.#archiveConversationIfNotInternal(this.sentModmailId);
    }

    async savePost(category: PostCategory): Promise<void> {
        await this.setCategory(category);
        await this.writeToRedis();
    }

    async sendMessage(post: Post): Promise<void> {
        const { reddit, subredditName } = this.context;
        const postIdPrefix = ` [${post.id}]`;
        const subject =
            (await this.#replacePlaceholders(PlaceholderField.messageSubject)).slice(
                0,
                MAX_MESSAGE_SUBJECT_LENGTH - postIdPrefix.length,
            ) + postIdPrefix;
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
            if (
                (
                    await this.context.reddit.modMail.getConversation({
                        conversationId: this.sentModmailId,
                    })
                ).conversation?.isInternal
            ) {
                this.log.info("Conversation is internal. Not archiving.");
                return;
            }
            await withRetries(() =>
                this.context.reddit.modMail.archiveConversation(
                    conversationData.conversation.id as string,
                ),
            );
        } catch (error) {
            this.log.error("Failed to archive conversation", error);
        }
    }

    async setCategory(toAdd: PostCategory): Promise<void> {
        const inTerminalState: boolean = (
            await Promise.all(
                Object.values(TERMINAL_CATEGORIES).map(
                    async (category: TerminalCategory) => {
                        const inCategory = await this.inCategory(category);
                        if (inCategory)
                            this.log.info(`Post is in terminal category: ${category}`);
                        return inCategory;
                    },
                ),
            )
        ).some(Boolean);
        if (inTerminalState) {
            this.log.info(`Post is in a terminal category, not modifying categories`);
            return;
        }
        this.log.info(`Adding post ${this.postId} to ${toAdd}`);
        await this.context.redis.zAdd(`posts:${toAdd}`, {
            member: this.postId,
            score: this.createdAt,
        });
        for (const category of CATEGORY_REMOVAL_MAPPING[toAdd] || []) {
            this.log.info(`Removing post ${this.postId} from ${category}`);
            await this.context.redis.zRem(`posts:${category}`, [this.postId]);
        }
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
            if (key !== "postId" && !key.startsWith("_"))
                data[key as keyof PostData] = this[key as keyof PostData]?.toString();
        }
        await this.context.redis.hSet(this.postId, data);
    }

    async #archiveConversationIfNotInternal(conversationId: string): Promise<void> {
        try {
            const { conversation } = await this.context.reddit.modMail.getConversation({
                conversationId,
            });

            if (conversation?.isInternal) {
                this.log.info("Conversation is internal. Not archiving.");
                return;
            }

            await withRetries(() =>
                this.context.reddit.modMail.archiveConversation(conversationId),
            );
        } catch (error) {
            this.log.error("Failed to check or archive conversation", error);
        }
    }

    async #associateIdWithPost(
        idType: "conversation" | "comment",
        otherId: string,
    ): Promise<void> {
        this.log.info(`Associating ${this.postId} with ${otherId}`);
        await this.context.redis.hSet(`${idType}:${otherId}`, {
            postId: this.postId,
        });
    }

    async #generateExplanationAcceptedCommentBody(
        explanation: string,
    ): Promise<string> {
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
                : "> " + explanation.replace(/\n/g, "\n> "),
        );
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
        text = text.replace(/>!/g, "\\>\\!");
        text = text.replace(/!</g, "\\!\\<");
        const parts = text.split("\n\n");
        return parts.map((part) => `>!${part}!<`).join("\n\n");
    }
}
