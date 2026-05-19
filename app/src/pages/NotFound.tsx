import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center px-4"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 mb-6">
          <AlertTriangle className="h-10 w-10 text-slate-600 dark:text-slate-300" />
        </div>
        <h1 className="text-6xl font-bold tracking-tight text-foreground">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">Page not found</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className="mt-6">
          <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
            <Home className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
