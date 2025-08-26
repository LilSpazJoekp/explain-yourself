export const CHECK_CRON = "*/5 * * * * *";
export const COMMENT_WATCHER = "comment_watcher";
export const DEFAULT_RETRIES = 3;
export const JOB_WATCHER = "job_watcher";
export const POST_WATCHER = "post_watcher";
export const RESPONSE_WATCHER = "response_watcher";
export const JOBS = [COMMENT_WATCHER, POST_WATCHER, RESPONSE_WATCHER];
export const URL_REGEX =
    /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))/g;
export const WATCHED_MODLOG_ACTIONS = [
    "approvecomment",
    "approvelink",
    "removecomment",
    "removelink",
    "spamlink",
];

export enum PrivateNote {
    Approved = "The post/comment was approved by a moderator. This can include approvals performed by the bot itself.",
    Deleted = "The post was deleted by the author.",
    Filtered = "The post/comment was filtered by AutoModerator. Responses will be allowed after moderator approval.",
    Removed = "The post/comment was removed by a moderator. This can include removals for the following reasons:\n\n- a moderator (other than this bot) removed the post/comment\n- this bot removed the post for failing to meet defined requirements\n- author failed to respond with an explanation within the required time\n- spam",
    Safe = "The post has marked as safe. It will no longer be monitored.",
    NoResponse = "The explanation request was not responded to by the author.",
}
