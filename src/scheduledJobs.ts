import {
    Comment,
    JobContext,
    JSONObject,
    Post,
    ScheduledJobEvent,
} from "@devvit/public-api";
import { CommentType, PostCategory } from "./_types.js";
import { CHECK_CRON, JOBS, PrivateNote } from "./consts.js";
import { PrefixLogger } from "./logger.js";
import { PostData } from "./postData.js";
import { resolveSettings } from "./utils.js";

const logger = new PrefixLogger("Scheduled Job Handler | %s");

export async function checkComments(
    _event: ScheduledJobEvent<JSONObject>,
    context: JobContext,
) {
    const log = logger.injectArgs("checkComments");
    log.info("Checking active posts");
    const { settings } = context;
    const {
        commentApproveScore,
        approveWithCommentScore,
        commentMaxAge,
        commentMinAge,
        commentSafeScore,
        markSafeWithCommentScore,
        removeWithCommentScore,
        reportReason,
        reportWithCommentScore,
    } = await resolveSettings(
        settings,
        "commentApproveScore",
        "postApproveScore",
        "approveWithCommentScore",
        "commentMaxAge",
        "commentMinAge",
        "commentSafeScore",
        "markSafeWithCommentScore",
        "markSafeWithPostScore",
        "removeWithCommentScore",
        "reportReason",
        "reportWithCommentScore",
    );
    const fetchedPosts = (await PostData.fetchFromCategory(
        PostCategory.Active,
        context,
        true,
        true,
    )) as (PostData & { comment: Comment; post: Post })[];
    const now = Date.now().valueOf();
    const activePosts = fetchedPosts
        .filter((postData) => {
            log.info("Checking age of post %s", postData.postId);
            log.info("Post age: %s", postData.age(now));
            log.info("Comment min age: %s", commentMinAge * 60000);
            log.info(
                "postData.age(now) >= commentMinAge",
                postData.age(now) >= commentMinAge * 60000,
            );
            return postData.age(now) >= commentMinAge * 60000;
        })
        .filter((postData) => {
            log.info("Checking age of post %s", postData.postId);
            log.info("Post age: %s", postData.age(now));
            log.info("Comment min age: %s", commentMaxAge * 60000);
            log.info(
                "postData.age(now) <= commentMaxAge",
                postData.age(now) <= commentMaxAge * 60000,
            );
            return postData.age(now) <= commentMaxAge * 60000;
        });

    const toApprove: (PostData & { comment: Comment; post: Post })[] = [];
    const toMarkSafe = fetchedPosts.filter((postData) =>
        postData.olderThan(commentMaxAge, now),
    );
    const toRemove: (PostData & { comment: Comment; post: Post })[] = [];
    const toReport: (PostData & { comment: Comment; post: Post })[] = [];
    await Promise.all(
        activePosts.map(
            async (
                postData: PostData & { comment: Comment; post: Post },
            ): Promise<void> => {
                if (
                    markSafeWithCommentScore &&
                    postData.comment.score >= commentSafeScore
                ) {
                    log.info(
                        "Adding post %s to toMarkSafe due to comment score (%s >= %s)",
                        postData.postId,
                        postData.comment.score,
                        commentSafeScore,
                    );
                    toMarkSafe.push(postData);
                    return;
                }
                log.info("checking score");
                log.info("comment score: %s", postData.comment.score);
                log.info("removal score: %s", await postData.removalScore(now));
                if (postData.comment.score <= (await postData.removalScore(now))) {
                    log.info(
                        "Adding post %s to toRemove due to comment score (%s <= %s)",
                        postData.postId,
                        postData.comment.score,
                        await postData.removalScore(now),
                    );
                    if (removeWithCommentScore) toRemove.push(postData);
                    if (reportWithCommentScore && reportReason) toReport.push(postData);
                    return;
                }
                if (
                    approveWithCommentScore &&
                    postData.comment.score >= commentApproveScore
                ) {
                    log.info(
                        "Adding post %s to toApprove due to comment score (%s >= %s)",
                        postData.postId,
                        postData.comment.score,
                        commentApproveScore,
                    );
                    toApprove.push(postData);
                }
            },
        ),
    );

    await Promise.all(
        toMarkSafe
            .map(async (postData) => {
                log.info("Setting post %s as safe", postData.postId);
                await postData.markSafe();
                await postData.commentReply(CommentType.Safe);
            })
            .concat(
                toApprove.map(async (postData) => {
                    log.info("Approving post %s and setting as safe", postData.postId);
                    await postData.post.approve();
                    await postData.markApproved();
                    await postData.commentReply(CommentType.Safe);
                }),
            )
            .concat(
                toRemove.map(async (postData) => {
                    log.info("Removing post %s", postData.postId);
                    await postData.post.remove();
                    await postData.markRemoved();
                    await postData.commentReply(CommentType.Removed);
                }),
            )
            .concat(
                toReport.map(async (postData) => {
                    log.info("Reporting comment %s", postData.comment.id);
                    await postData.report();
                    await postData.setCategory(PostCategory.Removed);
                }),
            ),
    );
}

