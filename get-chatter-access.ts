import getAccountAccess from "./get-account-access.ts";

const shouldAuthorizeForAnnouncements = confirm(
  "Do you want to be able to send announcements with this authorization?",
);
await getAccountAccess(true, shouldAuthorizeForAnnouncements);
