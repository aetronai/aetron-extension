# AETRON Wallet

Browser extension wallet for the AETRON blockchain. Manage AET tokens, stake on neuronets, and interact with decentralized applications.

## Features

- **Wallet Management** — Create and import wallets using seed phrases
- **Send & Receive** — Transfer AET tokens between addresses
- **Staking** — Stake on neuronets and manage delegations
- **Multi-Account** — Manage multiple coldkeys and hotkeys
- **dApp Integration** — Connect to decentralized applications
- **Multi-Language** — English, Russian, Chinese

## Installation

### Chrome Web Store

Coming soon

### Manual Installation (Development)

1. Clone the repository:

```bash
git clone https://github.com/aetronai/aetron-extension.git
cd aetron-extension
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run build:chrome
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist-chrome` folder

### Firefox

```bash
npm run build:firefox
```

Load the `dist-firefox` folder in `about:debugging`.

## Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build:chrome
npm run build:firefox
npm run build:all

# Lint code
npm run lint
```

## Architecture

```
src/
├── background/     # Service worker - blockchain operations, wallet management
├── popup/          # React UI - user interface
├── content/        # Content script - bridges dApps and extension
├── injected/       # Injected script - window.aetron provider
├── lib/            # Shared utilities and messaging
└── shared/         # Types and constants
```

## dApp Integration

AETRON Wallet injects `window.aetron` provider into web pages:

```javascript
// Check if wallet is installed
if (window.aetron) {
  // Connect to wallet
  const accounts = await window.aetron.connect();

  // Get connected accounts
  const accounts = await window.aetron.getAccounts();

  // Sign a message
  const signature = await window.aetron.signMessage(message);

  // Send transaction
  const txHash = await window.aetron.sendTransaction(tx);
}
```

## Security

- **Non-custodial** — Private keys never leave your device
- **Encrypted storage** — Keys encrypted with AES-256
- **No external servers** — Only connects to blockchain RPC nodes
- **Open source** — Code available for audit

## License

[MIT](LICENSE)

## Disclaimer

This is a non-custodial wallet. You are solely responsible for your seed phrase and private keys. Lost credentials cannot be recovered. Always backup your seed phrase in a secure location.
