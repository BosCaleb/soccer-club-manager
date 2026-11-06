"""Start P1 with a restricted application role. Management uses separate credentials."""
import os
from pathlib import Path
import secrets
import subprocess
ROOT = Path(__file__).resolve().parents[1]

def local_environment(owner=False):
    settings = os.environ.copy()
    settings.setdefault('DOTNET_CLI_TELEMETRY_OPTOUT', '1')
    settings.setdefault('ASPNETCORE_ENVIRONMENT', 'Development')
    local = ROOT / '.local'
    local.mkdir(mode=0o700, exist_ok=True)
    password_file = local / 'application-password'
    if not password_file.exists():
        fd=os.open(password_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as stream: stream.write(secrets.token_hex(32))
    app_password = password_file.read_text().strip()
    settings.setdefault('App__KeyDirectory', str(local / 'keys'))
    settings.setdefault('App__PublicOrigin','http://localhost:5173')
    settings.setdefault('Mail__Mode','Local')
    settings.setdefault('Mail__Directory',str(local / 'mail'))
    supplied = settings.get('ConnectionStrings__AdminDatabase' if owner else 'ConnectionStrings__ClubDatabase')
    if not supplied:
        password = app_password
        if owner:
            password = settings.get('POSTGRES_PASSWORD')
            if not password and (ROOT / '.env').exists():
                for line in (ROOT / '.env').read_text().splitlines():
                    if line.startswith('POSTGRES_PASSWORD='): password=line.split('=',1)[1].strip()
            if not password: raise RuntimeError('Set local POSTGRES_PASSWORD before migration.')
        escaped = password.replace('"','""')
        supplied = f'Host=127.0.0.1;Port=5432;Database=clubmanager;Username={"clubmanager" if owner else "club_app"};Password="{escaped}"'
    settings['ConnectionStrings__ClubDatabase']=supplied
    if owner: settings['App__DatabasePassword']=app_password
    else:
        for name in ['POSTGRES_PASSWORD','ConnectionStrings__AdminDatabase','App__DatabasePassword']: settings.pop(name,None)
    return settings

if __name__ == '__main__':
    raise SystemExit(subprocess.call([os.environ.get('DOTNET_COMMAND','dotnet'),'run','--no-launch-profile','--project','server/ClubManager.Api','--','--urls','http://127.0.0.1:5080'],cwd=ROOT,env=local_environment()))
