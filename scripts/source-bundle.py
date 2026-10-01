from pathlib import Path
import zipfile, json, hashlib
root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
files = ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.gitignore','release-publisher.json','LICENSE','README.md','CONTRIBUTING.md','SECURITY.md','CODE_SIGNING_POLICY.md']
dirs = ['src','scripts','tests','build','third-party-overrides','distribution/legal']
paths = [root / file for file in files]
for directory in dirs:
    paths.extend(p for p in (root / directory).rglob('*') if p.is_file())
output = root / 'release' / f'TimeLife-Source-{version}.zip'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(paths):
        relative = file.relative_to(root).as_posix()
        assert not any(p in {'node_modules','.git','.cache','qa','data','release','__pycache__'} for p in file.relative_to(root).parts)
        assert file.suffix.lower() not in {'.pfx','.p12','.pem','.key','.log'}
        archive.write(file, f'TimeLife-{version}/' + relative)
print(output)
print('SHA256 ' + hashlib.sha256(output.read_bytes()).hexdigest())
