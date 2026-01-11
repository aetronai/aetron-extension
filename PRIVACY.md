# Privacy Policy for AETRON Wallet

**Last Updated: January 2025**

## Overview

AETRON Wallet is a non-custodial browser extension for the AETRON blockchain. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection

**We do NOT collect:**
- Personal information
- Wallet addresses or balances
- Transaction history
- Private keys or seed phrases
- Browsing history
- Analytics or telemetry data

## Data Storage

All data is stored **locally** on your device:

| Data Type | Storage Location | Purpose |
|-----------|------------------|---------|
| Encrypted private keys | Browser local storage | Sign transactions |
| Wallet addresses | Browser local storage | Display accounts |
| User preferences | Browser local storage | Settings (language, theme) |
| Connected dApps | Browser local storage | Remember permissions |

**No data is transmitted to external servers** except for:
- Blockchain RPC calls to AETRON network nodes (required for wallet functionality)
- These calls contain only public blockchain data (addresses, transactions)

## Third-Party Services

The extension connects to:
- **AETRON blockchain nodes** — to query balances, submit transactions, and interact with the network
- **Block explorers** (optional) — only when you click external links

We do not use any third-party analytics, advertising, or tracking services.

## Security

- Private keys are encrypted using AES-256 before storage
- Keys never leave your device unencrypted
- No remote access to your wallet data
- Open source code available for audit

## Your Responsibilities

As a non-custodial wallet:
- **You are solely responsible for your seed phrase**
- We cannot recover lost seed phrases or private keys
- We cannot reverse or cancel transactions
- We cannot freeze or access your funds

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `storage` | Store your encrypted wallet data locally |
| `activeTab` | Detect which dApp is requesting connection |
| `scripting` | Inject wallet provider for dApp interactions |
| `<all_urls>` | Allow any website to connect as a dApp |

## Children's Privacy

This extension is not intended for users under 18 years of age.

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

For questions or concerns about this Privacy Policy, please open an issue on our GitHub repository.

## Open Source

AETRON Wallet is open source. You can review the complete source code to verify our privacy practices.

---

**Summary:** AETRON Wallet stores all data locally on your device. We do not collect, transmit, or have access to your personal information, private keys, or wallet data.
