import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { MobileUtils } from "./lib/mobile-utils";

// Initialize mobile app features
if (typeof window !== 'undefined') {
  // Initialize mobile app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      MobileUtils.initializeMobileApp();
      MobileUtils.addMobileEventListeners();
    });
  } else {
    MobileUtils.initializeMobileApp();
    MobileUtils.addMobileEventListeners();
  }
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    MobileUtils.removeMobileEventListeners();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
