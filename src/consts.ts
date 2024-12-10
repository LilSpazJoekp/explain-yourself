export const URL_REGEX =
    /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))/g;
export const CHECK_CRON = "*/5 * * * * *";
export const COMMENT_WATCHER = "comment_watcher";
export const JOB_WATCHER = "job_watcher";
export const POST_WATCHER = "post_watcher";
export const RESPONSE_WATCHER = "response_watcher";
export const JOBS = [COMMENT_WATCHER, POST_WATCHER, RESPONSE_WATCHER];
export const WATCHED_MODLOG_ACTIONS = [
    "approvelink",
    "removecomment",
    "removelink",
    "spamlink",
];
