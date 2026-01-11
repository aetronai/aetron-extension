import { Routes, Route } from 'react-router-dom'
import { WalletProvider } from './context/WalletContext'
import { NetworkProvider } from './context/NetworkContext'
import Layout from './components/Layout'
import Welcome from './pages/Welcome'
import Unlock from './pages/Unlock'
import Dashboard from './pages/Dashboard'
import Send from './pages/Send'
import Receive from './pages/Receive'
import Staking from './pages/Staking'
import Hotkeys from './pages/Hotkeys'
import Neuronets from './pages/Neuronets'
import Settings from './pages/Settings'
import ConnectedSites from './pages/ConnectedSites'
import CreateWallet from './pages/CreateWallet'
import ImportWallet from './pages/ImportWallet'

export default function App() {
  return (
    <NetworkProvider>
      <WalletProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="send" element={<Send />} />
            <Route path="receive" element={<Receive />} />
            <Route path="staking" element={<Staking />} />
            <Route path="hotkeys" element={<Hotkeys />} />
            <Route path="neuronets" element={<Neuronets />} />
            <Route path="settings" element={<Settings />} />
            <Route path="connected-sites" element={<ConnectedSites />} />
          </Route>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/unlock" element={<Unlock />} />
          <Route path="/create-wallet" element={<CreateWallet />} />
          <Route path="/import-wallet" element={<ImportWallet />} />
        </Routes>
      </WalletProvider>
    </NetworkProvider>
  )
}
