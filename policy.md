# Privacy Policy for Header Craft

Effective date: August 22, 2026

Header Craft lets users configure HTTP request headers for selected browser tabs. This policy explains what data the extension handles and where that data goes.

## Data handled by the extension

Header Craft stores user-created configuration, including profile and group names, header names, header values, comments, and temporary selected-tab identifiers, in `chrome.storage.sync`. Depending on the user's Chrome Sync settings, Google Chrome may synchronize this configuration between browsers signed in to the same Google account. If Chrome Sync is disabled, Chrome stores the configuration on the current device.

When a rule is enabled, its configured header name and value are added to requests made by the selected tab, including requests for third-party subresources. Websites and services receiving those requests therefore receive the configured value as part of the extension's requested functionality.

Chrome extension storage is not encrypted. Users should not store passwords, authentication cookies, API keys, bearer tokens, or other secrets in Header Craft. The export feature saves a JSON copy of the configuration to a file only when the user requests it; exported files contain the header names, values, and comments entered by the user.

## Collection and sharing

Header Craft does not transmit configuration to the developer or developer-controlled services. Except for Chrome Sync and the user-directed transmission of enabled header names and values described above, it does not disclose configuration to third parties. It has no analytics, advertising, or telemetry.

Data processed by Google Chrome Sync is governed by Google's privacy terms. Header values sent to websites are governed by the privacy practices of those websites.

The use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Permissions

- `storage` stores extension configuration using Chrome Sync.
- `declarativeNetRequest` and `<all_urls>` apply user-defined request headers to selected tabs.
- `downloads` creates an exported configuration file when requested by the user.

## Retention and deletion

Users can disable rules and clear or replace their stored names, values, and comments. Exported files remain under the user's control. Data synchronized by Chrome is retained or deleted according to the user's Chrome Sync and Google account settings.

## Changes and contact

Changes to this policy will be published in this repository. If a release changes how user data is handled, Header Craft will prominently disclose the change before it takes effect.

Questions or privacy requests can be sent to vivcogit@gmail.com.
