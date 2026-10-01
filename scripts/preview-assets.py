"""Package only public Preview assets; never include app profiles or QA logs."""
from pathlib import Path
import hashlib
import json
import os
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
documents_approved = json.loads((root / 'release-publisher.json').read_text(encoding='utf-8'))['documentsApproved']
release = root / 'release'
installer = release / f'TimeLife-Preview-{version}.exe'
sources = release / f'TimeLife-Source-{version}.zip'
legal_zip = release / f'TimeLife-Legal-{version}.zip'
for file in [installer, sources]:
    if not file.is_file():
        raise FileNotFoundError(file)
with zipfile.ZipFile(legal_zip, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root / 'distribution/legal').rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(root / 'distribution'))
assets = [installer, sources, legal_zip]
checksums = {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in assets}
(release / 'SHA256SUMS.txt').write_text(''.join(f'{digest}  {name}\n' for name, digest in checksums.items()), encoding='utf-8')
commit = os.environ.get('GITHUB_SHA', '')
repo = os.environ.get('GITHUB_REPOSITORY', 'kodayorg/TimeLife')
run = os.environ.get('GITHUB_RUN_ID', '')
provenance = {
    'version': version, 'status': 'unsigned-preview', 'authenticodeSigned': False,
    'repository': repo, 'sourceCommit': commit,
    'workflowRun': f'https://github.com/{repo}/actions/runs/{run}' if run else None,
    'sha256': checksums,
}
(release / 'preview-build.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
notes = f'''TimeLife — календарь для Windows 11 с синхронизацией iCloud и виджетами на рабочий стол. Без рекламы и подписок.

**Тестовая версия Preview. Приложение и установщик не имеют цифровой подписи. Windows может показать предупреждение SmartScreen или «Неизвестный издатель». Подпись SignPath пока не подключена.**

Для установки скачайте **{installer.name}** из списка файлов ниже и следуйте инструкциям установщика. Инструкция по подключению iCloud — в [README](https://github.com/{repo}#readme).

Пароль iCloud защищён Windows DPAPI. Локальные файлы событий не зашифрованы. Перед проверкой синхронизации сохраните важные события: это тестовая версия.

В архиве **{legal_zip.name}** находятся условия использования, политика конфиденциальности, лицензии компонентов и исходники MPL. {'Издатель подтвердил условия использования и политику конфиденциальности.' if documents_approved else 'Документы пока отмечены как проект и ожидают проверки издателем.'}

**{sources.name}** содержит исходники приложения и документы, включая лицензии Electron/Chromium. Собственный код — MIT; зависимости сохраняют свои лицензии.

Контрольные суммы файлов: **SHA256SUMS.txt**. Сведения о сборке и исходном коммите: **preview-build.json**.

Windows 11 x64. Системный Acrylic требует Windows 11 22H2 или новее и включённых эффектов прозрачности.

---

Unsigned test build for Windows 11 x64. Windows may display SmartScreen or unknown-publisher warnings. No SignPath signature is provided. Account credentials use Windows DPAPI; local event files are not encrypted. {'The publisher has reviewed and confirmed the included terms and privacy policy.' if documents_approved else 'Legal documents are included as drafts pending publisher review.'} Keep a copy of important events before testing synchronization.
'''
(release / 'preview-notes.md').write_text(notes, encoding='utf-8')
print(f'Prepared {len(assets)} Preview assets and SHA-256 checksums')
