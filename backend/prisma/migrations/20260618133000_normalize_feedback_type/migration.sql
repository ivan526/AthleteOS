UPDATE "UserFeedback"
SET "feedbackType" = 'other'
WHERE "feedbackType" IS NULL OR TRIM("feedbackType") = '';
