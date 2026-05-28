import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ArtworksProvider } from "./context/ArtworksContext";
import { AuthProvider } from "../context/AuthContext";
import ChatPanel from "../components/ChatPanel";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <AuthProvider>
      <ArtworksProvider>
        <RouterProvider router={router} />
        <ChatPanel />
        <Toaster />
      </ArtworksProvider>
    </AuthProvider>
  );
}