export async function checkPosts(
    _event: ScheduledJobEvent<JSONObject>,
    context: JobContext,
) {
    const log = logger.injectArgs("checkPosts");
    log.info("Checking active posts");
    const { settings } = context;
    const {
        approveWithPostScore,
        markSafeWithPostScore,
        postSafeScore,
        postApproveScore,
    } = await resolveSettings(
        settings,
        "approveWithPostScore",
        "markSafeWithPostScore",
        "postSafeScore",
        "postApproveScore",
    );
    if (!markSafeWithPostScore && !approveWithPostScore) {
        log.info("No actions to take");
        return;
    }
    const activePosts = (await PostData.fetchFromCategory(
        PostCategory.Active,
        context,
        false,
        true,
    )) as (Omit<PostData, "post"> & { post: Post })[];

    const toApprove: (Omit<PostData, "post"> & { post: Post })[] = [];
    const toMarkSafe: (Omit<PostData, "post"> & { post: Post })[] = [];
    activePosts.forEach((postData) => {
        if (approveWithPostScore && postData.post.score >= postApproveScore) {
            log.info(
                "Adding post %s to toApprove due to post score (%s >= %s)",
                postData.postId,
                postData.post.score,
                postApproveScore,
            );
            toApprove.push(postData);
        } else if (markSafeWithPostScore && postData.post.score >= postSafeScore) {
            log.info(
                "Adding post %s to toMarkSafe due to post score (%s >= %s)",
                postData.postId,
                postData.post.score,
                postSafeScore,
            );
            toMarkSafe.push(postData);
        }
    });
    await Promise.all(
        toMarkSafe.map(async (postData) => {
            log.info("Setting post %s as safe due to post score", postData.postId);
            await postData.markSafe();
            await postData.commentReply(CommentType.Safe);
        }),
    );
    await Promise.all(
        toApprove.map(async (postData) => {
            log.info("Approving post %s and setting as safe", postData.postId);
            await postData.post.approve();
            await postData.markApproved();
            await postData.commentReply(CommentType.Safe);
        }),
    );
}

export async function checkResponses(
    _event: ScheduledJobEvent<JSONObject>,
    context: JobContext,
) {
    const log = logger.injectArgs("checkResponses");
    log.info("Checking pending posts");
    const { reddit, settings } = context;
    const { replyDuration, lateReplyDuration } = await resolveSettings(
        settings,
        "replyDuration",
        "lateReplyDuration",
    );
    const pendingResponse = await PostData.fetchFromCategory(
        PostCategory.PendingResponse,
        context,
        false,
        true,
    );
    const now = Date.now().valueOf();
    await Promise.all(
        pendingResponse
            .filter(
                (postData) =>
                    replyDuration > 0 && postData.olderThan(replyDuration, now),
            )
            .map(async (postData) => {
                log.info("Removing post %s due to no response", postData.postId);
                await reddit.remove(postData.postId, false);
                if (lateReplyDuration < 1) {
                    log.info("Author did not reply in allotted time, removing post");
                    await postData.commentReply(CommentType.Removed);
                    await postData.setCategory(PostCategory.Removed);
                    await postData.leavePrivateModNote(PrivateNote.Removed);
                } else {
                    await postData.setCategory(PostCategory.NoResponse);
                    await postData.leavePrivateModNote(PrivateNote.NoResponse);
                }
            }),
    );
    log.info("Checking no response posts");
    const noResponse = await PostData.fetchFromCategory(
        PostCategory.NoResponse,
        context,
        false,
        false,
    );
    await Promise.all(
        noResponse
            .filter((postData) => postData.olderThan(lateReplyDuration, now))
            .map(async (postData) => {
                log.info(
                    "Author did not late reply in allotted time, removing submission",
                );
                await reddit.remove(postData.postId, false);
                await postData.commentReply(CommentType.Removed);
                await postData.setCategory(PostCategory.Removed);
                await postData.leavePrivateModNote(PrivateNote.Removed);
            }),
    );
}

export async function ensureJobs(
    _event: ScheduledJobEvent<JSONObject>,
    { scheduler }: JobContext,
) {
    const log = logger.injectArgs("ensureJobs");
    const runningJobs = await scheduler.listJobs();
    const missingJobs: string[] = [];
    JOBS.forEach((job) => {
        if (!runningJobs.some((runningJob) => runningJob.name === job)) {
            missingJobs.push(job);
        }
    });
    if (missingJobs.length === 0) {
        return;
    }
    log.info("Missing jobs: %s", missingJobs.join(", "));
    await Promise.all(
        missingJobs.map(async (job) => {
            log.info("Setting up %s", job);
            await scheduler.runJob({ cron: CHECK_CRON, name: job });
        }),
    );
}
