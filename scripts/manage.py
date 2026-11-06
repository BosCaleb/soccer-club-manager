"""Explicit management commands; never run the web server with owner credentials."""
import os
import subprocess
import sys
from dev_api import local_environment, ROOT
if len(sys.argv)<2 or sys.argv[1] not in ['migrate','bootstrap-admin']:
    raise SystemExit('Usage: python3 scripts/manage.py migrate | bootstrap-admin VERIFIED_EMAIL')
if sys.argv[1]=='bootstrap-admin' and len(sys.argv)!=3: raise SystemExit('Supply the designated verified email.')
args=['--migrate'] if sys.argv[1]=='migrate' else ['--bootstrap-admin',sys.argv[2]]
raise SystemExit(subprocess.call([os.environ.get('DOTNET_COMMAND','dotnet'),'run','--no-launch-profile','--project','server/ClubManager.Api','--',*args],cwd=ROOT,env=local_environment(owner=True)))
