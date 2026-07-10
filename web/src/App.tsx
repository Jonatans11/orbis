import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import ConsoleLayout from "./pages/console/ConsoleLayout";
import Overview from "./pages/console/Overview";
import DIDs from "./pages/console/DIDs";
import Credentials from "./pages/console/Credentials";
import TrustRegistry from "./pages/console/TrustRegistry";
import Messages from "./pages/console/Messages";
import Developer from "./pages/console/Developer";

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
      </Routes>
    </BrowserRouter>
  );
}
