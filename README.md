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
# For Chrome
npm run build:chrome

# For Firefox
npm run build:firefox

# For both browsers
npm run build:all
```

4. Load in browser:

**Chrome:**

- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist-chrome` folder

**Firefox:**

- Open `about:debugging#/runtime/this-firefox`
- Click "Load Temporary Add-on"
- Select any file in the `dist-firefox` folder

## Development

### Development Mode (with hot reload)

```bash
npm run dev              # Chrome (default)
npm run dev:chrome       # Chrome explicitly
npm run dev:firefox      # Firefox explicitly
```

### Production Build

```bash
npm run build            # Chrome (default)
npm run build:chrome     # Chrome explicitly
npm run build:firefox    # Firefox explicitly
npm run build:all        # Both browsers
```

Output directories: `dist-chrome/` or `dist-firefox/`

### Package for Store Submission

These commands build the extension and create a clean zip file without macOS hidden files:

```bash
npm run package:chrome   # Creates aetron-wallet-chrome.zip
npm run package:firefox  # Creates aetron-wallet-firefox.zip
npm run package:all      # Creates both zip files
```

**Important:** Always use `npm run package:*` commands to create store-ready zip files. These scripts exclude macOS metadata files (`__MACOSX`, `.DS_Store`) that cause store validation failures.

### Linting

```bash
npm run lint
```

## Architecture

### Project Structure

```
src/
├── background/     # Service worker - blockchain operations, wallet management
├── popup/          # React UI - user interface
├── content/        # Content script - bridges dApps and extension
├── injected/       # Injected script - window.aetron provider
├── lib/            # Shared utilities and messaging
└── shared/         # Types and constants
```

### Tech Stack

- **Frontend:** React 19, React Router DOM, Tailwind CSS
- **Blockchain:** @polkadot/api, @polkadot/keyring, @polkadot/util-crypto
- **Build:** Vite 7, TypeScript 5
- **i18n:** i18next (English, Russian, Chinese)
- **Icons:** Lucide React

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

## Browser Compatibility

### Chrome / Edge / Brave

- Minimum version: Chrome 88+
- Manifest V3 compatible

### Firefox

- Minimum version: Firefox 140+
- Required for `data_collection_permissions` support
- Uses inlined chunks for background script (handled automatically by build system)

### Store Submission Notes

**Firefox Add-ons:**

- Extension declares `data_collection_permissions: { required: ["none"] }` (no user data collection)
- Uses `strict_min_version: 140.0` to support this feature
- Expected warnings about `innerHTML` (from React 19) are safe and can be ignored

## Security

- **Non-custodial** — Private keys never leave your device
- **Encrypted storage** — Keys encrypted with AES-256
- **No external servers** — Only connects to blockchain RPC nodes
- **Open source** — Code available for audit

## License

[MIT](LICENSE)

## Disclaimer

This is a non-custodial wallet. You are solely responsible for your seed phrase and private keys. Lost credentials cannot be recovered. Always backup your seed phrase in a secure location.
