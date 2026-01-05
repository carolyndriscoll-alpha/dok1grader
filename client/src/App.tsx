import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/brainlifts/:slug">
        {(params) => <Dashboard slug={params.slug} />}
      </Route>
      <Route path="/grading/:slug">
        {(params) => <Dashboard slug={params.slug} />}
      </Route>
      <Route path="/view/:slug">
        {(params) => <Dashboard slug={params.slug} isSharedView={true} />}
      </Route>
      <Route path="/:slug">
        {(params) => <Dashboard slug={params.slug} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
