# Code signing policy

Project: TimeLife. Maintainer, reviewer and release approver: Koda Yorg, kodayorg@gmail.com.

Status: applying for SignPath Foundation signing is planned; no application has been submitted or accepted and no signing certificate is currently available. No current installer is represented as signed by SignPath. Public source repository: https://github.com/kodayorg/TimeLife .

All external contributions require maintainer review. Repository and signing accounts must use MFA. A public release requires human approval, a verifiable build from the reviewed source revision, valid timestamped signatures on the application and installer, and passing release checks. Third-party binaries must not be falsely presented as our own. Windows signature validation and matching the recorded expected signer subject are checked after signing.

The source code is MIT; third-party components retain their respective licenses. MPL-covered ical.js source and notices are provided alongside each package. The app sends data only to Apple iCloud after the user configures synchronization. See distribution/legal/privacy.html and privacy-en.html for storage, deletion and email contact processing.

If SignPath Foundation accepts the project, add its required acknowledgment (free signing by SignPath.io; certificate by SignPath Foundation), public role links and the exact service-approved signing identity. Do not add an acknowledgment of provided signing before approval. SignPath Foundation acceptance is discretionary; non-commercial status alone does not confer eligibility.

Reference: https://signpath.org/terms
