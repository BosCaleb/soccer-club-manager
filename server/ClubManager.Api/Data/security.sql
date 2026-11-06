CREATE SCHEMA club;
REVOKE ALL ON SCHEMA club FROM PUBLIC;
GRANT USAGE ON SCHEMA club TO club_app;
CREATE TABLE club.clubs(id uuid PRIMARY KEY,name varchar(100) NOT NULL);
INSERT INTO club.clubs VALUES ('11111111-1111-4111-8111-111111111111','Green Point FC');
CREATE TABLE club.memberships(
 club_id uuid NOT NULL REFERENCES club.clubs(id), user_id text NOT NULL REFERENCES public."AspNetUsers"("Id"),
 role text NOT NULL CHECK(role IN ('guardian','coach','manager','admin')),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 PRIMARY KEY(club_id,user_id,role));
CREATE INDEX ON club.memberships(user_id,status);
CREATE TABLE club.teams(id uuid PRIMARY KEY,club_id uuid NOT NULL REFERENCES club.clubs(id),name varchar(100) NOT NULL,UNIQUE(id,club_id));
CREATE TABLE club.team_staff(team_id uuid NOT NULL,club_id uuid NOT NULL,user_id text NOT NULL,role text NOT NULL CHECK(role IN ('coach','manager')),PRIMARY KEY(team_id,user_id,role),FOREIGN KEY(team_id,club_id) REFERENCES club.teams(id,club_id),FOREIGN KEY(club_id,user_id,role) REFERENCES club.memberships(club_id,user_id,role));
CREATE TABLE club.invitations(id uuid PRIMARY KEY,club_id uuid NOT NULL REFERENCES club.clubs(id),email varchar(254) NOT NULL,role text NOT NULL CHECK(role IN ('coach','manager','admin')),created_by text NOT NULL REFERENCES public."AspNetUsers"("Id"),token_hash bytea NOT NULL UNIQUE,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),expires_at timestamptz NOT NULL);
CREATE UNIQUE INDEX ON club.invitations(club_id,email,role) WHERE status='pending';
CREATE TABLE club.audit_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid NOT NULL REFERENCES club.clubs(id),actor_id text NOT NULL,action varchar(100) NOT NULL,subject_id text NOT NULL,at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON club.audit_events(club_id,at DESC);
CREATE FUNCTION club.actor() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'') $$;
CREATE FUNCTION club.mfa() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('app.mfa',true),'false')='true' $$;
-- Small SECURITY DEFINER predicates avoid recursive membership policies. Search paths are fixed.
-- Their owner is the migration principal; the serving role never owns any table/function.
CREATE FUNCTION club.is_admin(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,club AS $$ SELECT club.mfa() AND EXISTS(SELECT 1 FROM club.memberships WHERE club_id=c AND user_id=club.actor() AND role='admin' AND status='active') $$;
CREATE FUNCTION club.is_member(c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,club AS $$ SELECT EXISTS(SELECT 1 FROM club.memberships WHERE club_id=c AND user_id=club.actor() AND status='active') $$;
CREATE FUNCTION club.email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT "NormalizedEmail" FROM public."AspNetUsers" WHERE "Id"=club.actor() AND "EmailConfirmed" $$;
CREATE FUNCTION club.has_invitation(c uuid,r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,club AS $$ SELECT EXISTS(SELECT 1 FROM club.invitations WHERE id::text=nullif(current_setting('app.invitation_id',true),'') AND club_id=c AND role=r AND email=club.email() AND status='pending' AND expires_at>now()) $$;
CREATE FUNCTION club.on_team(t uuid,c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,club AS $$ SELECT club.mfa() AND EXISTS(SELECT 1 FROM club.team_staff s JOIN club.memberships m ON (m.club_id,m.user_id,m.role)=(s.club_id,s.user_id,s.role) WHERE s.team_id=t AND s.club_id=c AND s.user_id=club.actor() AND m.status='active') $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA club FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA club TO club_app;
ALTER TABLE club.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE club.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE club.team_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE club.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE club.audit_events ENABLE ROW LEVEL SECURITY;
-- Owner-only bypass is retained for the fixed definer predicates and management CLI.
CREATE POLICY clubs_read ON club.clubs FOR SELECT TO club_app USING(club.is_member(id));
CREATE POLICY memberships_read ON club.memberships FOR SELECT TO club_app USING(user_id=club.actor() OR club.is_admin(club_id));
CREATE POLICY memberships_insert ON club.memberships FOR INSERT TO club_app WITH CHECK(status='active' AND (club.is_admin(club_id) OR (user_id=club.actor() AND ((role='guardian' AND club_id='11111111-1111-4111-8111-111111111111' AND club.email() IS NOT NULL) OR club.has_invitation(club_id,role)))));
CREATE POLICY memberships_update ON club.memberships FOR UPDATE TO club_app USING(club.is_admin(club_id) OR (user_id=club.actor() AND club.has_invitation(club_id,role))) WITH CHECK(club.is_admin(club_id) OR (user_id=club.actor() AND status='active' AND club.has_invitation(club_id,role)));
CREATE POLICY teams_read ON club.teams FOR SELECT TO club_app USING(club.is_admin(club_id) OR club.on_team(id,club_id));
CREATE POLICY team_staff_read ON club.team_staff FOR SELECT TO club_app USING(club.is_admin(club_id) OR (user_id=club.actor() AND club.on_team(team_id,club_id)));
CREATE POLICY invitations_read ON club.invitations FOR SELECT TO club_app USING(club.is_admin(club_id) OR email=club.email());
CREATE POLICY invitations_insert ON club.invitations FOR INSERT TO club_app WITH CHECK(club.is_admin(club_id) AND created_by=club.actor() AND status='pending');
CREATE POLICY invitations_update ON club.invitations FOR UPDATE TO club_app USING(club.is_admin(club_id) OR (email=club.email() AND status='pending' AND expires_at>now())) WITH CHECK(club.is_admin(club_id) OR (email=club.email() AND status='accepted'));
CREATE POLICY audit_read ON club.audit_events FOR SELECT TO club_app USING(club.is_admin(club_id));
CREATE POLICY audit_insert ON club.audit_events FOR INSERT TO club_app WITH CHECK(actor_id=club.actor() AND club.is_member(club_id));
GRANT SELECT ON ALL TABLES IN SCHEMA club TO club_app;
GRANT INSERT ON club.memberships,club.invitations,club.audit_events TO club_app;
GRANT UPDATE(status) ON club.memberships,club.invitations TO club_app;
-- Identity tables are private to the server's UserManager; no direct browser/database access.
GRANT SELECT,INSERT,UPDATE,DELETE ON public."AspNetUsers",public."AspNetRoles",public."AspNetUserRoles",public."AspNetUserClaims",public."AspNetUserLogins",public."AspNetUserTokens",public."AspNetRoleClaims" TO club_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO club_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
