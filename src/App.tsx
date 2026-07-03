import { Toaster } from "sonner";
import { Dashboard } from "@/components/Dashboard";

export default function App() {
  return (
    <div className="min-h-full">
      <Dashboard />
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "hsl(200 24% 7%)",
            border: "1px solid hsl(200 16% 15%)",
            color: "hsl(195 20% 95%)",
          },
        }}
      />
    </div>
  );
}
