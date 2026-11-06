"""P1 integration/security tests. Uses a dedicated disposable local database.
Requires local Docker/PostgreSQL. Never reads or prints password hashes or tokens.
"""
import base64, hashlib, hmac, http.cookiejar, json, os, pathlib, secrets, struct, subprocess, sys, time, urllib.error, urllib.parse, urllib.request, uuid
from dev_api import ROOT, local_environment
DOTNET=os.environ.get('DOTNET_COMMAND','dotnet')
CLUB='11111111-1111-4111-8111-111111111111'
OTHER='22222222-2222-4222-8222-222222222222'
TEAM='33333333-3333-4333-8333-333333333333'
OTHERTEAM='44444444-4444-4444-8444-444444444444'
DB='clubmanager_test_'+uuid.uuid4().hex[:10]
RUN=ROOT/'.local'/DB
RUN.mkdir(parents=True,mode=0o700)
PORT=5092
PASSWORD='Synthetic-only!42-Long'
checks=0

def sql(query,db=DB,fail=False):
    prefix=['docker','--host=unix:///var/run/docker.sock']
    container=os.environ.get('P1_POSTGRES_CONTAINER')
    cmd=prefix+(['exec','-i',container] if container else ['compose','exec','-T','database'])+['psql','-U','clubmanager','-d',db,'-At','-v','ON_ERROR_STOP=1']
    env=os.environ.copy()
    for k in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(k,None)
    r=subprocess.run(cmd,input=query,text=True,capture_output=True,cwd=ROOT,env=env)
    if fail:
        assert r.returncode!=0,'SQL unexpectedly allowed a forbidden operation'
        return ''
    if r.returncode: raise RuntimeError('SQL setup/check failed: '+r.stderr[:1000])
    return r.stdout.strip()

def ok(condition,label):
    global checks
    assert condition,label
    checks+=1

def env_for(owner=False):
    e=local_environment(owner)
    e['ConnectionStrings__ClubDatabase']=e['ConnectionStrings__ClubDatabase'].replace('Database=clubmanager;',f'Database={DB};')
    e.update(App__KeyDirectory=str(RUN/'keys'),Mail__Directory=str(RUN/'mail'),App__PublicOrigin=f'http://127.0.0.1:{PORT}')
    return e

