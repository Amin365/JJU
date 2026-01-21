import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router'
import { QueryClient ,QueryClientProvider } from '@tanstack/react-query'
import { PersistGate } from 'redux-persist/es/integration/react'
import { Provider } from 'react-redux'
import store, { persister } from './app/store.js'
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from './components/ThemeProvider.jsx'
import { HelmetProvider } from "react-helmet-async";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
<Provider store={store}>
<PersistGate loading={null} persistor={persister}>
 <BrowserRouter>
 <ThemeProvider>
 <HelmetProvider>
        <App />
         <Toaster />
      </HelmetProvider>
      </ThemeProvider>
      </BrowserRouter>
</PersistGate>
</Provider>
    </QueryClientProvider>
  </StrictMode>,
)
