import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import ConsoleLayout from "./pages/console/ConsoleLayout";
import Overview from "./pages/console/Overview";
import DIDs from "./pages/console/DIDs";
import Credentials from "./pages/console/Credentials";
import TrustRegistry from "./pages/console/TrustRegistry";
import Messages from "./pages/console/Messages";
import Developer from "./pages/console/Developer";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLogin from "./pages/admin/Login";
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminAuditLog from "./pages/admin/AuditLog";
import AdminSystemHealth from "./pages/admin/SystemHealth";
import AdminDIDs from "./pages/admin/DIDs";
import AdminCredentials from "./pages/admin/Credentials";
import AdminApiKeys from "./pages/admin/ApiKeys";
import AdminDocs from "./pages/admin/Docs";
import AdminDevelopers from "./pages/admin/Developers";
import AdminIntegrations from "./pages/admin/Integrations";
import AdminTokens from "./pages/admin/Tokens";

import AdminWallets from "./pages/admin/Wallets";
import AdminWalletDetail from "./pages/admin/WalletDetail";
import AdminGrants from "./pages/admin/Grants";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<ConsoleLayout />}>
          <Route index element={<Overview />} />
          <Route path="dids" element={<DIDs />} />
          <Route path="credentials" element={<Credentials />} />
          <Route path="trust" element={<TrustRegistry />} />
          <Route path="messages" element={<Messages />} />
          <Route path="developer" element={<Developer />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="login" element={<AdminLogin />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
          <Route path="health" element={<AdminSystemHealth />} />
          <Route path="dids" element={<AdminDIDs />} />
          <Route path="credentials" element={<AdminCredentials />} />
          <Route path="api-keys" element={<AdminApiKeys />} />
          <Route path="docs" element={<AdminDocs />} />
          <Route path="developers" element={<AdminDevelopers />} />
          <Route path="integrations" element={<AdminIntegrations />} />
          <Route path="tokens" element={<AdminTokens />} />
          <Route path="wallets" element={<AdminWallets />} />
          <Route path="wallets/:walletId" element={<AdminWalletDetail />} />
          <Route path="grants" element={<AdminGrants />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
