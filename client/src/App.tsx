import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import BrandDetail from "./pages/BrandDetail";
import NotFound from "./pages/NotFound";
import Composer from "./pages/Composer";
import Login from "./pages/Login";
import ClientPortal from "./pages/ClientPortal";
import Clients from "./pages/Clients";
import Billing from "./pages/Billing";
import ReviewQueue from "./pages/ReviewQueue";
import Analytics from "./pages/Analytics";
import Videos from "./pages/Videos";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/login" component={Login} />
      <Route path="/client" component={ClientPortal} />
      <Route path="/compose" component={Composer} />
      <Route path="/clients" component={Clients} />
      <Route path="/billing" component={Billing} />
      <Route path="/review" component={ReviewQueue} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/videos" component={Videos} />
      <Route path="/brand/:brandId" component={BrandDetail} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
