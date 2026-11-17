ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_status_check";
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_status_check"
  CHECK ("status" IN ('pending', 'active', 'disabled'));