def totp(key):
    digest=hmac.new(base64.b32decode(key),struct.pack('>Q',int(time.time())//30),hashlib.sha1).digest();offset=digest[-1]&15
    return str((struct.unpack('>I',digest[offset:offset+4])[0]&0x7fffffff)%1000000).zfill(6)

class Client:
    def __init__(self):
        self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(self.jar))
    def call(self,path,body=None,method=None,csrf=True):
        method=method or ('GET' if body is None else 'POST');headers={'Content-Type':'application/json'}
        if method!='GET' and csrf:
            status,data=self.call('/api/auth/csrf');assert status==200
            headers['X-CSRF-TOKEN']=csrf if isinstance(csrf,str) else data['token']
        req=urllib.request.Request(f'http://127.0.0.1:{PORT}'+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
        try:r=self.opener.open(req,timeout=10)
        except urllib.error.HTTPError as ex:r=ex
        text=r.read().decode()
        try:data=json.loads(text) if text else {}
        except json.JSONDecodeError:data={}
        return r.status,data
    def expect(self,path,status,body=None,method=None,csrf=True):
        actual,data=self.call(path,body,method,csrf)
        ok(actual==status,f'{method or "auto"} {path.split("?")[0]} expected {status}, got {actual}')
        return data

def email_link(email,purpose):
    files=sorted((RUN/'mail').glob('*.json'),key=lambda p:p.stat().st_mtime_ns,reverse=True)
    for file in files:
        data=json.loads(file.read_text())
        if data['to'].lower()==email.lower() and data['purpose']==purpose:return {k:v[0] for k,v in urllib.parse.parse_qs(urllib.parse.urlsplit(data['url']).query).items()}
    raise AssertionError('Expected local mail was not captured')

def register(email,name):
    c=Client();c.expect('/api/auth/register',200,{'email':email,'displayName':name,'password':PASSWORD,'adultConfirmed':True})
    c.expect('/api/auth/login',401,{'email':email,'password':PASSWORD})
    params=email_link(email,'Verify your email');c.expect('/api/auth/verify-email',200,params)
    c.expect('/api/auth/verify-email',400,params)
    c.expect('/api/auth/login',200,{'email':email,'password':PASSWORD})
    me=c.expect('/api/auth/me',200);return c,me['id']

def mfa(c):
    result=c.expect('/api/auth/mfa/setup',200,{'password':PASSWORD})
    key=result['key'];result=c.expect('/api/auth/mfa/enable',200,{'code':totp(key)})
    ok(len(result['recoveryCodes'])==8,'MFA recovery codes generated')
    ok(c.expect('/api/auth/me',200)['mfaVerified'],'MFA assurance survives stamp validation')
    return key,result['recoveryCodes']

process=None
try:
    sql(f'CREATE DATABASE {DB};',db='postgres')
    migrate=subprocess.run([DOTNET,str(ROOT/'server/ClubManager.Api/bin/Debug/net10.0/ClubManager.Api.dll'),'--migrate'],cwd=ROOT,env=env_for(True),capture_output=True,text=True)
    if migrate.returncode:raise RuntimeError('Migration failed: '+migrate.stderr[-1500:])
    process=subprocess.Popen([DOTNET,str(ROOT/'server/ClubManager.Api/bin/Debug/net10.0/ClubManager.Api.dll'),'--urls',f'http://127.0.0.1:{PORT}'],cwd=ROOT,env=env_for(),stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    anon=Client()
    for _ in range(50):
        if process.poll() is not None:raise RuntimeError('Test API failed to start: '+process.stderr.read().decode()[-2500:])
        try:
            if anon.call('/api/health/live')[0]==200:break
        except urllib.error.URLError:time.sleep(.2)
    else:raise RuntimeError('API startup timeout')
    anon.expect('/api/auth/me',401)
    anon.expect('/api/auth/register',400,{'email':'csrf@example.test'},csrf=False)
    anon.expect('/api/auth/register',400,{'email':'forged@example.test','displayName':'Fake','password':PASSWORD,'adultConfirmed':True,'role':'admin'})
    anon.expect('/api/auth/register',400,{'email':'minor@example.test','displayName':'No Attestation','password':PASSWORD,'adultConfirmed':False})
    admin,aid=register('admin@example.test','Admin Test')
    guardian,gid=register('guardian@example.test','Guardian Test')
    coach,cid=register('coach@example.test','Coach Test')
    manager,mid=register('manager@example.test','Manager Test')
    ok([m['role'] for m in guardian.expect('/api/auth/me',200)['memberships']]==['guardian'],'Registration creates guardian only')
    guardian.expect(f'/api/clubs/{CLUB}/members',403)
    guardian.expect('/api/auth/profile',400,{'displayName':'Guardian Test','role':'admin'})
    guardian.expect('/api/auth/profile',400,{'displayName':'Forgery'},csrf=False)
    guardian.expect('/api/auth/profile',400,{'displayName':'Forgery'},csrf=anon.call('/api/auth/csrf')[1]['token'])
    guardian.expect('/api/auth/profile',200,{'displayName':'Updated Guardian'})
    ok(guardian.expect('/api/auth/me',200)['displayName']=='Updated Guardian','Profile is persisted')
    boot=subprocess.run([DOTNET,str(ROOT/'server/ClubManager.Api/bin/Debug/net10.0/ClubManager.Api.dll'),'--bootstrap-admin','admin@example.test'],cwd=ROOT,env=env_for(True),capture_output=True,text=True)
    ok(boot.returncode==0,'Protected admin bootstrap succeeds for verified adult')
    boot2=subprocess.run([DOTNET,str(ROOT/'server/ClubManager.Api/bin/Debug/net10.0/ClubManager.Api.dll'),'--bootstrap-admin','guardian@example.test'],cwd=ROOT,env=env_for(True),capture_output=True,text=True)
    ok(boot2.returncode!=0,'Admin bootstrap closes after first admin')
    admin.expect(f'/api/clubs/{CLUB}/members',403)
    admin_key,admin_recovery=mfa(admin)
    admin.expect(f'/api/clubs/{CLUB}/members',200)
    admin.expect(f'/api/clubs/{OTHER}/members',403)
    admin.expect(f'/api/clubs/{CLUB}/members/{aid}/admin',409,method='DELETE')
    for email,role,client in [('coach@example.test','coach',coach),('manager@example.test','manager',manager)]:
        invitation=admin.expect(f'/api/clubs/{CLUB}/invitations',200,{'email':email,'role':role})
        token=email_link(email,'Join your club staff')
        guardian.expect('/api/invitations/accept',404,token)
        client.expect('/api/invitations/accept',200,token)
        client.expect('/api/invitations/accept',404,token)
    expired=admin.expect(f'/api/clubs/{CLUB}/invitations',200,{'email':'guardian@example.test','role':'manager'})
    expired_token=email_link('guardian@example.test','Join your club staff')
    sql(f"UPDATE club.invitations SET expires_at=now()-interval '1 hour' WHERE id='{expired['id']}';")
    guardian.expect('/api/invitations/accept',404,expired_token)
    revoked=admin.expect(f'/api/clubs/{CLUB}/invitations',200,{'email':'guardian@example.test','role':'coach'})
    revoked_token=email_link('guardian@example.test','Join your club staff')
    admin.expect(f"/api/clubs/{CLUB}/invitations/{revoked['id']}",200,method='DELETE')
    guardian.expect('/api/invitations/accept',404,revoked_token)
    coach_key,coach_recovery=mfa(coach)
    manager_key,manager_recovery=mfa(manager)
    sql(f"INSERT INTO club.clubs VALUES('{OTHER}','Other Test Club'); INSERT INTO club.teams VALUES('{TEAM}','{CLUB}','U12 Test'),('{OTHERTEAM}','{OTHER}','Private Team'); INSERT INTO club.team_staff VALUES('{TEAM}','{CLUB}','{cid}','coach'),('{TEAM}','{CLUB}','{mid}','manager');")
    coach.expect(f'/api/clubs/{CLUB}/teams/{TEAM}',200)
    manager.expect(f'/api/clubs/{CLUB}/teams/{TEAM}',200)
    coach.expect(f'/api/clubs/{OTHER}/teams/{OTHERTEAM}',404)
    guardian.expect(f'/api/clubs/{CLUB}/teams/{TEAM}',403)
    coach.expect(f'/api/clubs/{CLUB}/invitations',403,{'email':'bad@example.test','role':'admin'})
    # Actual database enforcement, independent of HTTP route guards.
    prefix=f"BEGIN; SET LOCAL ROLE club_app; SELECT set_config('app.user_id','{gid}',true); SELECT set_config('app.mfa','false',true);"
    result=sql(prefix+" SELECT count(*) FROM club.memberships WHERE user_id<>club.actor(); ROLLBACK;")
    ok('0' in result.splitlines(),'RLS hides other memberships')
    sql(prefix+f" INSERT INTO club.memberships(club_id,user_id,role) VALUES('{CLUB}','{gid}','admin');",fail=True);ok(True,'RLS blocks self-promotion')
    sql(prefix+" UPDATE club.audit_events SET action='tampered';",fail=True);ok(True,'Audit updates denied by grants')
    sql(prefix+" DELETE FROM club.memberships;",fail=True);ok(True,'Membership deletion denied by grants')
    result=sql("SET ROLE club_app; SELECT count(*) FROM club.memberships;")
    ok(result.splitlines()[-1]=='0','No actor context means zero rows')
    # A revoked staff member retains a valid login but loses team privileges immediately.
    admin.expect(f'/api/clubs/{CLUB}/members/{cid}/coach',200,method='DELETE')
    coach.expect(f'/api/clubs/{CLUB}/teams/{TEAM}',404)
    ok(not any(m['role']=='coach' for m in coach.expect('/api/auth/me',200)['memberships']),'Revoked role disappears without logging out')
    audit=admin.expect(f'/api/clubs/{CLUB}/audit',200)
    ok(any(e['action']=='membership.revoked.coach' for e in audit),'Revocation audit recorded')
    guardian.expect(f'/api/clubs/{CLUB}/audit',403)
    # Invalidate every active session on password reset; the reset token is one-use.
    second=Client();second.expect('/api/auth/login',200,{'email':'guardian@example.test','password':PASSWORD})
    guardian.expect('/api/auth/forgot-password',200,{'email':'guardian@example.test'})
    token=email_link('guardian@example.test','Reset your password');new_password='Changed-synthetic!42-Long'
    anon.expect('/api/auth/reset-password',200,{**token,'password':new_password})
    second.expect('/api/auth/me',401)
    anon.expect('/api/auth/reset-password',400,{**token,'password':new_password})
    fresh=Client();fresh.expect('/api/auth/login',200,{'email':'guardian@example.test','password':new_password})
    fresh.expect('/api/auth/logout',200,{})
    fresh.expect('/api/auth/me',401)
    # Authenticator/recovery login and replay protection.
    manager.expect('/api/auth/logout',200,{})
    login=Client();ok(login.expect('/api/auth/login',200,{'email':'manager@example.test','password':PASSWORD})['requiresTwoFactor'],'MFA challenge required')
    login.expect('/api/auth/me',401)
    login.expect('/api/auth/login/mfa',200,{'code':manager_recovery[0],'recovery':True})
    login.expect('/api/auth/logout',200,{})
    login.expect('/api/auth/login',200,{'email':'manager@example.test','password':PASSWORD})
    login.expect('/api/auth/login/mfa',401,{'code':manager_recovery[0],'recovery':True})
    login.expect('/api/auth/login/mfa',200,{'code':totp(manager_key)})
    # Lockout after five failures, without rolling back failed-attempt counters.
    locked=Client()
    for _ in range(5):locked.expect('/api/auth/login',401,{'email':'guardian@example.test','password':'Wrong-password!42'})
    locked.expect('/api/auth/login',401,{'email':'guardian@example.test','password':new_password})
    # Serving with the migration credential must fail before opening a listener.
    privileged=subprocess.run([DOTNET,str(ROOT/'server/ClubManager.Api/bin/Debug/net10.0/ClubManager.Api.dll'),'--urls','http://127.0.0.1:5093'],cwd=ROOT,env=env_for(True),capture_output=True,text=True,timeout=15)
    ok(privileged.returncode!=0 and 'privileged database credentials' in privileged.stderr,'Runtime rejects migration credentials')
    print(f'PASS: {checks} P1 HTTP/database security assertions; real PostgreSQL, cookies, CSRF, local mail and TOTP.')
finally:
    if process:
        process.terminate()
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill();process.wait()
    sql(f'DROP DATABASE IF EXISTS {DB} WITH (FORCE);',db='postgres')
